import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
      .select(`
        *,
        parent_relations:work_item_relations!parent_work_item_id(
          id,
          child_work_item_id,
          relation_type,
          child_work_item:work_items!child_work_item_id(
            id,
            azure_id,
            title,
            work_item_type,
            state
          )
        ),
        child_relations:work_item_relations!child_work_item_id(
          id,
          parent_work_item_id,
          relation_type,
          parent_work_item:work_items!parent_work_item_id(
            id,
            azure_id,
            title,
            work_item_type,
            state
          )
        )
      `)
      .eq('project_id', projectId)
      .order('changed_date', { ascending: false });

    if (workItemsError) {
      console.error('Error fetching work items:', workItemsError);
      return NextResponse.json({ error: 'Failed to fetch work items' }, { status: 500 });
    }

    // Transform the data to match the expected interface
    const transformedWorkItems = workItems?.map((item: any) => {
      const children = item.parent_relations?.map((rel: any) => ({
        id: rel.child_work_item.azure_id,
        relationType: rel.relation_type,
        workItemId: rel.child_work_item.azure_id,
        title: rel.child_work_item.title,
        workItemType: rel.child_work_item.work_item_type,
        state: rel.child_work_item.state,
      })) || [];

      const relatedItems = item.child_relations?.map((rel: any) => ({
        id: rel.parent_work_item.azure_id,
        relationType: rel.relation_type,
        workItemId: rel.parent_work_item.azure_id,
        title: rel.parent_work_item.title,
        workItemType: rel.parent_work_item.work_item_type,
        state: rel.parent_work_item.state,
      })) || [];

      const parentId = item.child_relations?.find((rel: any) => rel.relation_type === 'parent')?.parent_work_item?.azure_id;

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
        relatedItems,
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