import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { organization, project, pat } = await request.json();
    if (!organization || !project || !pat) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const url = `https://dev.azure.com/${organization}/_apis/projects/${project}?api-version=7.0`;
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64'),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Invalid credentials or project not found' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json({ success: true, project: data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to connect to Azure DevOps' }, { status: 500 });
  }
} 