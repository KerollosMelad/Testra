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
  testCases: TestCaseForDuplicateCheck[];
  similarityThreshold?: number;
  checkAgainstExistingOnly?: boolean; // Only check against saved test cases, not between new ones
}

export async function POST(request: NextRequest) {
  try {
    const body: DuplicateCheckRequest = await request.json();
    const { projectId, testCases, similarityThreshold = 0.95, checkAgainstExistingOnly = true } = body;

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

    // Create embedding service
    const embeddingService = createEmbeddingService(apiKey);

    // Check test cases for duplicates using vector embeddings
    const duplicateCheckResults = await embeddingService.checkTestCasesForDuplicates(
      testCases,
      projectId,
      similarityThreshold,
      checkAgainstExistingOnly
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
      similarityThreshold,
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