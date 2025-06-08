import { NextRequest, NextResponse } from "next/server";
import { createAITestGenerator } from "@/lib/ai-test-generator";
import { isProjectOpenAIConfigured } from "@/lib/openai";
import { TestGenerationContext, WorkItem, Project } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase";
import { htmlAcceptanceCriteriaToText, cleanUserStoryDescription } from '@/lib/html-to-text';

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
    
    // Fetch work item and related data from Azure DevOps
    const { userStory, relatedTasks } = await fetchWorkItemData(project, requestData.workItemId);
    
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
    
    // Return streaming response
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            const generator = createAITestGenerator(
              project.openaiApiKey,
              requestData.temperature ?? project.temperature,
              requestData.maxTokens ?? project.maxTokens
            );

            const streamOptions = {
              chunkSize: requestData.chunkSize || 3,
              maxTokensPerChunk: requestData.maxTokensPerChunk || 1500,
              enablePause: true,
              enableStreaming: true
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

            for await (const result of generator.generateTestCasesStreaming(context, streamOptions)) {
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

              // Small delay to ensure UI can keep up
              await new Promise(resolve => setTimeout(resolve, 100));

              if (result.isComplete) {
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
                break;
              }
            }

          } catch (error) {
            const errorData = JSON.stringify({
              type: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Unknown error occurred'
              }
            });
            controller.enqueue(`data: ${errorData}\n\n`);
          } finally {
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

async function fetchWorkItemData(project: Project, workItemId: string): Promise<{
  userStory: WorkItem;
  relatedTasks: WorkItem[];
}> {
  try {
    // Get all work items from Azure DevOps
    const workItems = await fetchWorkItemsFromAzure(project);
    
    // Find the specific work item
    const userStory = findWorkItem(workItems, workItemId);
    
    // Find related tasks (children of the user story)
    const relatedTasks = findRelatedTasks(workItems, workItemId);
    
    return { userStory, relatedTasks };
  } catch (error) {
    console.error("Error fetching from Azure DevOps:", error);
    throw new Error("Failed to fetch work item details from Azure DevOps");
  }
}

async function fetchWorkItemsFromAzure(project: Project): Promise<any[]> {
  // Build WIQL query
  const wiqlQuery = {
    query: `
      SELECT [System.Id], [System.Title], [System.Description], [System.WorkItemType], 
             [System.State], [System.AssignedTo], [Microsoft.VSTS.Common.Priority], 
             [Microsoft.VSTS.Common.AcceptanceCriteria], [System.Tags], 
             [System.CreatedDate], [System.ChangedDate], [System.Parent]
      FROM WorkItems 
      WHERE [System.TeamProject] = '${project.project}' 
      AND [System.WorkItemType] IN ('User Story', 'Task', 'Bug', 'Feature')
      ORDER BY [System.ChangedDate] DESC
    `,
  };

  // Execute WIQL query
  const wiqlUrl = `https://dev.azure.com/${project.organization}/${project.project}/_apis/wit/wiql?api-version=7.0`;
  const wiqlResponse = await fetchFromAzure(wiqlUrl, project.token, {
    method: "POST",
    body: JSON.stringify(wiqlQuery),
  });

  const wiqlResult = await wiqlResponse.json();
  const workItemIds = wiqlResult.workItems?.map((item: any) => item.id) || [];

  if (workItemIds.length === 0) {
    throw new Error("No work items found in the project");
  }

  // Fetch detailed work item information
  const batchUrl = `https://dev.azure.com/${project.organization}/_apis/wit/workitems?ids=${workItemIds.join(",")}&$expand=relations&api-version=7.0`;
  const batchResponse = await fetchFromAzure(batchUrl, project.token);
  const batchResult = await batchResponse.json();

  return batchResult.value || [];
}

async function fetchFromAzure(url: string, token: string, options: any = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: "Basic " + Buffer.from(":" + token).toString("base64"),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Azure DevOps API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

function findWorkItem(workItems: any[], workItemId: string): WorkItem {
  const workItem = workItems.find((item: any) => item.id.toString() === workItemId);
  
  if (!workItem) {
    throw new Error("Work item not found");
  }

  return transformWorkItem(workItem);
}

function findRelatedTasks(workItems: any[], workItemId: string): WorkItem[] {
  return workItems
    .filter((item: any) => {
      // Check if this item has a parent relationship to our work item
      if (item.relations) {
        return item.relations.some(
          (relation: any) =>
            relation.rel.includes("Parent") &&
            relation.url.includes(`workItems/${workItemId}`)
        );
      }
      return false;
    })
    .map((item: any) => transformWorkItem(item, workItemId));
}

function transformWorkItem(azureWorkItem: any, parentId?: string): WorkItem {
  return {
    id: azureWorkItem.id.toString(),
    title: azureWorkItem.fields["System.Title"] || "",
    description: cleanUserStoryDescription(azureWorkItem.fields["System.Description"]) || "",
    workItemType: azureWorkItem.fields["System.WorkItemType"] || "",
    state: azureWorkItem.fields["System.State"] || "",
    assignedTo: azureWorkItem.fields["System.AssignedTo"]?.displayName || undefined,
    priority: azureWorkItem.fields["Microsoft.VSTS.Common.Priority"] || undefined,
    acceptanceCriteria: htmlAcceptanceCriteriaToText(azureWorkItem.fields["Microsoft.VSTS.Common.AcceptanceCriteria"]) || undefined,
    tags: azureWorkItem.fields["System.Tags"]
      ? azureWorkItem.fields["System.Tags"]
          .split(";")
          .map((tag: string) => tag.trim())
      : [],
    createdDate: azureWorkItem.fields["System.CreatedDate"] || null,
    changedDate: azureWorkItem.fields["System.ChangedDate"] || null,
    parentId: parentId,
    children: [],
    relatedItems: [],
    isUserStory: azureWorkItem.fields["System.WorkItemType"] === "User Story",
    isTask: azureWorkItem.fields["System.WorkItemType"] === "Task",
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