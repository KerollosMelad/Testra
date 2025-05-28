import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organization = searchParams.get('organization');
    const project = searchParams.get('project');
    const pat = searchParams.get('pat');

    if (!organization || !project || !pat) {
      return NextResponse.json({ error: 'Missing required parameters: organization, project, pat' }, { status: 400 });
    }

    // WIQL query to get User Stories, Tasks, Bugs, and Features
    const wiqlQuery = {
      query: `
        SELECT [System.Id], [System.Title], [System.Description], [System.WorkItemType], 
               [System.State], [System.AssignedTo], [Microsoft.VSTS.Common.Priority], 
               [Microsoft.VSTS.Common.AcceptanceCriteria], [System.Tags], 
               [System.CreatedDate], [System.ChangedDate]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${project}' 
        AND [System.WorkItemType] IN ('User Story', 'Task', 'Bug', 'Feature')
        ORDER BY [System.ChangedDate] DESC
      `
    };

    // First, execute the WIQL query to get work item IDs
    const wiqlUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.0`;
    const wiqlResponse = await fetch(wiqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wiqlQuery),
    });

    if (!wiqlResponse.ok) {
      return NextResponse.json({ error: 'Failed to execute WIQL query' }, { status: wiqlResponse.status });
    }

    const wiqlResult = await wiqlResponse.json();
    const workItemIds = wiqlResult.workItems?.map((item: any) => item.id) || [];

    if (workItemIds.length === 0) {
      return NextResponse.json({ workItems: [] });
    }

    // Fetch detailed work item information
    const batchUrl = `https://dev.azure.com/${organization}/_apis/wit/workitems?ids=${workItemIds.join(',')}&$expand=all&api-version=7.0`;
    const batchResponse = await fetch(batchUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64'),
        'Content-Type': 'application/json',
      },
    });

    if (!batchResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch work item details' }, { status: batchResponse.status });
    }

    const batchResult = await batchResponse.json();
    
    // Transform the data to match our interface
    const workItems = batchResult.value?.map((item: any) => ({
      id: item.id.toString(),
      title: item.fields['System.Title'] || '',
      description: item.fields['System.Description'] || '',
      workItemType: item.fields['System.WorkItemType'] || '',
      state: item.fields['System.State'] || '',
      assignedTo: item.fields['System.AssignedTo']?.displayName || null,
      priority: item.fields['Microsoft.VSTS.Common.Priority'] || null,
      acceptanceCriteria: item.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || null,
      tags: item.fields['System.Tags'] ? item.fields['System.Tags'].split(';').map((tag: string) => tag.trim()) : [],
      createdDate: item.fields['System.CreatedDate'] || null,
      changedDate: item.fields['System.ChangedDate'] || null,
    })) || [];

    return NextResponse.json({ workItems, total: workItems.length });
  } catch (error) {
    console.error('Error fetching work items:', error);
    return NextResponse.json({ error: 'Failed to fetch work items from Azure DevOps' }, { status: 500 });
  }
} 