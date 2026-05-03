import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get all test cases for this project with work item information
    const { data: testCases, error } = await supabaseAdmin
      .from('test_cases')
      .select(`
        *,
        test_case_work_item_relations!inner(
          work_item_id,
          work_items!inner(
            azure_id,
            title,
            work_item_type,
            state
          )
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching test cases:', error);
      return NextResponse.json(
        { error: 'Failed to fetch test cases' },
        { status: 500 }
      );
    }

    // Transform to match the expected format with work item details
    const transformedTestCases = testCases?.map(tc => ({
      id: tc.id,
      title: tc.title,
      description: tc.description,
      type: tc.type.toLowerCase(),
      priority: tc.priority.toLowerCase(),
      status: tc.status,
      steps: tc.steps || [],
      expectedResult: tc.expected_result,
      preconditions: tc.preconditions,
      estimatedDuration: tc.estimated_duration,
      contentHash: tc.content_hash,
      createdAt: tc.created_at,
      generatedAt: tc.generated_at,
      generatedBy: tc.generated_by,
      generatedCode: tc.generated_code,
      azureId: tc.azure_id,
      // Work item details from the relation
      workItem: tc.test_case_work_item_relations[0]?.work_items ? {
        id: tc.test_case_work_item_relations[0].work_items.azure_id,
        title: tc.test_case_work_item_relations[0].work_items.title,
        type: tc.test_case_work_item_relations[0].work_items.work_item_type,
        state: tc.test_case_work_item_relations[0].work_items.state
      } : null
    })) || [];

    return NextResponse.json({
      success: true,
      testCases: transformedTestCases,
      total: transformedTestCases.length
    });

  } catch (error) {
    console.error('Error in project test cases API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 