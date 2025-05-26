export interface Project {
  id: string
  name: string
  description?: string
  source: {
    type: "azure-devops"
    organization: string
    project: string
    token: string
  }
  aiSettings: {
    model: "gpt-4" | "gpt-3.5-turbo"
    temperature: number
    maxTokens: number
  }
  features: {
    autoGeneration: boolean
    aiChat: boolean
    codeGeneration: boolean
  }
  createdAt: Date
  lastSync?: Date
}

export interface WorkItem {
  id: string
  title: string
  description: string
  workItemType: "User Story" | "Task" | "Bug" | "Feature"
  state: string
  assignedTo?: string
  priority?: number
  acceptanceCriteria?: string
  tags: string[]
  createdDate: Date
  changedDate: Date
}

export interface TestCase {
  id: string
  workItemId: string
  title: string
  description: string
  type: "unit" | "integration" | "e2e"
  steps: TestStep[]
  expectedResult: string
  priority: "low" | "medium" | "high"
  generatedAt: Date
  generatedCode?: string
}

export interface TestStep {
  id: string
  action: string
  expectedResult: string
  order: number
}
