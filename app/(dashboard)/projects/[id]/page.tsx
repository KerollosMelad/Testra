import { supabaseAdmin } from "@/lib/supabase";
import { ProjectTabs } from "@/components/projects/project-tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Settings } from "lucide-react";
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
      </Card>

      {/* Tabbed Interface */}
      <ProjectTabs project={transformedProject} />
    </div>
  );
}
