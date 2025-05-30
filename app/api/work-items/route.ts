import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface WorkItemRelation {
  parent_work_item_id: string;
  child_work_item_id: string;
  relation_type: string;
  parent_work_item?: {
    azure_id: string;
    title: string;
    work_item_type: string;
    state: string;
  }[];
  child_work_item?: {
    azure_id: string;
    title: string;
    work_item_type: string;
    state: string;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing required parameter: projectId' }, { status: 400 });
    }

    // Fetch work items from database
    const { data: workItems, error: workItemsError } = await supabaseAdmin
      .from('work_items')
      .select('*')
      .eq('project_id', projectId)
      .order('changed_date', { ascending: false });

    if (workItemsError) {
      console.error('Error fetching work items:', workItemsError);
      return NextResponse.json({ error: 'Failed to fetch work items' }, { status: 500 });
    }

    // Fetch work item relations to build parent-child relationships
    const workItemIds = workItems?.map(item => item.id) || [];
    let relations: WorkItemRelation[] = [];
    
    if (workItemIds.length > 0) {
      // Query for relations with both parent and child work items
      const { data: relationData, error: relationsError } = await supabaseAdmin
        .from('work_item_relations')
        .select(`
          parent_work_item_id,
          child_work_item_id,
          relation_type,
          parent_work_item:work_items!work_item_relations_parent_work_item_id_fkey(
            id,
            azure_id,
            title,
            work_item_type,
            state
          ),
          child_work_item:work_items!work_item_relations_child_work_item_id_fkey(
            id,
            azure_id,
            title,
            work_item_type,
            state
          )
        `)
        .or(`parent_work_item_id.in.(${workItemIds.join(',')}),child_work_item_id.in.(${workItemIds.join(',')})`)
        .eq('relation_type', 'parent');
      
      if (relationsError) {
        console.error('Error fetching relations:', relationsError);
      }
      
      relations = relationData || [];
    }

    // Transform the data to match the expected interface
    const transformedWorkItems = workItems?.map((item: any) => {
      // Get children where this item is the parent
      const children = relations
        .filter((rel) => rel.parent_work_item_id === item.id)
        .map((rel) => {
          const childWorkItem = Array.isArray(rel.child_work_item) ? rel.child_work_item[0] : rel.child_work_item;
          return {
            id: childWorkItem?.azure_id || '',
            relationType: rel.relation_type,
            workItemId: childWorkItem?.azure_id || '',
            title: childWorkItem?.title || '',
            workItemType: childWorkItem?.work_item_type || '',
            state: childWorkItem?.state || '',
          };
        });

      // Get parent where this item is the child
      const parentRelation = relations
        .find((rel) => rel.child_work_item_id === item.id);
      
      let parentId: string | null = null;
      if (parentRelation) {
        const parentWorkItem = Array.isArray(parentRelation.parent_work_item) 
          ? parentRelation.parent_work_item[0] 
          : parentRelation.parent_work_item;
        parentId = parentWorkItem?.azure_id || null;
      }

      return {
        id: item.azure_id,
        title: item.title,
        description: item.description || '',
        workItemType: item.work_item_type as 'User Story' | 'Task' | 'Bug' | 'Feature',
        state: item.state,
        assignedTo: item.assigned_to,
        priority: item.priority,
        acceptanceCriteria: item.acceptance_criteria,
        tags: Array.isArray(item.tags) ? item.tags : [],
        createdDate: item.created_date,
        changedDate: item.changed_date,
        lastSyncAt: item.last_sync_at,
        // Enhanced relationship data
        parentId,
        children,
        relatedItems: [], // We'll focus on parent-child relationships for now
        // Computed fields
        isUserStory: item.work_item_type === 'User Story',
        isTask: item.work_item_type === 'Task',
        hasChildren: children.length > 0,
        hasParent: !!parentId,
      };
    }) || [];

    return NextResponse.json({ 
      workItems: transformedWorkItems, 
      total: transformedWorkItems.length,
      summary: {
        userStories: transformedWorkItems.filter(item => item.isUserStory).length,
        tasks: transformedWorkItems.filter(item => item.isTask).length,
        bugs: transformedWorkItems.filter(item => item.workItemType === 'Bug').length,
        features: transformedWorkItems.filter(item => item.workItemType === 'Feature').length,
        withRelationships: transformedWorkItems.filter(item => item.hasChildren || item.hasParent).length,
      }
    });
  } catch (error) {
    console.error('Error fetching work items:', error);
    return NextResponse.json({ error: 'Failed to fetch work items from database' }, { status: 500 });
  }
} 