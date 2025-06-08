import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createEmbeddingService } from '@/lib/embedding-service';
import { htmlAcceptanceCriteriaToText, cleanUserStoryDescription } from '@/lib/html-to-text';

interface AzureWorkItem {
  id: number;
  fields: {
    'System.Title': string;
    'System.Description'?: string;
    'System.WorkItemType': string;
    'System.State': string;
    'System.AssignedTo'?: {
      displayName: string;
    };
    'Microsoft.VSTS.Common.Priority'?: number;
    'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
    'System.Tags'?: string;
    'System.CreatedDate': string;
    'System.ChangedDate': string;
  };
  relations?: {
    rel: string;
    url: string;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, organization, project, pat, includeEmbeddings = true } = body;

    if (!projectId || !organization || !project || !pat) {
      return NextResponse.json({ 
        error: 'Missing required parameters: projectId, organization, project, pat' 
      }, { status: 400 });
    }

    // Get project configuration including OpenAI API key for embeddings
    const { data: projectConfig, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('work_item_types, openai_api_key')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return NextResponse.json({ 
        error: 'Failed to fetch project configuration' 
      }, { status: 500 });
    }

    const workItemTypes = projectConfig.work_item_types || ['User Story', 'Task', 'Bug', 'Feature'];
    const workItemTypesString = workItemTypes.map((type: string) => `'${type}'`).join(', ');

    // Initialize embedding service if API key is available
    let embeddingService = null;
    if (includeEmbeddings && projectConfig.openai_api_key) {
      try {
        embeddingService = createEmbeddingService(projectConfig.openai_api_key);
      } catch (error) {
        console.warn('Failed to initialize embedding service:', error);
      }
    }

    // Delete existing work items that are no longer in the selected types
    const { data: deletedItems, error: deleteError } = await supabaseAdmin
      .from('work_items')
      .delete()
      .eq('project_id', projectId)
      .not('work_item_type', 'in', `(${workItemTypesString.replace(/'/g, '')})`)
      .select('azure_id');

    const deletedCount = deletedItems?.length || 0;

    if (deleteError) {
      console.error('Error deleting work items:', deleteError);
      // Continue with sync even if deletion fails
    }

    // Fetch work items from Azure DevOps with the configured types
    const wiqlQuery = {
      query: `
        SELECT [System.Id], [System.Title], [System.Description], [System.WorkItemType], 
               [System.State], [System.AssignedTo], [Microsoft.VSTS.Common.Priority], 
               [Microsoft.VSTS.Common.AcceptanceCriteria], [System.Tags], 
               [System.CreatedDate], [System.ChangedDate], [System.Parent]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${project}' 
        AND [System.WorkItemType] IN (${workItemTypesString})
        ORDER BY [System.ChangedDate] DESC
      `
    };

