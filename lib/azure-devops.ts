interface WorkItemsCountResponse {
  workItems: Array<{ id: number }>;
}

export async function getWorkItemsCount(
  organization: string,
  project: string,
  pat: string
): Promise<{ count: number; isConnected: boolean; error?: string }> {
  try {
    // WIQL query to count User Stories, Tasks, Bugs, and Features
    const wiqlQuery = {
      query: `
        SELECT [System.Id]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${project}' 
        AND [System.WorkItemType] IN ('User Story', 'Task', 'Bug', 'Feature')
      `
    };

    // Execute the WIQL query to get work item IDs with timeout
    const wiqlUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.0`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const wiqlResponse = await fetch(wiqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wiqlQuery),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!wiqlResponse.ok) {
      // Try to get error details if possible
      try {
        const errorText = await wiqlResponse.text();
        if (wiqlResponse.status === 404) {
          return { 
            count: 0, 
            isConnected: false, 
            error: `Azure DevOps project not found. Check organization '${organization}' and project '${project}' names.`
          };
        } else if (wiqlResponse.status === 401 || wiqlResponse.status === 403) {
          return { 
            count: 0, 
            isConnected: false, 
            error: `Authentication failed. Check your PAT token permissions.`
          };
        } else {
          return { 
            count: 0, 
            isConnected: false, 
            error: `Azure DevOps API error: ${wiqlResponse.status} ${wiqlResponse.statusText}`
          };
        }
      } catch (e) {
        return { 
          count: 0, 
          isConnected: false, 
          error: `Azure DevOps API error: ${wiqlResponse.status}`
        };
      }
    }

    // Check if response is JSON
    const contentType = wiqlResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { 
        count: 0, 
        isConnected: false, 
        error: `Invalid response format from Azure DevOps. Expected JSON, got ${contentType}`
      };
    }

    const wiqlResult: WorkItemsCountResponse = await wiqlResponse.json();
    return { 
      count: wiqlResult.workItems?.length || 0, 
      isConnected: true 
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { 
        count: 0, 
        isConnected: false, 
        error: 'Connection timeout. Check your network connection and Azure DevOps availability.'
      };
    } else if (error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return { 
        count: 0, 
        isConnected: false, 
        error: 'Network timeout connecting to Azure DevOps. Check your internet connection.'
      };
    } else {
      return { 
        count: 0, 
        isConnected: false, 
        error: `Network error: ${error.message}`
      };
    }
  }
}

export async function getProjectStats(
  organization: string,
  project: string,
  pat: string
) {
  const workItemsResult = await getWorkItemsCount(organization, project, pat);
  // For now, testsCount is 0 since we don't have test cases stored yet
  // This can be updated when we implement test case generation and storage
  const testsCount = 0;

  return {
    storiesCount: workItemsResult.count,
    testsCount,
    isConnected: workItemsResult.isConnected,
    error: workItemsResult.error
  };
} 