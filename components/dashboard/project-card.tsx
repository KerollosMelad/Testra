import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GitBranch, RefreshCw, TestTube, FileText } from "lucide-react"
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
          <Badge variant="outline" className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            Azure DevOps
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4 text-gray-500" />
              <span>{project.storiesCount} stories</span>
            </div>
            <div className="flex items-center gap-1">
              <TestTube className="w-4 h-4 text-gray-500" />
              <span>{project.testsCount} tests</span>
            </div>
          </div>
        </div>

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
