"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderOpen, TestTube, Sparkles, Code } from "lucide-react"
import { useEffect, useState } from "react"

interface DashboardStats {
  projectsCount: number
  testCasesCount: number
  workItemsCount: number
  recentTestCasesCount: number
  recentWorkItemsCount: number
  automationCodeCount: number
}

export function StatsOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const getTimeAgo = (hours: number) => {
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const formatGrowth = (recent: number, total: number) => {
    if (total === 0) return "No data yet"
    const percentage = Math.round((recent / total) * 100)
    return recent > 0 ? `+${recent} recently` : "No recent activity"
  }

  const statsConfig = [
    {
      title: "Active Projects",
      value: loading ? "..." : stats?.projectsCount.toString() || "0",
      description: "Connected to Azure DevOps",
      icon: FolderOpen,
      color: "text-blue-600",
    },
    {
      title: "Test Cases Generated",
      value: loading ? "..." : stats?.testCasesCount.toString() || "0",
      description: loading ? "Loading..." : formatGrowth(stats?.recentTestCasesCount || 0, stats?.testCasesCount || 0),
      icon: TestTube,
      color: "text-green-600",
    },
    {
      title: "Work Items Synced",
      value: loading ? "..." : stats?.workItemsCount.toString() || "0",
      description: loading ? "Loading..." : formatGrowth(stats?.recentWorkItemsCount || 0, stats?.workItemsCount || 0),
      icon: Sparkles,
      color: "text-purple-600",
    },
    {
      title: "Automation Scripts",
      value: loading ? "..." : stats?.automationCodeCount.toString() || "0",
      description: "Generated test code",
      icon: Code,
      color: "text-orange-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsConfig.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