    // Execute WIQL query
    const wiqlUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.0`;
    const wiqlResponse = await fetch(wiqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wiqlQuery),
    });

    if (!wiqlResponse.ok) {
      return NextResponse.json({ error: 'Failed to execute WIQL query' }, { status: wiqlResponse.status });
    }

    const wiqlResult = await wiqlResponse.json();
    const workItemIds = wiqlResult.workItems?.map((item: any) => item.id) || [];

    if (workItemIds.length === 0) {
      return NextResponse.json({ 
        message: 'No work items found to sync',
        synced: 0,
        updated: 0,
        embeddingsCreated: 0
      });
    }

    // Fetch detailed work item information
    const batchUrl = `https://dev.azure.com/${organization}/_apis/wit/workitems?ids=${workItemIds.join(',')}&$expand=relations&api-version=7.0`;
    const batchResponse = await fetch(batchUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64'),
        'Content-Type': 'application/json',
      },
    });

    if (!batchResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch work item details' }, { status: batchResponse.status });
    }

    const batchResult = await batchResponse.json();
    
    // Helper function to extract work item ID from URL
    const extractWorkItemId = (url: string): string => {
      const match = url.match(/workItems\/(\d+)/);
      return match ? match[1] : '';
    };

    let syncedCount = 0;
    let updatedCount = 0;
    let embeddingsCreated = 0;
    const workItemRelations: Array<{
      parentAzureId: string;
      childAzureId: string;
      relationType: string;
    }> = [];

    const workItemsNeedingEmbedding: string[] = []; // Store Azure IDs that need embedding

    // Process each work item
    for (const item of batchResult.value || []) {
      const azureId = item.id.toString();
      
      // Process relations - check for direct parent field first
      if (item.fields['System.Parent']) {
        const parentAzureId = item.fields['System.Parent'].toString();
        workItemRelations.push({
          parentAzureId,
          childAzureId: azureId,
          relationType: 'parent'
        });
      }
      
      // Also process relations array if present
      if (item.relations) {
        for (const relation of item.relations) {
          const relatedWorkItemId = extractWorkItemId(relation.url);
          
          if (relatedWorkItemId && workItemIds.includes(parseInt(relatedWorkItemId))) {
            if (relation.rel.includes('Parent')) {
              workItemRelations.push({
                parentAzureId: relatedWorkItemId,
                childAzureId: azureId,
                relationType: 'parent'
              });
            } else if (relation.rel.includes('Child')) {
              workItemRelations.push({
                parentAzureId: azureId,
                childAzureId: relatedWorkItemId,
                relationType: 'parent'
              });
            }
          }
        }
      }

      const workItemData = {
        azure_id: azureId,
        title: item.fields['System.Title'] || '',
        description: cleanUserStoryDescription(item.fields['System.Description']) || null,
        work_item_type: item.fields['System.WorkItemType'] || '',
        state: item.fields['System.State'] || '',
        assigned_to: item.fields['System.AssignedTo']?.displayName || null,
        priority: item.fields['Microsoft.VSTS.Common.Priority'] || null,
        acceptance_criteria: htmlAcceptanceCriteriaToText(item.fields['Microsoft.VSTS.Common.AcceptanceCriteria']) || null,
        tags: item.fields['System.Tags'] ? 
          item.fields['System.Tags'].split(';').map((tag: string) => tag.trim()) : 
          null,
        created_date: item.fields['System.CreatedDate'] || null,
        changed_date: item.fields['System.ChangedDate'] || null,
        project_id: projectId,
        last_sync_at: new Date().toISOString(),
      };

      // Check if work item already exists
      const { data: existingWorkItem } = await supabaseAdmin
        .from('work_items')
        .select('id, azure_id, title, description, work_item_type, state, assigned_to, priority, acceptance_criteria, tags, changed_date')
        .eq('azure_id', azureId)
        .single();

      let needsEmbedding = false;

      if (existingWorkItem) {
        // Check if anything has actually changed
        const existingChangedDate = new Date(existingWorkItem.changed_date || 0);
        const newChangedDate = new Date(workItemData.changed_date || 0);
        
        const hasFieldChanges = 
          existingWorkItem.title !== workItemData.title ||
          existingWorkItem.description !== workItemData.description ||
          existingWorkItem.work_item_type !== workItemData.work_item_type ||
          existingWorkItem.state !== workItemData.state ||
          existingWorkItem.assigned_to !== workItemData.assigned_to ||
          existingWorkItem.priority !== workItemData.priority ||
          existingWorkItem.acceptance_criteria !== workItemData.acceptance_criteria ||
          JSON.stringify(existingWorkItem.tags) !== JSON.stringify(workItemData.tags);

        // Update if the changed date is newer OR if any fields have changed
        if (newChangedDate > existingChangedDate || hasFieldChanges) {
          await supabaseAdmin
            .from('work_items')
            .update(workItemData)
            .eq('azure_id', azureId);
          updatedCount++;
          needsEmbedding = true; // Updated items need re-embedding
        }
      } else {
        // Insert new work item
        await supabaseAdmin
          .from('work_items')
          .insert(workItemData);
        syncedCount++;
        needsEmbedding = true; // New items need embedding
      }

      // Track items that need embedding
      if (needsEmbedding && embeddingService) {
        workItemsNeedingEmbedding.push(azureId);
      }
    }

    // Clear existing relations for these work items to avoid duplicates
    const { data: existingWorkItems } = await supabaseAdmin
      .from('work_items')
      .select('id, azure_id')
      .in('azure_id', workItemIds.map(String));

    if (existingWorkItems && existingWorkItems.length > 0) {
      const existingIds = existingWorkItems.map(item => item.id);
      await supabaseAdmin
        .from('work_item_relations')
        .delete()
        .or(`parent_work_item_id.in.(${existingIds.join(',')}),child_work_item_id.in.(${existingIds.join(',')})`)
        .eq('relation_type', 'parent');
    }

    // Create a map of azure_id to internal id for efficient lookups
    const workItemIdMap = new Map(
      existingWorkItems?.map(item => [item.azure_id, item.id]) || []
    );

    // Sync work item relations
    for (const relation of workItemRelations) {
      const parentId = workItemIdMap.get(relation.parentAzureId);
      const childId = workItemIdMap.get(relation.childAzureId);

      if (parentId && childId) {
        await supabaseAdmin
          .from('work_item_relations')
          .upsert({
            parent_work_item_id: parentId,
            child_work_item_id: childId,
            relation_type: relation.relationType,
          }, {
            onConflict: 'parent_work_item_id,child_work_item_id,relation_type'
          });
      }
    }

    // Create embeddings for new/updated work items
    if (embeddingService && workItemsNeedingEmbedding.length > 0) {
      console.log(`Creating embeddings for ${workItemsNeedingEmbedding.length} work items...`);
      
      // Fetch the actual database records for embedding
      const { data: workItemsForEmbedding, error: fetchError } = await supabaseAdmin
        .from('work_items')
        .select('*')
        .in('azure_id', workItemsNeedingEmbedding);

      if (fetchError) {
        console.error('Error fetching work items for embedding:', fetchError);
      } else if (workItemsForEmbedding) {
        for (const dbWorkItem of workItemsForEmbedding) {
          try {
            // Transform database record to WorkItem format expected by embedding service
            const workItemForEmbedding = transformDatabaseWorkItem(dbWorkItem);
            await embeddingService.embedWorkItem(workItemForEmbedding);
            embeddingsCreated++;
            console.log(`Created embedding for work item ${dbWorkItem.azure_id} (ID: ${dbWorkItem.id})`);
          } catch (error) {
            console.error(`Failed to create embedding for work item ${dbWorkItem.azure_id}:`, error);
            // Continue with other embeddings even if one fails
          }
        }
      }
      
      console.log(`Successfully created ${embeddingsCreated} embeddings`);
    }

    // Update project's last sync time
    await supabaseAdmin
      .from('projects')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', projectId);

    return NextResponse.json({
      message: 'Work items synced successfully',
      synced: syncedCount,
      updated: updatedCount,
      totalProcessed: syncedCount + updatedCount,
      relationsProcessed: workItemRelations.length,
      deleted: deletedCount,
      embeddingsCreated,
      embeddingService: embeddingService ? 'enabled' : 'disabled'
    });

  } catch (error) {
    console.error('Error syncing work items:', error);
    return NextResponse.json({ 
      error: 'Failed to sync work items from Azure DevOps' 
    }, { status: 500 });
  }
}

