import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Aggregate dashboard KPIs — one round-trip per metric (no iteration over DB clients).
 */
export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      { count: projectsCount },
      { count: testCasesCount },
      { count: workItemsCount },
      { count: recentTestCasesCount },
      { count: recentWorkItemsCount },
      { count: withGeneratedCodeCount },
    ] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("test_cases")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("work_items")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("test_cases")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),
      supabaseAdmin
        .from("work_items")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),
      supabaseAdmin
        .from("test_cases")
        .select("*", { count: "exact", head: true })
        .not("generated_code", "is", null),
    ]);

    return NextResponse.json({
      projectsCount: projectsCount ?? 0,
      testCasesCount: testCasesCount ?? 0,
      workItemsCount: workItemsCount ?? 0,
      recentTestCasesCount: recentTestCasesCount ?? 0,
      recentWorkItemsCount: recentWorkItemsCount ?? 0,
      withGeneratedCodeCount: withGeneratedCodeCount ?? 0,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 },
    );
  }
}
