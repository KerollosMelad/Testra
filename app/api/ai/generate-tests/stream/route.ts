import { NextRequest, NextResponse } from "next/server";
import { createAITestGenerator } from "@/lib/ai-test-generator";
import { isProjectOpenAIConfigured } from "@/lib/openai";
import { TestGenerationContext, WorkItem, Project } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase";

interface GenerateTestsStreamRequest {
  projectId: string;
  workItemId: string;
  testType?: string;
  coverageLevel?: string;
  customRequirements?: string;
  temperature?: number;
  maxTokens?: number;
  chunkSize?: number;
  maxTokensPerChunk?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestData = validateAndParseRequest(body);
    
    // Get and validate project
    const project = await getProject(requestData.projectId);
    
    // Fetch work item and related data from database
    const { userStory, relatedTasks } = await fetchWorkItemDataFromDatabase(
      requestData.projectId, 
      requestData.workItemId, 
      requestData.testType || 'integration'
    );
    
    // Get existing test cases for context
    const existingTestCases = await getExistingTestCases(requestData.projectId);
    
    // Build test generation context
    const context = buildTestGenerationContext(
      project,
      userStory,
      relatedTasks,
      existingTestCases,
      requestData
    );
    
    // Return streaming response with timeout protection
    return new Response(
      new ReadableStream({
        async start(controller) {
          let streamTimeout: NodeJS.Timeout | null = null;
          let isStreamComplete = false;

          // Set up overall timeout for the stream (especially important for Vercel)
          const STREAM_TIMEOUT = 4 * 60 * 1000; // 4 minutes max for entire stream
          streamTimeout = setTimeout(() => {
            if (!isStreamComplete) {
              console.warn('Stream timeout reached, forcing completion');
              const timeoutData = JSON.stringify({
                type: 'error',
                data: {
                  error: 'Stream timeout reached. The generation process took too long.'
                }
              });
              controller.enqueue(`data: ${timeoutData}\n\n`);
              controller.close();
            }
          }, STREAM_TIMEOUT);

          try {
            const generator = createAITestGenerator(
              project.openaiApiKey,
              requestData.temperature ?? project.temperature,
              requestData.maxTokens ?? project.maxTokens
            );

            const streamOptions = {
              chunkSize: requestData.chunkSize || 3,
              maxTokensPerChunk: requestData.maxTokensPerChunk || 1500
            };

            // Send initial event
            const initialData = JSON.stringify({
              type: 'start',
              data: {
                totalChunks: 0,
                workItem: userStory.title,
                testType: requestData.testType,
                coverageLevel: requestData.coverageLevel
              }
            });
            controller.enqueue(`data: ${initialData}\n\n`);

            let allTestCases: any[] = [];
            let allSuggestions: string[] = [];
            let chunkCount = 0;
            let lastChunkTime = Date.now();

            for await (const result of generator.generateTestCasesStreaming(context, streamOptions)) {
              chunkCount++;
              lastChunkTime = Date.now();
              
              console.log(`Processing chunk ${chunkCount}: ${result.chunkId}, isComplete: ${result.isComplete}`);

              // Send chunk data
              const chunkData = JSON.stringify({
                type: 'chunk',
                data: {
                  chunkId: result.chunkId,
                  currentChunkIndex: result.currentChunkIndex,
                  totalChunks: result.totalChunks,
                  progress: result.progress,
                  acceptanceCriteria: result.acceptanceCriteria,
                  testCases: result.chunk.testCases,
                  suggestions: result.chunk.suggestions,
                  confidence: result.chunk.confidence,
                  isComplete: result.isComplete,
                  canPause: result.canPause
                }
              });
              controller.enqueue(`data: ${chunkData}\n\n`);

              // Accumulate results
              allTestCases = [...allTestCases, ...result.chunk.testCases];
              allSuggestions = [...allSuggestions, ...result.chunk.suggestions];

              // Small delay to ensure UI can keep up and prevent overwhelming the connection
              await new Promise(resolve => setTimeout(resolve, 200));

              if (result.isComplete) {
                console.log(`Stream completed after ${chunkCount} chunks`);
                // Send completion event
                const completeData = JSON.stringify({
                  type: 'complete',
                  data: {
                    totalTestCases: allTestCases.length,
                    totalSuggestions: allSuggestions.length,
                    finalConfidence: result.chunk.confidence
                  }
                });
                controller.enqueue(`data: ${completeData}\n\n`);
                isStreamComplete = true;
                break;
              }
            }

            // Safety check: if we've processed chunks but never got isComplete=true
            if (!isStreamComplete && chunkCount > 0) {
              console.warn(`Stream ended without completion flag after ${chunkCount} chunks`);
              const forceCompleteData = JSON.stringify({
                type: 'complete',
                data: {
                  totalTestCases: allTestCases.length,
                  totalSuggestions: allSuggestions.length,
                  finalConfidence: 0.8,
                  forced: true
                }
              });
              controller.enqueue(`data: ${forceCompleteData}\n\n`);
              isStreamComplete = true;
            }

          } catch (error) {
            console.error('Error in streaming generation:', error);
            const errorData = JSON.stringify({
              type: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Unknown error occurred'
              }
            });
            controller.enqueue(`data: ${errorData}\n\n`);
          } finally {
            if (streamTimeout) {
              clearTimeout(streamTimeout);
            }
            isStreamComplete = true;
            controller.close();
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

function validateAndParseRequest(body: any): GenerateTestsStreamRequest {
  const {
    projectId,
    workItemId,
    testType = "integration",
    coverageLevel = "basic",
    customRequirements,
    temperature = 0.7,
    maxTokens = 2000,
    chunkSize = 3,
    maxTokensPerChunk = 1500,
  } = body;

  if (!projectId || !workItemId) {
    throw new Error("Missing required parameters: projectId and workItemId");
  }

  return {
    projectId,
    workItemId,
    testType,
    coverageLevel,
    customRequirements,
    temperature,
    maxTokens,
    chunkSize,
    maxTokensPerChunk,
  };
}

async function getProject(projectId: string): Promise<Project> {
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error("Project not found");
  }

  // Transform snake_case to camelCase
  const transformedProject = {
    id: project.id,
    name: project.name,
    description: project.description,
    organization: project.organization,
    project: project.project,
    token: project.token,
    openaiApiKey: project.openai_api_key,
    aiModel: project.ai_model,
    temperature: project.temperature,
    maxTokens: project.max_tokens,
    autoGeneration: project.auto_generation,
    aiChat: project.ai_chat,
    codeGeneration: project.code_generation,
    createdAt: new Date(project.created_at),
    lastSync: project.last_sync ? new Date(project.last_sync) : undefined,
  };

  if (!isProjectOpenAIConfigured(transformedProject.openaiApiKey)) {
    throw new Error("OpenAI API key is not configured for this project. Please update the project settings with a valid OpenAI API key.");
  }

  return transformedProject;
}

async function fetchWorkItemDataFromDatabase(
  projectId: string, 
  workItemId: string, 
  testType: string
): Promise<{
  userStory: WorkItem;
  relatedTasks: WorkItem[];
}> {
  try {
    // Get the specific work item
    const { data: workItemData, error: workItemError } = await supabaseAdmin
      .from("work_items")
      .select("*")
      .eq("project_id", projectId)
      .eq("azure_id", workItemId)
      .single();

    if (workItemError || !workItemData) {
      throw new Error("Work item not found in database");
    }

    const userStory = transformDatabaseWorkItem(workItemData);

    // For story tests, focus only on the specific work item - skip related tasks
    if (testType === 'unit') {
      return { userStory, relatedTasks: [] };
    }

    // For integration tests, get related tasks (children of the user story)
    const { data: relatedTasksData, error: relatedTasksError } = await supabaseAdmin
      .from("work_items")
      .select("*")
      .eq("project_id", projectId)
      .eq("parent_id", workItemId);

    const relatedTasks = relatedTasksData 
      ? relatedTasksData.map(item => transformDatabaseWorkItem(item, workItemId))
      : [];

    return { userStory, relatedTasks };
  } catch (error) {
    console.error("Error fetching from database:", error);
    throw new Error("Failed to fetch work item details from database");
  }
}

function transformDatabaseWorkItem(dbWorkItem: any, parentId?: string): WorkItem {
  return {
    id: dbWorkItem.azure_id,
    title: dbWorkItem.title || "",
    description: dbWorkItem.description || "",
    workItemType: dbWorkItem.work_item_type || "",
    state: dbWorkItem.state || "",
    assignedTo: dbWorkItem.assigned_to || undefined,
    priority: dbWorkItem.priority || undefined,
    acceptanceCriteria: dbWorkItem.acceptance_criteria || undefined,
    tags: dbWorkItem.tags || [],
    createdDate: dbWorkItem.created_date || null,
    changedDate: dbWorkItem.changed_date || null,
    parentId: parentId,
    children: [],
    relatedItems: [],
    isUserStory: dbWorkItem.work_item_type === "User Story",
    isTask: dbWorkItem.work_item_type === "Task",
    hasChildren: false,
    hasParent: !!parentId,
  };
}

async function getExistingTestCases(projectId: string): Promise<any[]> {
  try {
    const { data: testCases, error } = await supabaseAdmin
      .from("test_cases")
      .select("*")
      .eq("project_id", projectId)
      .limit(10);

    if (error) {
      console.error("Error fetching existing test cases:", error);
      return [];
    }

    return testCases || [];
  } catch (error) {
    console.error("Error in getExistingTestCases:", error);
    return [];
  }
}

function buildTestGenerationContext(
  project: Project,
  userStory: WorkItem,
  relatedTasks: WorkItem[],
  existingTestCases: any[],
  requestData: GenerateTestsStreamRequest
): TestGenerationContext {
  return {
    project: {
      name: project.name,
      domain: project.description || undefined,
      businessRules: [], // TODO: Add business rules to project model
    },
    userStory,
    relatedTasks,
    existingTestCases,
    testType: requestData.testType as any,
    coverageLevel: requestData.coverageLevel as any,
    customRequirements: requestData.customRequirements,
  };
} 