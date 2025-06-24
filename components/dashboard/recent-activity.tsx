"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TestTube, FileText, Clock } from "lucide-react"
import { useEffect, useState } from "react"

interface Activity {
  id: string
  type: "test_case" | "work_item"
  title: string
  project: string
  timestamp: Date
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchActivity() {
      try {
        const response = await fetch('/api/dashboard/activity')
        if (response.ok) {
          const data = await response.json()
          // Convert timestamp strings back to Date objects
          const activitiesWithDates = data.map((activity: any) => ({
            ...activity,
            timestamp: new Date(activity.timestamp)
          }))
          setActivities(activitiesWithDates)
        }
      } catch (error) {
        console.error('Failed to fetch recent activity:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
  }, [])

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return timestamp.toLocaleDateString()
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "test_case":
        return <TestTube className="w-4 h-4 text-green-600" />
      case "work_item":
        return <FileText className="w-4 h-4 text-blue-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest test generation and project updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-1" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest test generation and project updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No recent activity</p>
            <p className="text-sm">Start by creating a project or generating test cases</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                {getActivityIcon(activity.type)}
                <div className="flex-1">
                  <p className="font-medium text-sm">{activity.title}</p>
                  <p className="text-xs text-gray-500">
                    {activity.project} • {getTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 