import { NextRequest, NextResponse } from 'next/server';
import { createEmbeddingService } from '@/lib/embedding-service';
import { supabaseAdmin } from '@/lib/supabase';

interface SearchRequest {
  projectId: string;
  query: string;
  type: 'work-items' | 'test-cases' | 'both';
  threshold?: number;
  limit?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchRequest = parseSearchParams(searchParams);

    // Get project and validate
    const project = await getProjectWithApiKey(searchRequest.projectId);
    
    // Create embedding service
    const embeddingService = createEmbeddingService(project.openai_api_key);

    // Perform searches based on type
    const searchResults = await performSearch(embeddingService, searchRequest);

    return NextResponse.json({
      success: true,
      query: searchRequest.query,
      type: searchRequest.type,
      threshold: searchRequest.threshold,
      projectId: searchRequest.projectId,
      results: searchResults,
      metadata: {
        totalResults: searchResults.totalCount,
        searchTime: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error performing vector search:', error);
    return handleSearchError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, apiKey, action } = body;

    if (!projectId || !apiKey) {
      return NextResponse.json({ 
        error: 'Missing required parameters: projectId and apiKey' 
      }, { status: 400 });
    }

    const embeddingService = createEmbeddingService(apiKey);

    switch (action) {
      case 'embed-work-items':
        await embeddingService.embedProjectWorkItems(projectId);
        return NextResponse.json({ 
          success: true, 
          message: 'Work items embedded successfully',
          action: 'embed-work-items'
        });

      case 'embed-test-cases':
        await embeddingService.embedProjectTestCases(projectId);
        return NextResponse.json({ 
          success: true, 
          message: 'Test cases embedded successfully',
          action: 'embed-test-cases'
        });

      case 'embed-all':
        await embeddingService.embedProjectWorkItems(projectId);
        await embeddingService.embedProjectTestCases(projectId);
        return NextResponse.json({ 
          success: true, 
          message: 'All items embedded successfully',
          action: 'embed-all'
        });

      case 'analyze-gaps':
        const analysis = await analyzeTestCoverage(embeddingService, projectId);
        return NextResponse.json({
          success: true,
          action: 'analyze-gaps',
          analysis
        });

      case 'check-status':
        const status = await checkEmbeddingStatus(projectId);
        return NextResponse.json({
          success: true,
          action: 'check-status',
          status
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported: embed-work-items, embed-test-cases, embed-all, analyze-gaps, check-status' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error processing embedding request:', error);
    return handleEmbeddingError(error);
  }
}

function parseSearchParams(searchParams: URLSearchParams): SearchRequest {
  const projectId = searchParams.get('projectId');
  const query = searchParams.get('query');
  const type = searchParams.get('type') || 'work-items';
  const threshold = parseFloat(searchParams.get('threshold') || '0.7');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!projectId || !query) {
    throw new Error('Missing required parameters: projectId and query');
  }

  if (!['work-items', 'test-cases', 'both'].includes(type)) {
    throw new Error('Type must be "work-items", "test-cases", or "both"');
  }

  return { projectId, query, type: type as any, threshold, limit };
}

async function getProjectWithApiKey(projectId: string) {
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('openai_api_key, name')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    throw new Error('Project not found');
  }

  if (!project.openai_api_key) {
    throw new Error('OpenAI API key not configured for this project');
  }

  return project;
}

async function performSearch(embeddingService: any, searchRequest: SearchRequest) {
  const { query, type, threshold, limit } = searchRequest;
  
  let workItemResults = [];
  let testCaseResults = [];
  
  try {
    if (type === 'work-items' || type === 'both') {
      workItemResults = await embeddingService.findSimilarWorkItems(query, threshold, limit);
    }
    
    if (type === 'test-cases' || type === 'both') {
      testCaseResults = await embeddingService.findSimilarTestCases(query, threshold, limit);
    }
    
    return {
      workItems: workItemResults,
      testCases: testCaseResults,
      totalCount: workItemResults.length + testCaseResults.length,
      byType: {
        workItems: workItemResults.length,
        testCases: testCaseResults.length,
      }
    };
  } catch (error) {
    console.error('Error in vector search:', error);
    throw new Error('Vector search failed. Ensure embeddings are created for this project.');
  }
}

async function analyzeTestCoverage(embeddingService: any, projectId: string) {
  const coverageGaps = await embeddingService.findCoverageGaps(projectId);
  
  const withDirectTests = coverageGaps.filter((gap: any) => gap.hasDirectTests);
  const withoutTests = coverageGaps.filter((gap: any) => !gap.hasDirectTests && gap.similarTestCount === 0);
  const withSimilarOnly = coverageGaps.filter((gap: any) => !gap.hasDirectTests && gap.similarTestCount > 0);
  
  return {
    total: coverageGaps.length,
    withDirectTests: withDirectTests.length,
    withoutTests: withoutTests.length,
    withSimilarOnly: withSimilarOnly.length,
    coverageRate: coverageGaps.length > 0 ? (withDirectTests.length / coverageGaps.length) * 100 : 0,
    gaps: coverageGaps,
    highPriorityGaps: withoutTests
      .filter((gap: any) => gap.workItemType === 'Feature' || gap.workItemType === 'User Story')
      .slice(0, 10),
    summary: {
      covered: withDirectTests.length,
      partialCoverage: withSimilarOnly.length,
      uncovered: withoutTests.length,
      recommendations: generateCoverageRecommendations(withoutTests, withSimilarOnly)
    }
  };
}

async function checkEmbeddingStatus(projectId: string) {
  try {
    // Check work item embeddings
    const { data: workItemEmbeddings, error: wiError } = await supabaseAdmin
      .from('work_item_embeddings')
      .select('work_item_id, updated_at')
      .eq('work_item_id', projectId);
    
    // Check test case embeddings 
    const { data: testCaseEmbeddings, error: tcError } = await supabaseAdmin
      .from('test_case_embeddings')
      .select('test_case_id, updated_at')
      .eq('test_case_id', projectId);

    const workItemsEmbedded = workItemEmbeddings?.length || 0;
    const testCasesEmbedded = testCaseEmbeddings?.length || 0;
    
    return {
      workItemsEmbedded,
      testCasesEmbedded,
      totalEmbedded: workItemsEmbedded + testCasesEmbedded,
      lastUpdated: getLatestUpdate(workItemEmbeddings, testCaseEmbeddings),
      isReady: workItemsEmbedded > 0 || testCasesEmbedded > 0,
    };
  } catch (error) {
    console.error('Error checking embedding status:', error);
    return {
      workItemsEmbedded: 0,
      testCasesEmbedded: 0,
      totalEmbedded: 0,
      lastUpdated: null,
      isReady: false,
      error: 'Failed to check embedding status'
    };
  }
}

function generateCoverageRecommendations(uncovered: any[], partialCoverage: any[]): string[] {
  const recommendations = [];
  
  if (uncovered.length > 0) {
    recommendations.push(`${uncovered.length} work items have no test coverage and should be prioritized`);
  }
  
  if (partialCoverage.length > 0) {
    recommendations.push(`${partialCoverage.length} work items have similar tests but may need direct test coverage`);
  }
  
  const highPriorityUncovered = uncovered.filter((item: any) => 
    item.workItemType === 'Feature' || item.workItemType === 'User Story'
  );
  
  if (highPriorityUncovered.length > 0) {
    recommendations.push(`Focus on ${highPriorityUncovered.length} high-priority Features and User Stories first`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Great! All work items have test coverage');
  }
  
  return recommendations;
}

function getLatestUpdate(workItemEmbeddings: any[] | null, testCaseEmbeddings: any[] | null): string | null {
  const allUpdates = [
    ...(workItemEmbeddings || []).map(e => e.updated_at),
    ...(testCaseEmbeddings || []).map(e => e.updated_at)
  ].filter(Boolean);
  
  if (allUpdates.length === 0) return null;
  
  return allUpdates.sort().reverse()[0];
}

function handleSearchError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    if (error.message.includes('API key')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    if (error.message.includes('Missing required parameters')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    error: 'Failed to perform vector search' 
  }, { status: 500 });
}

function handleEmbeddingError(error: unknown): NextResponse {
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    error: 'Failed to process embedding request' 
  }, { status: 500 });
} 