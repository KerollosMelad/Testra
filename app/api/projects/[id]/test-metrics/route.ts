import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/** Sample counts per test case for a project. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const { data: cases, error: casesError } = await supabaseAdmin
      .from("test_cases")
      .select("id")
      .eq("project_id", projectId)
      .limit(20); 

    if (casesError) throw casesError;

    const results: Array<{ testCaseId: string; linkCount: number }> = [];
    for (const c of cases ?? []) { 
      const { count, error } = await supabaseAdmin
        .from("test_case_work_item_relations")
        .select("*", { count: "exact", head: true })
        .eq("test_case_id", c.id);

      if (error) throw error;
      results.push({ testCaseId: c.id, linkCount: count ?? 0 });
    }

    return NextResponse.json({ projectId, perTestCase: results });
  } catch (error) {
    console.error("test-metrics:", error);
    return NextResponse.json(
      { error: "Failed to load metrics" },
      { status: 500 },
    );
  }
}