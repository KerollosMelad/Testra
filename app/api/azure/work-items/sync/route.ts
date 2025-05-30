import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, organization, project, pat } = body;

    if (!projectId || !organization || !project || !pat) {
      return NextResponse.json({ 
        error: 'Missing required parameters: projectId, organization, project, pat' 
      }, { status: 400 });
    }

    // Fetch work items from Azure DevOps (reusing the existing logic)
    const wiqlQuery = {
      query: `
        SELECT [System.Id], [System.Title], [System.Description], [System.WorkItemType], 
               [System.State], [System.AssignedTo], [Microsoft.VSTS.Common.Priority], 
               [Microsoft.VSTS.Common.AcceptanceCriteria], [System.Tags], 
               [System.CreatedDate], [System.ChangedDate], [System.Parent]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${project}' 
        AND [System.WorkItemType] IN ('User Story', 'Task', 'Bug', 'Feature')
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
        updated: 0
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
    const workItemRelations: Array<{
      parentAzureId: string;
      childAzureId: string;
      relationType: string;
    }> = [];

    // Process each work item
    for (const item of batchResult.value || []) {
      const azureId = item.id.toString();
      const workItemData = {
        azure_id: azureId,
        title: item.fields['System.Title'] || '',
        description: item.fields['System.Description'] || null,
        work_item_type: item.fields['System.WorkItemType'] || '',
        state: item.fields['System.State'] || '',
        assigned_to: item.fields['System.AssignedTo']?.displayName || null,
        priority: item.fields['Microsoft.VSTS.Common.Priority'] || null,
        acceptance_criteria: item.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || null,
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
        .select('id, azure_id, changed_date')
        .eq('azure_id', azureId)
        .single();

      if (existingWorkItem) {
        // Update existing work item if it has changed
        const existingChangedDate = new Date(existingWorkItem.changed_date || 0);
        const newChangedDate = new Date(workItemData.changed_date || 0);
        
        if (newChangedDate > existingChangedDate) {
          await supabaseAdmin
            .from('work_items')
            .update(workItemData)
            .eq('azure_id', azureId);
          updatedCount++;
        }
      } else {
        // Insert new work item
        await supabaseAdmin
          .from('work_items')
          .insert(workItemData);
        syncedCount++;
      }

      // Process relations
      if (item.relations) {
        for (const relation of item.relations) {
          const relatedWorkItemId = extractWorkItemId(relation.url);
          if (relatedWorkItemId && workItemIds.includes(parseInt(relatedWorkItemId))) {
            const relationType = relation.rel.includes('Parent') ? 'parent' :
                               relation.rel.includes('Child') ? 'child' :
                               relation.rel.includes('Predecessor') ? 'predecessor' :
                               relation.rel.includes('Successor') ? 'successor' : 'related';

            if (relationType === 'child') {
              workItemRelations.push({
                parentAzureId: azureId,
                childAzureId: relatedWorkItemId,
                relationType: 'parent'
              });
            }
          }
        }
      }
    }

    // Sync work item relations
    for (const relation of workItemRelations) {
      // Get the internal IDs for the work items
      const { data: parentWorkItem } = await supabaseAdmin
        .from('work_items')
        .select('id')
        .eq('azure_id', relation.parentAzureId)
        .single();

      const { data: childWorkItem } = await supabaseAdmin
        .from('work_items')
        .select('id')
        .eq('azure_id', relation.childAzureId)
        .single();

      if (parentWorkItem && childWorkItem) {
        // Check if relation already exists
        const { data: existingRelation } = await supabaseAdmin
          .from('work_item_relations')
          .select('id')
          .eq('parent_work_item_id', parentWorkItem.id)
          .eq('child_work_item_id', childWorkItem.id)
          .eq('relation_type', relation.relationType)
          .single();

        if (!existingRelation) {
          await supabaseAdmin
            .from('work_item_relations')
            .insert({
              parent_work_item_id: parentWorkItem.id,
              child_work_item_id: childWorkItem.id,
              relation_type: relation.relationType,
            });
        }
      }
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
      relationsProcessed: workItemRelations.length
    });

  } catch (error) {
    console.error('Error syncing work items:', error);
    return NextResponse.json({ 
      error: 'Failed to sync work items from Azure DevOps' 
    }, { status: 500 });
  }
} 