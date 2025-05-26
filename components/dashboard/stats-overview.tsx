import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderOpen, TestTube, Sparkles, Code } from "lucide-react"

const stats = [
  {
    title: "Active Projects",
    value: "3",
    description: "Connected to Azure DevOps",
    icon: FolderOpen,
    color: "text-blue-600",
  },
  {
    title: "Test Cases Generated",
    value: "312",
    description: "+24 this week",
    icon: TestTube,
    color: "text-green-600",
  },
  {
    title: "AI Generations",
    value: "89",
    description: "This month",
    icon: Sparkles,
    color: "text-purple-600",
  },
  {
    title: "Code Generated",
    value: "156",
    description: "Automation scripts",
    icon: Code,
    color: "text-orange-600",
  },
]

export function StatsOverview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
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
