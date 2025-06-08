import { SearchInterface } from "@/components/dashboard/search-interface";
import { ProjectSelector } from "@/components/dashboard/project-selector";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";

interface SearchPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  // Get all projects for the dropdown
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name, description")
    .order("created_at", { ascending: false });

  const params = await searchParams;
  const selectedProjectId = params.projectId || projects?.[0]?.id;

  if (!selectedProjectId && projects?.length === 0) {
    redirect("/projects/new");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Semantic Search</h1>
          <p className="text-gray-600 mt-1">
            Search through work items and test cases using AI-powered semantic
            search
          </p>
        </div>
      </div>

      {/* Project Selector */}
      {projects && projects.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Project
          </label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 bg-white"
            defaultValue={selectedProjectId}
          />
          <div className="hidden">
            {/* This is just a placeholder for hydration */}
            {projects.map((project) => (
              <div key={project.id}>{project.name}</div>
            ))}
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
          />
        </div>
      )}

      {selectedProjectId && <SearchInterface projectId={selectedProjectId} />}

      {(!projects || projects.length === 0) && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Projects Found
          </h3>
          <p className="text-gray-600 mb-4">
            You need to create a project first to use semantic search.
          </p>
          <a
            href="/projects/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Create Project
          </a>
        </div>
      )}
    </div>
  );
}
