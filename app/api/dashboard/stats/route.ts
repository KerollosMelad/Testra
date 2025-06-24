import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    // Fetch active projects count
    const { count: projectsCount } = await supabaseAdmin
      .from("projects")
      .select("*", { count: "exact", head: true });

    // Fetch total test cases count
    const { count: testCasesCount } = await supabaseAdmin
      .from("test_cases")
      .select("*", { count: "exact", head: true });

    // Fetch work items count
    const { count: workItemsCount } = await supabaseAdmin
      .from("work_items")
      .select("*", { count: "exact", head: true });

    // Fetch recent test cases (last 7 days) for growth calculation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: recentTestCasesCount } = await supabaseAdmin
      .from("test_cases")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString());

    // Fetch recent work items (last 30 days) for AI generations
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: recentWorkItemsCount } = await supabaseAdmin
      .from("work_items")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Count test cases with automation code
    const { count: automationCodeCount } = await supabaseAdmin
      .from("test_cases")
      .select("*", { count: "exact", head: true })
      .not("automation_code", "is", null)
      .neq("automation_code", "");

    return NextResponse.json({
      projectsCount: projectsCount || 0,
      testCasesCount: testCasesCount || 0,
      workItemsCount: workItemsCount || 0,
      recentTestCasesCount: recentTestCasesCount || 0,
      recentWorkItemsCount: recentWorkItemsCount || 0,
      automationCodeCount: automationCodeCount || 0,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
} 