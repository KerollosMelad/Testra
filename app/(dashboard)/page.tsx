import { ProjectCard } from "@/components/dashboard/project-card"
import { StatsOverview } from "@/components/dashboard/stats-overview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getProjectStats } from "@/lib/azure-devops"

export default async function DashboardPage() {
  // Fetch real projects from database
  const projects = await prisma.project.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: 3 // Limit to 3 projects for dashboard view
  })

  // Fetch stats for each project with error handling
  const projectsWithStats = await Promise.allSettled(
    projects.map(async (project) => {
      try {
        const stats = await getProjectStats(
          project.organization,
          project.project,
          project.token
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
          error: `Failed to fetch project stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    })
  );

  // Extract successful results and handle failures gracefully
  const validProjects = projectsWithStats.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
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
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Testra</h1>
          <p className="text-gray-600 mt-1">Manage your test automation projects and AI-generated test cases</p>
        </div>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Projects</h2>
          {projects.length > 0 && (
            <Link href="/projects">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          )}
        </div>
        
        {projects.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-gray-500 mb-4">No projects yet. Create your first project to get started!</p>
              <Link href="/projects/new">
                <Button>
                  Create Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {validProjects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
