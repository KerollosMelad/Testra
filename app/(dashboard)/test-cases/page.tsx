import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TestTube, Search, Filter, Code, Play } from "lucide-react"

const mockTestCases = [
  {
    id: "1",
    title: "User Login Validation",
    description: "Verify user can login with valid credentials",
    type: "e2e" as const,
    priority: "high" as const,
    project: "E-Commerce Platform",
    workItemTitle: "User Authentication System",
    generatedAt: new Date("2024-01-15T10:30:00Z"),
    hasCode: true,
  },
  {
    id: "2",
    title: "API Response Validation",
    description: "Test product search API returns correct data structure",
    type: "integration" as const,
    priority: "medium" as const,
    project: "Mobile App API",
    workItemTitle: "Product Search Feature",
    generatedAt: new Date("2024-01-14T15:45:00Z"),
    hasCode: true,
  },
  {
    id: "3",
    title: "Password Strength Validation",
    description: "Story test for password validation function",
    type: "unit" as const,
    priority: "medium" as const,
    project: "E-Commerce Platform",
    workItemTitle: "User Registration",
    generatedAt: new Date("2024-01-13T09:20:00Z"),
    hasCode: false,
  },
]

const getTypeColor = (type: string) => {
  switch (type) {
    case "unit":
      return "bg-blue-100 text-blue-800"
    case "integration":
      return "bg-green-100 text-green-800"
    case "e2e":
      return "bg-purple-100 text-purple-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800"
    case "medium":
      return "bg-yellow-100 text-yellow-800"
    case "low":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default function TestCasesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Cases</h1>
          <p className="text-gray-600 mt-1">AI-generated test cases across all projects</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="Search test cases..." className="pl-10" />
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filter
        </Button>
      </div>

      <div className="space-y-4">
        {mockTestCases.map((testCase) => (
          <Card key={testCase.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <TestTube className="w-4 h-4 text-gray-500" />
                    <CardTitle className="text-lg">{testCase.title}</CardTitle>
                  </div>
                  <CardDescription>{testCase.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getTypeColor(testCase.type)}>{testCase.type.toUpperCase()}</Badge>
                  <Badge className={getPriorityColor(testCase.priority)}>{testCase.priority}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Project:</span> {testCase.project}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Work Item:</span> {testCase.workItemTitle}
                  </p>
                  <p className="text-xs text-gray-500">Generated {testCase.generatedAt.toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {testCase.hasCode && (
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Code className="w-3 h-3" />
                      View Code
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    Run Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
