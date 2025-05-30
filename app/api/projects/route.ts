import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
    } = body;
    
    if (!name || !organization || !project || !token || !openaiApiKey || !aiModel) {
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

export async function GET() {
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
