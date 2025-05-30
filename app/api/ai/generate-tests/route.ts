import { NextRequest, NextResponse } from "next/server";
import { createAITestGenerator } from "@/lib/ai-test-generator";
import { isProjectOpenAIConfigured } from "@/lib/openai";
import { TestGenerationContext, WorkItem } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      workItemId,
      testType = "integration",
      coverageLevel = "basic",
      customRequirements,
      aiModel = "gpt-4",
      temperature = 0.7,
      maxTokens = 2000,
    } = body;

    if (!projectId || !workItemId) {
      return NextResponse.json(
        { error: "Missing required parameters: projectId and workItemId" },
        { status: 400 },
      );
    }

    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Transform the snake_case fields back to camelCase
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

    // Check if project has OpenAI API key configured
    if (!isProjectOpenAIConfigured(transformedProject.openaiApiKey)) {
      return NextResponse.json(
        {
          error: "OpenAI API key is not configured for this project. Please update the project settings with a valid OpenAI API key.",
        },
        { status: 400 },
      );
    }

    // Fetch work item details directly from Azure DevOps API
    let transformedUserStory;
    let relatedTasks;

    try {
      // WIQL query to get work items
      const wiqlQuery = {
        query: `
          SELECT [System.Id], [System.Title], [System.Description], [System.WorkItemType], 
                 [System.State], [System.AssignedTo], [Microsoft.VSTS.Common.Priority], 
                 [Microsoft.VSTS.Common.AcceptanceCriteria], [System.Tags], 
                 [System.CreatedDate], [System.ChangedDate], [System.Parent]
          FROM WorkItems 
          WHERE [System.TeamProject] = '${transformedProject.project}' 
          AND [System.WorkItemType] IN ('User Story', 'Task', 'Bug', 'Feature')
          ORDER BY [System.ChangedDate] DESC
        `,
      };

      // Execute WIQL query
      const wiqlUrl = `https://dev.azure.com/${transformedProject.organization}/${transformedProject.project}/_apis/wit/wiql?api-version=7.0`;
      const wiqlResponse = await fetch(wiqlUrl, {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(":" + transformedProject.token).toString("base64"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wiqlQuery),
      });

      if (!wiqlResponse.ok) {
        throw new Error("Failed to execute WIQL query");
      }

      const wiqlResult = await wiqlResponse.json();
      const workItemIds =
        wiqlResult.workItems?.map((item: any) => item.id) || [];

      if (workItemIds.length === 0) {
        return NextResponse.json(
          { error: "No work items found in the project" },
          { status: 404 },
        );
      }

      // Fetch detailed work item information
      const batchUrl = `https://dev.azure.com/${transformedProject.organization}/_apis/wit/workitems?ids=${workItemIds.join(",")}&$expand=relations&api-version=7.0`;
      const batchResponse = await fetch(batchUrl, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(":" + transformedProject.token).toString("base64"),
          "Content-Type": "application/json",
        },
      });

      if (!batchResponse.ok) {
        throw new Error("Failed to fetch work item details");
      }

      const batchResult = await batchResponse.json();

      // Find the specific work item
      const userStory = batchResult.value?.find(
        (item: any) => item.id.toString() === workItemId,
      );

      if (!userStory) {
        return NextResponse.json(
          { error: "Work item not found" },
          { status: 404 },
        );
      }

      // Transform to our WorkItem format
      transformedUserStory = {
        id: userStory.id.toString(),
        title: userStory.fields["System.Title"] || "",
        description: userStory.fields["System.Description"] || "",
        workItemType: userStory.fields["System.WorkItemType"] || "",
        state: userStory.fields["System.State"] || "",
        assignedTo:
          userStory.fields["System.AssignedTo"]?.displayName || undefined,
        priority:
          userStory.fields["Microsoft.VSTS.Common.Priority"] || undefined,
        acceptanceCriteria:
          userStory.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] ||
          undefined,
        tags: userStory.fields["System.Tags"]
          ? userStory.fields["System.Tags"]
              .split(";")
              .map((tag: string) => tag.trim())
          : [],
        createdDate: userStory.fields["System.CreatedDate"] || null,
        changedDate: userStory.fields["System.ChangedDate"] || null,
        parentId: undefined,
        children: [],
        relatedItems: [],
        isUserStory: userStory.fields["System.WorkItemType"] === "User Story",
        isTask: userStory.fields["System.WorkItemType"] === "Task",
        hasChildren: false,
        hasParent: false,
      };

      // Get related tasks (children of the user story)
      relatedTasks =
        batchResult.value
          ?.filter((item: any) => {
            // Check if this item has a parent relationship to our work item
            if (item.relations) {
              return item.relations.some(
                (relation: any) =>
                  relation.rel.includes("Parent") &&
                  relation.url.includes(`workItems/${workItemId}`),
              );
            }
            return false;
          })
          .map((item: any) => ({
            id: item.id.toString(),
            title: item.fields["System.Title"] || "",
            description: item.fields["System.Description"] || "",
            workItemType: item.fields["System.WorkItemType"] || "",
            state: item.fields["System.State"] || "",
            assignedTo:
              item.fields["System.AssignedTo"]?.displayName || undefined,
            priority:
              item.fields["Microsoft.VSTS.Common.Priority"] || undefined,
            acceptanceCriteria:
              item.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] ||
              undefined,
            tags: item.fields["System.Tags"]
              ? item.fields["System.Tags"]
                  .split(";")
                  .map((tag: string) => tag.trim())
              : [],
            createdDate: item.fields["System.CreatedDate"] || null,
            changedDate: item.fields["System.ChangedDate"] || null,
            parentId: workItemId,
            children: [],
            relatedItems: [],
            isUserStory: item.fields["System.WorkItemType"] === "User Story",
            isTask: item.fields["System.WorkItemType"] === "Task",
            hasChildren: false,
            hasParent: true,
          })) || [];
    } catch (azureError) {
      console.error("Error fetching from Azure DevOps:", azureError);
      return NextResponse.json(
        { error: "Failed to fetch work item details from Azure DevOps" },
        { status: 500 },
      );
    }

    // Get existing test cases for this project (placeholder - you'll need to implement test case storage)
    const existingTestCases: any[] = []; // TODO: Implement test case retrieval from database

    // Build test generation context
    const context: TestGenerationContext = {
      project: {
        name: transformedProject.name,
        domain: transformedProject.description || undefined,
        businessRules: [], // TODO: Add business rules to project model
      },
      userStory: transformedUserStory,
      relatedTasks,
      existingTestCases,
      testType,
      coverageLevel,
      customRequirements,
    };

    // Create AI test generator with project settings
    const selectedModel =
      aiModel || transformedProject.aiModel || "gpt-3.5-turbo";
    console.log("Selected AI model:", selectedModel);
    console.log("Project AI model:", transformedProject.aiModel);
    console.log("Request AI model:", aiModel);

    const generator = createAITestGenerator(
      transformedProject.openaiApiKey,
      selectedModel,
      temperature ?? transformedProject.temperature,
      maxTokens ?? transformedProject.maxTokens,
    );

    // Generate test cases
    const result = await generator.generateTestCases(context);

    // Return the generated test cases
    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        projectId,
        workItemId,
        testType,
        coverageLevel,
        generatedAt: new Date().toISOString(),
        model: aiModel || transformedProject.aiModel,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    console.error("Error generating test cases:", error);

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "Invalid OpenAI API key. Please check your configuration." },
          { status: 401 },
        );
      }
      if (error.message.includes("quota")) {
        return NextResponse.json(
          {
            error: "OpenAI API quota exceeded. Please check your usage limits.",
          },
          { status: 429 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate test cases. Please try again." },
      { status: 500 },
    );
  }
}

// GET endpoint to check AI configuration status
export async function GET() {
  try {
    return NextResponse.json({
      configured: true,
      message: "AI test generation is available. Each project must have its own OpenAI API key configured.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check AI configuration" },
      { status: 500 },
    );
  }
}
