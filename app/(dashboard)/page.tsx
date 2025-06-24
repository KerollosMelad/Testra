import { StatsOverview } from "@/components/dashboard/stats-overview";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Plus, TrendingUp, Zap } from "lucide-react";

export default function DashboardPage() {

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <DashboardHeader />

      {/* Stats Overview */}
      <StatsOverview />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity - Takes 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>

        {/* Quick Actions - Takes 1/3 width on large screens */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Get started with common tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/projects/new" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Project
                </Button>
              </Link>
              <Link href="/projects" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View All Projects
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* AI Features Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🤖 AI Features</CardTitle>
              <CardDescription>
                Powered by advanced AI technology
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Automated test case generation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>Smart duplicate detection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span>Code generation for automation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span>Azure DevOps integration</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


    </div>
  );
}
