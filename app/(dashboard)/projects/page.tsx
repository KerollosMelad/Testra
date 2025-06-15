import { ProjectCard } from "@/components/dashboard/project-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { getProjectStats } from "@/lib/azure-devops";

export default async function ProjectsPage() {
  const { data: projectsData } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  // Transform the snake_case fields back to camelCase
  const projects = (projectsData || []).map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    organization: project.organization,
    project: project.project,
    token: project.token,
    openaiApiKey: project.openai_api_key,
    aiModel: project.ai_model,
    temperature: project.temperature,
    maxTokens: project.max_tokens,
    autoGeneration: project.auto_generation,
    aiChat: project.ai_chat,
    codeGeneration: project.code_generation,
    createdAt: new Date(project.created_at),
    lastSync: project.last_sync ? new Date(project.last_sync) : undefined,
  }));

  // Fetch stats for each project with error handling
  const projectsWithStats = await Promise.allSettled(
    projects.map(async (project) => {
      try {
        const stats = await getProjectStats(
          project.organization,
          project.project,
          project.token,
          project.id, // Pass project ID to get test cases count from database
        );

        return {
          id: project.id,
          name: project.name,
          description: project.description || undefined,
          source: "azure-devops" as const,
          organization: project.organization,
          project: project.project,
          storiesCount: stats.storiesCount,
          testsCount: stats.testsCount,
          lastSync: project.lastSync || project.createdAt,
          createdAt: project.createdAt,
          isConnected: stats.isConnected,
          error: stats.error,
        };
      } catch (error) {
        console.error(
          `Failed to fetch stats for project ${project.name}:`,
          error,
        );
        // Return project with default stats if API fails
        return {
          id: project.id,
          name: project.name,
          description: project.description || undefined,
          source: "azure-devops" as const,
          organization: project.organization,
          project: project.project,
          storiesCount: 0,
          testsCount: 0,
          lastSync: project.lastSync || project.createdAt,
          createdAt: project.createdAt,
          isConnected: false,
          error: `Promise failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }),
  );

  // Extract successful results and handle failures gracefully
  const validProjects = projectsWithStats.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      console.error(
        `Failed to process project ${projects[index].name}:`,
        result.reason,
      );
      // Return project with default stats
      const project = projects[index];
      return {
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        source: "azure-devops" as const,
        organization: project.organization,
        project: project.project,
        storiesCount: 0,
        testsCount: 0,
        lastSync: project.lastSync || project.createdAt,
        createdAt: project.createdAt,
        isConnected: false,
        error: `Promise failed: ${result.reason}`,
      };
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">
            Manage your test automation projects
          </p>
        </div>
        <Link href="/projects/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="Search projects..." className="pl-10" />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg mb-4">No projects found.</p>
          <Link href="/projects/new">
            <Button>Create your first project</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {validProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