// Helper function to transform Azure work item to our WorkItem format
function transformToWorkItemFormat(azureItem: any, azureId: string) {
  return {
    id: azureId,
    title: azureItem.fields['System.Title'] || '',
    description: cleanUserStoryDescription(azureItem.fields['System.Description']) || '',
    workItemType: azureItem.fields['System.WorkItemType'] || '',
    state: azureItem.fields['System.State'] || '',
    assignedTo: azureItem.fields['System.AssignedTo']?.displayName || undefined,
    priority: azureItem.fields['Microsoft.VSTS.Common.Priority'] || undefined,
    acceptanceCriteria: htmlAcceptanceCriteriaToText(azureItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria']) || undefined,
    tags: azureItem.fields['System.Tags'] ? 
      azureItem.fields['System.Tags'].split(';').map((tag: string) => tag.trim()) : 
      [],
    createdDate: azureItem.fields['System.CreatedDate'] || null,
    changedDate: azureItem.fields['System.ChangedDate'] || null,
    parentId: undefined,
    children: [],
    relatedItems: [],
    isUserStory: azureItem.fields['System.WorkItemType'] === 'User Story',
    isTask: azureItem.fields['System.WorkItemType'] === 'Task',
    hasChildren: false,
    hasParent: false,
  };
}

function transformDatabaseWorkItem(dbWorkItem: any) {
  return {
    id: dbWorkItem.id, // Use internal database ID for embeddings
    title: dbWorkItem.title,
    description: dbWorkItem.description,
    workItemType: dbWorkItem.work_item_type,
    state: dbWorkItem.state,
    assignedTo: dbWorkItem.assigned_to,
    priority: dbWorkItem.priority,
    acceptanceCriteria: dbWorkItem.acceptance_criteria,
    tags: dbWorkItem.tags,
    createdDate: dbWorkItem.created_date,
    changedDate: dbWorkItem.changed_date,
    parentId: dbWorkItem.parent_work_item_id,
    children: [],
    relatedItems: [],
    isUserStory: dbWorkItem.work_item_type === 'User Story',
    isTask: dbWorkItem.work_item_type === 'Task',
    hasChildren: false,
    hasParent: false,
  };
} 