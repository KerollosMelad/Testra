import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    // Fetch recent test cases with project information
    const { data: recentTestCases } = await supabaseAdmin
      .from("test_cases")
      .select(`
        id,
        title,
        created_at,
        projects (
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch recent work items with project information
    const { data: recentWorkItems } = await supabaseAdmin
      .from("work_items")
      .select(`
        id,
        title,
        created_at,
        projects (
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(5);

    // Combine and sort activities
    const activities = [];

    // Add test case activities
    if (recentTestCases) {
      for (const testCase of recentTestCases) {
        const project = Array.isArray(testCase.projects) 
          ? testCase.projects[0]?.name 
          : (testCase.projects as any)?.name;
        
        activities.push({
          id: `test-${testCase.id}`,
          type: "test_case",
          title: `Generated test case: "${testCase.title}"`,
          project: project || "Unknown Project",
          timestamp: new Date(testCase.created_at),
        });
      }
    }

    // Add work item activities
    if (recentWorkItems) {
      for (const workItem of recentWorkItems) {
        const project = Array.isArray(workItem.projects) 
          ? workItem.projects[0]?.name 
          : (workItem.projects as any)?.name;
          
        activities.push({
          id: `work-item-${workItem.id}`,
          type: "work_item",
          title: `Synced work item: "${workItem.title}"`,
          project: project || "Unknown Project",
          timestamp: new Date(workItem.created_at),
        });
      }
    }

    // Sort by timestamp and take the most recent 10
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivities = activities.slice(0, 10);

    return NextResponse.json(recentActivities);
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent activity" },
      { status: 500 }
    );
  }
} 