import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workItemId } = await params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get existing test cases for this work item from the database
    // These are test cases that have been saved to the database (and presumably to Azure DevOps)
    const { data: testCases, error } = await supabaseAdmin
      .from('test_cases')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching test cases:', error);
      return NextResponse.json(
        { error: 'Failed to fetch test cases' },
        { status: 500 }
      );
    }

    // Transform to match the expected format
    const transformedTestCases = testCases?.map(tc => ({
      id: tc.id,
      title: tc.title,
      description: tc.description,
      type: tc.type,
      priority: tc.priority,
      status: tc.status,
      steps: tc.steps || [],
      expectedResult: tc.expected_result,
      preconditions: tc.preconditions,
      estimatedDuration: tc.estimated_duration,
      contentHash: tc.content_hash,
      createdAt: tc.created_at
    })) || [];

    return NextResponse.json({
      success: true,
      testCases: transformedTestCases
    });

  } catch (error) {
    console.error('Error in test cases API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 