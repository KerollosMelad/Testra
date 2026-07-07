import { NextRequest, NextResponse } from 'next/server';
import { createEmbeddingService } from '@/lib/embedding-service';
import { supabaseAdmin } from '@/lib/supabase';

interface TestCaseForDuplicateCheck {
  id?: string;
  title: string;
  description: string;
  type: 'unit' | 'integration';
  priority: 'low' | 'medium' | 'high';
  steps: Array<{
    step: number;
    action: string;
    expectedOutcome: string;
    testData?: any;
  }>;
  expectedResult: string;
  preconditions?: string;
}

interface DuplicateCheckRequest {
  projectId: string;
  workItemId?: string; // Optional work item ID to scope duplicate checking to specific work item
  testCases: TestCaseForDuplicateCheck[];
  similarityThreshold?: number;
  checkAgainstExistingOnly?: boolean; // Only check against saved test cases, not between new ones
}

export async function POST(request: NextRequest) {
  try {
    const body: DuplicateCheckRequest = await request.json();
    const { projectId, workItemId, testCases, similarityThreshold = 0.97, checkAgainstExistingOnly = true } = body;

    if (!projectId || !testCases || !Array.isArray(testCases)) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, testCases' },
        { status: 400 }
      );
    }

    // Get project and validate API key
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('openai_api_key, open_ai_key')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    const apiKey = project.openai_api_key || project.open_ai_key;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured for this project' },
        { status: 400 }
      );
    }

    // PERFORMANCE OPTIMIZATION: Check if there are any existing test cases before creating embedding service
    // This avoids expensive OpenAI API calls and embedding operations when there's nothing to compare against
    console.log(`Duplicate check requested for ${testCases.length} test cases (workItem: ${workItemId || 'none'}, project: ${projectId})`);
    
    let hasExistingTestCases = false;
    
    if (workItemId) {
      // Quick check for work item test cases
      const { data: workItemRelations, error } = await supabaseAdmin
        .from('test_case_work_item_relations')
        .select('test_case_id')
        .eq('work_item_id', workItemId)
        .limit(1);
      
      hasExistingTestCases = !error && workItemRelations && workItemRelations.length > 0;
    } else {
      // Quick check for project test cases
      const { data: projectTestCases, error } = await supabaseAdmin
        .from('test_cases')
        .select('id')
        .eq('project_id', projectId)
        .limit(1);
      
      hasExistingTestCases = !error && projectTestCases && projectTestCases.length > 0;
    }
    
    // If no existing test cases, return all as non-duplicates without expensive embedding operations
    if (!hasExistingTestCases) {
      console.log('No existing test cases found. Skipping duplicate detection entirely.');
      
      const results = testCases.map((testCase, index) => ({
        originalIndex: index,
        testCase,
        isDuplicate: false,
        duplicateType: 'none' as const,
      }));

      return NextResponse.json({
        success: true,
        projectId,
        workItemId,
        similarityThreshold,
        optimized: true, // Indicate this was optimized
        statistics: {
          totalChecked: testCases.length,
          duplicatesFound: 0,
          exactDuplicates: 0,
          semanticDuplicates: 0,
          uniqueTestCases: testCases.length,
        },
        results,
        timestamp: new Date().toISOString(),
      });
    }

    console.log('Existing test cases found. Proceeding with full duplicate detection.');

    // Create embedding service
    const embeddingService = createEmbeddingService(apiKey);

    // Check test cases for duplicates using vector embeddings (scoped to work item if provided)
    const duplicateCheckResults = await embeddingService.checkTestCasesForDuplicates(
      testCases,
      projectId,
      similarityThreshold,
      checkAgainstExistingOnly,
      workItemId
    );

    // Format results for response
    const results = duplicateCheckResults.map((result, index) => ({
      originalIndex: index,
      testCase: result.testCase,
      isDuplicate: result.isDuplicate,
      duplicateOf: result.duplicateOf,
      similarityScore: result.similarityScore,
      duplicateType: result.duplicateType,
    }));

    // Calculate statistics
    const totalChecked = results.length;
    const duplicatesFound = results.filter(r => r.isDuplicate).length;
    const exactDuplicates = results.filter(r => r.duplicateType === 'exact').length;
    const semanticDuplicates = results.filter(r => r.duplicateType === 'semantic').length;

    return NextResponse.json({
      success: true,
      projectId,
      workItemId,
      similarityThreshold,
      optimized: false, // Indicate this was full duplicate detection
      statistics: {
        totalChecked,
        duplicatesFound,
        exactDuplicates,
        semanticDuplicates,
        uniqueTestCases: totalChecked - duplicatesFound,
      },
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error checking test case duplicates:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check test case duplicates',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 