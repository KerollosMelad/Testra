import { ProjectCard } from "@/components/dashboard/project-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
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

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your test automation projects</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
