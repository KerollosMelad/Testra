import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      organization,
      project,
      token,
      openaiApiKey,
      aiModel,
      temperature,
      maxTokens,
      autoGeneration,
      aiChat,
      codeGeneration,
      workItemTypes,
    } = body;

    if (
      !name ||
      !organization ||
      !project ||
      !token ||
      !openaiApiKey ||
      !aiModel
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if project exists
    const { data: existing } = await supabaseAdmin
      .from("projects")
      .select()
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("projects")
      .update({
        name,
        description,
        organization,
        project,
        token,
        openai_api_key: openaiApiKey,
        ai_model: aiModel,
        temperature,
        max_tokens: maxTokens,
        auto_generation: autoGeneration,
        ai_chat: aiChat,
        code_generation: codeGeneration,
        work_item_types: workItemTypes,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Transform the snake_case fields back to camelCase for the response
    const transformedProject = {
      ...updated,
      aiModel: updated.ai_model,
      maxTokens: updated.max_tokens,
      autoGeneration: updated.auto_generation,
      aiChat: updated.ai_chat,
      codeGeneration: updated.code_generation,
      openaiApiKey: updated.openai_api_key,
      createdAt: updated.created_at,
      lastSync: updated.last_sync,
      workItemTypes: updated.work_item_types,
    };

    return NextResponse.json({ success: true, project: transformedProject });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      organization,
      project,
      token,
      openaiApiKey,
      aiModel,
      temperature,
      maxTokens,
      autoGeneration,
      aiChat,
      codeGeneration,
      workItemTypes,
    } = body;

    if (
      !name ||
      !organization ||
      !project ||
      !token ||
      !openaiApiKey ||
      !aiModel
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if project already exists for this organization and project name
    const { data: existing } = await supabaseAdmin
      .from("projects")
      .select()
      .eq("organization", organization)
      .eq("project", project)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error:
            "Project already exists for this organization and project name.",
        },
        { status: 409 },
      );
    }

    const { data: created, error } = await supabaseAdmin
      .from("projects")
      .insert({
        name,
        description,
        organization,
        project,
        token,
        openai_api_key: openaiApiKey,
        ai_model: aiModel,
        temperature,
        max_tokens: maxTokens,
        auto_generation: autoGeneration,
        ai_chat: aiChat,
        code_generation: codeGeneration,
        work_item_types: workItemTypes,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Transform the snake_case fields back to camelCase for the response
    const transformedProject = {
      ...created,
      aiModel: created.ai_model,
      maxTokens: created.max_tokens,
      autoGeneration: created.auto_generation,
      aiChat: created.ai_chat,
      codeGeneration: created.code_generation,
      openaiApiKey: created.openai_api_key,
      createdAt: created.created_at,
      lastSync: created.last_sync,
      workItemTypes: created.work_item_types,
    };

    return NextResponse.json({ success: true, project: transformedProject });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    try {
      const { data: project, error } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        throw error;
      }

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      }

      // Transform the snake_case fields back to camelCase for the response
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
        createdAt: project.created_at,
        lastSync: project.last_sync,
        workItemTypes: project.work_item_types,
      };

      return NextResponse.json(transformedProject);
    } catch (error) {
      console.error("Error fetching project:", error);
      return NextResponse.json(
        { error: "Failed to fetch project" },
        { status: 500 },
      );
    }
  }

  // If no ID is provided, return all projects
  try {
    const { data: projects, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Transform the snake_case fields back to camelCase for the response
    const transformedProjects = projects.map((project) => ({
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
      createdAt: project.created_at,
      lastSync: project.last_sync,
      workItemTypes: project.work_item_types,
    }));

    return NextResponse.json({ projects: transformedProjects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Check if project exists
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Delete related data in the correct order to handle foreign key constraints
    console.log(`Starting deletion of project: ${project.name} (${id})`);

    // First, get all work item IDs for this project
    const { data: workItems } = await supabaseAdmin
      .from("work_items")
      .select("id, azure_id")
      .eq("project_id", id);

    const workItemIds = workItems?.map(item => item.id) || [];
    const workItemAzureIds = workItems?.map(item => item.azure_id) || [];

    // 1. Delete work item relations first (they reference work_items)
    if (workItemIds.length > 0) {
      const { error: relationsError } = await supabaseAdmin
        .from("work_item_relations")
        .delete()
        .in("parent_work_item_id", workItemIds);

      if (relationsError) {
        console.error("Error deleting work item relations:", relationsError);
      }

      // Also delete relations where these items are children
      const { error: childRelationsError } = await supabaseAdmin
        .from("work_item_relations")
        .delete()
        .in("child_work_item_id", workItemIds);

      if (childRelationsError) {
        console.error("Error deleting child work item relations:", childRelationsError);
      }
    }

    // 2. Delete test case work item relations (they reference work_items via azure_id)
    if (workItemAzureIds.length > 0) {
      const { error: testRelationsError } = await supabaseAdmin
        .from("test_case_work_item_relations")
        .delete()
        .in("work_item_id", workItemAzureIds);

      if (testRelationsError) {
        console.error("Error deleting test case work item relations:", testRelationsError);
      }
    }

    // 3. Delete test cases (they reference projects)
    const { error: testCasesError } = await supabaseAdmin
      .from("test_cases")
      .delete()
      .eq("project_id", id);

    if (testCasesError) {
      console.error("Error deleting test cases:", testCasesError);
    }

    // 4. Delete work items (they reference projects)
    const { error: workItemsError } = await supabaseAdmin
      .from("work_items")
      .delete()
      .eq("project_id", id);

    if (workItemsError) {
      console.error("Error deleting work items:", workItemsError);
    }

    // 5. Finally, delete the project itself
    const { error: deleteError } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`Successfully deleted project: ${project.name} (${id})`);

    return NextResponse.json({
      success: true,
      message: `Project "${project.name}" and all related data deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
