import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json({ 
        error: 'Project ID is required' 
      }, { status: 400 });
    }

    // Fetch project details
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ 
        error: 'Project not found' 
      }, { status: 404 });
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
      workItemTypes: project.work_item_types,
    };

    return NextResponse.json(transformedProject);

  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch project' 
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();

    if (!projectId) {
      return NextResponse.json({ 
        error: 'Project ID is required' 
      }, { status: 400 });
    }

    // Transform camelCase to snake_case for database
    const updateData: any = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.organization !== undefined) updateData.organization = body.organization;
    if (body.project !== undefined) updateData.project = body.project;
    if (body.token !== undefined) updateData.token = body.token;
    if (body.openaiApiKey !== undefined) updateData.openai_api_key = body.openaiApiKey;
    if (body.aiModel !== undefined) updateData.ai_model = body.aiModel;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.maxTokens !== undefined) updateData.max_tokens = body.maxTokens;
    if (body.autoGeneration !== undefined) updateData.auto_generation = body.autoGeneration;
    if (body.aiChat !== undefined) updateData.ai_chat = body.aiChat;
    if (body.codeGeneration !== undefined) updateData.code_generation = body.codeGeneration;
    if (body.workItemTypes !== undefined) updateData.work_item_types = body.workItemTypes;

    // Update project
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ 
        error: 'Failed to update project' 
      }, { status: 500 });
    }

    // Transform back to camelCase
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
      workItemTypes: project.work_item_types,
    };

    return NextResponse.json(transformedProject);

  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ 
      error: 'Failed to update project' 
    }, { status: 500 });
  }
} 