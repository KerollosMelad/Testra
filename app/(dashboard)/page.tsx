import { ProjectCard } from "@/components/dashboard/project-card"
import { StatsOverview } from "@/components/dashboard/stats-overview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import Link from "next/link"

const mockProjects = [
  {
    id: "1",
    name: "E-Commerce Platform",
    description: "Main customer-facing web application",
    source: "azure-devops" as const,
    organization: "contoso",
    project: "ecommerce",
    storiesCount: 24,
    testsCount: 156,
    lastSync: new Date("2024-01-15T10:30:00Z"),
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "2",
    name: "Mobile App API",
    description: "Backend services for mobile applications",
    source: "azure-devops" as const,
    organization: "contoso",
    project: "mobile-api",
    storiesCount: 18,
    testsCount: 89,
    lastSync: new Date("2024-01-14T15:45:00Z"),
    createdAt: new Date("2023-12-15T00:00:00Z"),
  },
  {
    id: "3",
    name: "Admin Dashboard",
    description: "Internal management and reporting tools",
    source: "azure-devops" as const,
    organization: "contoso",
    project: "admin",
    storiesCount: 12,
    testsCount: 67,
    lastSync: new Date("2024-01-13T09:20:00Z"),
    createdAt: new Date("2024-01-10T00:00:00Z"),
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Testra</h1>
          <p className="text-gray-600 mt-1">Manage your test automation projects and AI-generated test cases</p>
        </div>
        <Link href="/projects/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <StatsOverview />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest test generation and project updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">Generated 12 test cases for "User Authentication"</p>
                <p className="text-xs text-gray-500">E-Commerce Platform • 2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">Synced 8 new user stories from Azure DevOps</p>
                <p className="text-xs text-gray-500">Mobile App API • 4 hours ago</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">Generated Cypress automation code</p>
                <p className="text-xs text-gray-500">Admin Dashboard • 1 day ago</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  )
}
