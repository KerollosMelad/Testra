import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: testCaseId } = await params;

    if (!testCaseId) {
      return NextResponse.json(
        { error: 'Test case ID is required' },
        { status: 400 }
      );
    }

    // Get the test case details first
    const { data: testCase, error: fetchError } = await supabaseAdmin
      .from('test_cases')
      .select('*')
      .eq('id', testCaseId)
      .single();

    if (fetchError || !testCase) {
      return NextResponse.json(
        { error: 'Test case not found' },
        { status: 404 }
      );
    }

    // Get project details for Azure DevOps connection
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', testCase.project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete from Azure DevOps if we have the azure_id
    if (testCase.azure_id && project.organization && project.project && project.pat) {
      try {
        await deleteTestCaseFromAzure(project, testCase.azure_id);
      } catch (azureError) {
        console.error('Failed to delete from Azure DevOps:', azureError);
        // Continue with database deletion even if Azure deletion fails
      }
    }

    // Delete test case work item relations
    const { error: relationsError } = await supabaseAdmin
      .from('test_case_work_item_relations')
      .delete()
      .eq('test_case_id', testCaseId);

    if (relationsError) {
      console.error('Error deleting test case relations:', relationsError);
    }

    // Delete embeddings if they exist
    const { error: embeddingsError } = await supabaseAdmin
      .from('test_case_embeddings')
      .delete()
      .eq('test_case_id', testCaseId);

    if (embeddingsError) {
      console.error('Error deleting test case embeddings:', embeddingsError);
    }

    // Delete the test case from database
    const { error: deleteError } = await supabaseAdmin
      .from('test_cases')
      .delete()
      .eq('id', testCaseId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Test case deleted successfully',
      testCaseId,
      title: testCase.title
    });

  } catch (error) {
    console.error('Error deleting test case:', error);
    return NextResponse.json(
      { error: 'Failed to delete test case' },
      { status: 500 }
    );
  }
}

async function deleteTestCaseFromAzure(project: any, azureTestCaseId: string) {
  const authToken = Buffer.from(`:${project.pat}`).toString('base64');
  
  const deleteUrl = `https://dev.azure.com/${project.organization}/${project.project}/_apis/wit/workitems/${azureTestCaseId}?api-version=7.0`;
  
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure DevOps API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
} 