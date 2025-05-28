import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      organization,
      project,
      token,
      aiModel,
      temperature,
      maxTokens,
      autoGeneration,
      aiChat,
      codeGeneration,
    } = body;
    if (!name || !organization || !project || !token || !aiModel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // Check if project already exists for this organization and project name
    const existing = await prisma.project.findFirst({
      where: {
        organization,
        project,
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'Project already exists for this organization and project name.' }, { status: 409 });
    }
    const created = await prisma.project.create({
      data: {
        name,
        description,
        organization,
        project,
        token,
        aiModel,
        temperature,
        maxTokens,
        autoGeneration,
        aiChat,
        codeGeneration,
      },
    });
    return NextResponse.json({ success: true, project: created });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
} 