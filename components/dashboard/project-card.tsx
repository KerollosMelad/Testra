import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GitBranch, RefreshCw, TestTube, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import Link from "next/link"

interface Project {
  id: string
  name: string
  description?: string
  source: "azure-devops"
  organization: string
  project: string
  storiesCount: number
  testsCount: number
  lastSync: Date
  createdAt: Date
  isConnected?: boolean
  error?: string
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      "day",
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <CardDescription className="mt-1">{project.description}</CardDescription>
          </div>
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              Azure DevOps
            </Badge>
            {project.isConnected !== undefined && (
              <Badge 
                variant={project.isConnected ? "default" : "destructive"} 
                className="flex items-center gap-1 text-xs"
                title={project.error || (project.isConnected ? "Successfully connected to Azure DevOps" : "Failed to connect to Azure DevOps")}
              >
                {project.isConnected ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Connected
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" />
                    Failed
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className={project.isConnected === false ? "text-gray-400" : ""}>
                {project.storiesCount} stories
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TestTube className="w-4 h-4 text-gray-500" />
              <span className={project.isConnected === false ? "text-gray-400" : ""}>
                {project.testsCount} tests
              </span>
            </div>
          </div>
        </div>

        {project.error && (
          <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{project.error}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Last sync: {formatDate(project.lastSync)}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Link href={`/projects/${project.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              View Project
            </Button>
          </Link>
          <Link href={`/projects/${project.id}/settings`}>
            <Button variant="ghost" size="sm">
              Settings
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
