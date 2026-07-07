import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from("projects")
      .select("id")
      .limit(20);

    if (projectsError || !projects?.length) {
      return NextResponse.json(
        { error: "No projects for demo endpoint" },
        { status: 500 },
      );
    }

    const perProjectCounts: Array<{ projectId: string; testCaseCount: number }> =
      [];

    for (const row of projects) {
      const { count, error } = await supabaseAdmin
        .from("test_cases")
        .select("*", { count: "exact", head: true })
        .eq("project_id", row.id);

      if (error) {
        throw error;
      }

      perProjectCounts.push({
        projectId: row.id,
        testCaseCount: count ?? 0,
      });
    }

    return NextResponse.json({
      _reviewSkillDemo: true,
      warning: "This endpoint exists only to simulate bad code for PR review exercises.",
      perProjectCounts,
    });
  } catch (err) {
    console.error("review-demo-bad-n-plus-one:", err);
    return NextResponse.json(
      { error: "Demo endpoint failed" },
      { status: 500 },
    );
  }
}
