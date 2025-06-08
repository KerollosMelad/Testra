import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const workItemId = params.id;
    
    if (!workItemId) {
      return NextResponse.json(
        { error: "Work item ID is required" },
        { status: 400 }
      );
    }

    // Fetch work item from database
    const { data: workItem, error } = await supabaseAdmin
      .from("work_items")
      .select("*")
      .eq("azure_id", workItemId)
      .single();

    if (error) {
      console.error("Error fetching work item:", error);
      return NextResponse.json(
        { error: "Work item not found" },
        { status: 404 }
      );
    }

    if (!workItem) {
      return NextResponse.json(
        { error: "Work item not found" },
        { status: 404 }
      );
    }

    // Transform database work item to WorkItem format
    const transformedWorkItem = {
      id: workItem.azure_id,
      title: workItem.title,
      description: workItem.description || '',
      workItemType: workItem.work_item_type,
      state: workItem.state,
      assignedTo: workItem.assigned_to,
      priority: workItem.priority,
      acceptanceCriteria: workItem.acceptance_criteria,
      tags: workItem.tags || [],
      createdDate: workItem.created_date,
      changedDate: workItem.changed_date,
      parentId: workItem.parent_id,
      children: [],
      relatedItems: [],
      isUserStory: workItem.work_item_type === 'User Story',
      isTask: workItem.work_item_type === 'Task',
      hasChildren: false,
      hasParent: !!workItem.parent_id,
      lastSyncAt: workItem.updated_at,
    };

    return NextResponse.json({ workItem: transformedWorkItem });
  } catch (error) {
    console.error("Error in GET /api/work-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 