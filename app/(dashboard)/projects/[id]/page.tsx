import { supabaseAdmin } from "@/lib/supabase";
import { WorkItemsList } from "@/components/dashboard/work-items-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Settings, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface ProjectDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params;
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  // Transform the snake_case fields back to camelCase
  const transformedProject = {
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
  };

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  Azure DevOps
                </Badge>
                <Badge variant="secondary">GPT-4o</Badge>
              </div>
              <CardTitle className="text-2xl">
                {transformedProject.name}
              </CardTitle>
              {transformedProject.description && (
                <CardDescription className="mt-1 text-base">
                  {transformedProject.description}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-2">
              <Link href={`/projects/${transformedProject.id}/settings`}>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-1" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Organization:</span>
              <div className="font-medium">
                {transformedProject.organization}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Project:</span>
              <div className="font-medium">{transformedProject.project}</div>
            </div>
            <div>
              <span className="text-gray-500">Created:</span>
              <div className="font-medium">
                {transformedProject.createdAt.toLocaleDateString()}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Last Sync:</span>
              <div className="font-medium">
                {transformedProject.lastSync
                  ? transformedProject.lastSync.toLocaleDateString()
                  : "Never"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Items Section */}
      <Card>
        <CardHeader>
          <CardTitle>Work Items</CardTitle>
          <CardDescription>
            User stories, tasks, bugs, and features from Azure DevOps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkItemsList
            organization={transformedProject.organization}
            project={transformedProject.project}
            token={transformedProject.token}
            projectId={transformedProject.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
