import { prisma } from "@/lib/prisma";
import { WorkItemsList } from "@/components/dashboard/work-items-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    notFound();
  }

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
                <Badge variant="secondary">{project.aiModel}</Badge>
              </div>
              <CardTitle className="text-2xl">{project.name}</CardTitle>
              {project.description && (
                <CardDescription className="mt-1 text-base">
                  {project.description}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                Sync
              </Button>
              <Link href={`/projects/${project.id}/settings`}>
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
              <div className="font-medium">{project.organization}</div>
            </div>
            <div>
              <span className="text-gray-500">Project:</span>
              <div className="font-medium">{project.project}</div>
            </div>
            <div>
              <span className="text-gray-500">Created:</span>
              <div className="font-medium">{new Date(project.createdAt).toLocaleDateString()}</div>
            </div>
            <div>
              <span className="text-gray-500">Last Sync:</span>
              <div className="font-medium">
                {project.lastSync ? new Date(project.lastSync).toLocaleDateString() : 'Never'}
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
            organization={project.organization}
            project={project.project}
            token={project.token}
            projectId={project.id}
          />
        </CardContent>
      </Card>
    </div>
  );
} 