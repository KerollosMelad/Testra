import { NextRequest, NextResponse } from "next/server";
import { WorkItem, WorkItemRelation } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organization = searchParams.get("organization");
    const project = searchParams.get("project");
    const pat = searchParams.get("pat");
    const workItemTypes = searchParams.get("workItemTypes");

    if (!organization || !project || !pat) {
      return NextResponse.json(
        { error: "Missing required parameters: organization, project, pat" },
        { status: 400 },
      );
    }

    // Parse work item types or use default
    const workItemTypesArray = workItemTypes
      ? JSON.parse(workItemTypes)
      : ["User Story", "Task", "Bug", "Feature"];

    // Format work item types for the WIQL query
    const formattedWorkItemTypes = workItemTypesArray
      .map((type: string) => `'${type}'`)
      .join(", ");

    // WIQL query to get selected work item types with relationships
    const wiqlQuery = {
      query: `
        SELECT [System.Id], [System.Title], [System.Description], [System.WorkItemType], 
               [System.State], [System.AssignedTo], [Microsoft.VSTS.Common.Priority], 
               [Microsoft.VSTS.Common.AcceptanceCriteria], [System.Tags], 
               [System.CreatedDate], [System.ChangedDate], [System.Parent]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${project}' 
        AND [System.WorkItemType] IN (${formattedWorkItemTypes})
        ORDER BY [System.ChangedDate] DESC
      `,
    };

    // First, execute the WIQL query to get work item IDs
    const wiqlUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.0`;
    const wiqlResponse = await fetch(wiqlUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(":" + pat).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wiqlQuery),
    });

    if (!wiqlResponse.ok) {
      return NextResponse.json(
        { error: "Failed to execute WIQL query" },
        { status: wiqlResponse.status },
      );
    }

    const wiqlResult = await wiqlResponse.json();
    const workItemIds = wiqlResult.workItems?.map((item: any) => item.id) || [];

    if (workItemIds.length === 0) {
      return NextResponse.json({ workItems: [] });
    }

    // Fetch detailed work item information with relations
    const batchUrl = `https://dev.azure.com/${organization}/_apis/wit/workitems?ids=${workItemIds.join(",")}&$expand=relations&api-version=7.0`;
    const batchResponse = await fetch(batchUrl, {
      headers: {
        Authorization: "Basic " + Buffer.from(":" + pat).toString("base64"),
        "Content-Type": "application/json",
      },
    });

    if (!batchResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch work item details" },
        { status: batchResponse.status },
      );
    }

    const batchResult = await batchResponse.json();

    // Helper function to extract work item ID from URL
    const extractWorkItemId = (url: string): string => {
      const match = url.match(/workItems\/(\d+)/);
      return match ? match[1] : "";
    };

    // Helper function to determine relation type
    const getRelationType = (
      relType: string,
    ): "parent" | "child" | "related" | "predecessor" | "successor" => {
      if (relType.includes("Parent")) return "parent";
      if (relType.includes("Child")) return "child";
      if (relType.includes("Predecessor")) return "predecessor";
      if (relType.includes("Successor")) return "successor";
      return "related";
    };

    // Create a map for quick lookup of work item details
    const workItemMap = new Map();
    batchResult.value?.forEach((item: any) => {
      workItemMap.set(item.id.toString(), {
        id: item.id.toString(),
        title: item.fields["System.Title"] || "",
        workItemType: item.fields["System.WorkItemType"] || "",
        state: item.fields["System.State"] || "",
      });
    });

    // Transform the data to match our interface with relationships
    const workItems: WorkItem[] =
      batchResult.value?.map((item: any) => {
        const children: WorkItemRelation[] = [];
        const relatedItems: WorkItemRelation[] = [];
        let parentId: string | undefined;

        // Process relations if they exist
        if (item.relations) {
          item.relations.forEach((relation: any) => {
            const relatedWorkItemId = extractWorkItemId(relation.url);
            const relatedWorkItem = workItemMap.get(relatedWorkItemId);

            if (relatedWorkItem) {
              const relationType = getRelationType(relation.rel);
              const relationData: WorkItemRelation = {
                id: relatedWorkItemId,
                relationType,
                workItemId: relatedWorkItemId,
                title: relatedWorkItem.title,
                workItemType: relatedWorkItem.workItemType,
                state: relatedWorkItem.state,
              };

              if (relationType === "parent") {
                parentId = relatedWorkItemId;
                relatedItems.push(relationData);
              } else if (relationType === "child") {
                children.push(relationData);
              } else {
                relatedItems.push(relationData);
              }
            }
          });
        }

        const workItemType = item.fields["System.WorkItemType"] || "";

        return {
          id: item.id.toString(),
          title: item.fields["System.Title"] || "",
          description: item.fields["System.Description"] || "",
          workItemType: workItemType as
            | "User Story"
            | "Task"
            | "Bug"
            | "Feature",
          state: item.fields["System.State"] || "",
          assignedTo:
            item.fields["System.AssignedTo"]?.displayName || undefined,
          priority: item.fields["Microsoft.VSTS.Common.Priority"] || undefined,
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
          // Enhanced relationship data
          parentId,
          children,
          relatedItems,
          // Computed fields
          isUserStory: workItemType === "User Story",
          isTask: workItemType === "Task",
          hasChildren: children.length > 0,
          hasParent: !!parentId,
        };
      }) || [];

    return NextResponse.json({
      workItems,
      total: workItems.length,
      summary: {
        userStories: workItems.filter((item) => item.isUserStory).length,
        tasks: workItems.filter((item) => item.isTask).length,
        bugs: workItems.filter((item) => item.workItemType === "Bug").length,
        features: workItems.filter((item) => item.workItemType === "Feature")
          .length,
        withRelationships: workItems.filter(
          (item) => item.hasChildren || item.hasParent,
        ).length,
      },
    });
  } catch (error) {
    console.error("Error fetching work items:", error);
    return NextResponse.json(
      { error: "Failed to fetch work items from Azure DevOps" },
      { status: 500 },
    );
  }
}
