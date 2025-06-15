import { NextRequest, NextResponse } from 'next/server';
import { createEmbeddingService } from '@/lib/embedding-service';
import { supabaseAdmin } from '@/lib/supabase';

interface EmbedTestCasesRequest {
  projectId: string;
  force?: boolean; // Force re-embedding even if embeddings exist
}

export async function POST(request: NextRequest) {
  try {
    const body: EmbedTestCasesRequest = await request.json();
    const { projectId, force = false } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required field: projectId' },
        { status: 400 }
      );
    }

    // Get project and validate API key
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('openai_api_key, open_ai_key, name')
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

    // Get all test cases for the project
    const { data: testCases, error: testCasesError } = await supabaseAdmin
      .from('test_cases')
      .select('*')
      .eq('project_id', projectId);

    if (testCasesError) {
      console.error('Error fetching test cases:', testCasesError);
      return NextResponse.json(
        { error: 'Failed to fetch test cases' },
        { status: 500 }
      );
    }

    if (!testCases || testCases.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No test cases found in project to embed',
        projectId,
        projectName: project.name,
        statistics: {
          totalTestCases: 0,
          embeddingsCreated: 0,
          embeddingsSkipped: 0,
          errors: 0
        }
      });
    }

    // Create embedding service
    const embeddingService = createEmbeddingService(apiKey);

    let embeddingsCreated = 0;
    let embeddingsSkipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Process each test case
    for (const testCase of testCases) {
      try {
        // Check if embedding already exists and is up to date (unless force is true)
        if (!force) {
          const { data: existingEmbedding } = await supabaseAdmin
            .from('test_case_embeddings')
            .select('content_hash, updated_at')
            .eq('test_case_id', testCase.id)
            .single();

          if (existingEmbedding) {
            // Check if content has changed by comparing hashes
            const content = createTestCaseContent(testCase);
            const contentHash = createContentHash(content);
            
            if (existingEmbedding.content_hash === contentHash) {
              embeddingsSkipped++;
              continue;
            }
          }
        }

        // Convert database test case to proper format for embedding
        const formattedTestCase = {
          id: testCase.id,
          title: testCase.title,
          description: testCase.description,
          type: testCase.type as any,
          priority: testCase.priority as any,
          status: testCase.status as any,
          steps: Array.isArray(testCase.steps) ? testCase.steps : [],
          expectedResult: testCase.expected_result,
          preconditions: testCase.preconditions,
          testData: testCase.test_data,
          estimatedDuration: testCase.estimated_duration,
          projectId: testCase.project_id,
          createdAt: new Date(testCase.created_at),
          updatedAt: new Date(testCase.updated_at || testCase.created_at),
          generatedAt: testCase.generated_at ? new Date(testCase.generated_at) : undefined,
          generatedBy: testCase.generated_by as any,
          generatedCode: testCase.generated_code,
        };

        await embeddingService.embedTestCase(formattedTestCase);
        embeddingsCreated++;

      } catch (error) {
        console.error(`Error embedding test case ${testCase.id}:`, error);
        errors++;
        errorDetails.push(`Test case ${testCase.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Embedding process completed for project: ${project.name}`,
      projectId,
      projectName: project.name,
      statistics: {
        totalTestCases: testCases.length,
        embeddingsCreated,
        embeddingsSkipped,
        errors
      },
      errorDetails: errors > 0 ? errorDetails : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error embedding test cases:', error);
    return NextResponse.json(
      { 
        error: 'Failed to embed test cases',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to create test case content for embedding
function createTestCaseContent(testCase: any): string {
  const parts = [
    `Title: ${testCase.title}`,
    `Description: ${testCase.description}`,
    `Type: ${testCase.type}`,
    `Priority: ${testCase.priority}`,
    testCase.preconditions ? `Preconditions: ${testCase.preconditions}` : "",
    `Expected Result: ${testCase.expected_result}`,
    Array.isArray(testCase.steps) && testCase.steps.length > 0
      ? `Steps: ${testCase.steps
          .map(
            (step: any) =>
              `${step.step}. ${step.action} - Expected: ${step.expectedOutcome}`,
          )
          .join("\n")}`
      : "",
  ].filter(Boolean);

  return parts.join("\n");
}

// Helper function to create content hash
function createContentHash(content: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
} 