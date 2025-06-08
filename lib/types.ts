export interface Project {
  id: string;
  name: string;
  description?: string;
  organization: string;
  project: string;
  token: string;
  openaiApiKey: string;
  aiModel: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-4-0125-preview" | "gpt-4" | "gpt-3.5-turbo-0125" | "gpt-3.5-turbo";
  temperature: number;
  maxTokens: number;
  autoGeneration: boolean;
  aiChat: boolean;
  codeGeneration: boolean;
  createdAt: Date;
  lastSync?: Date;
  workItemTypes?: string[];
}

export interface WorkItemRelation {
  id: string;
  relationType: "parent" | "child" | "related" | "predecessor" | "successor";
  workItemId: string;
  title: string;
  workItemType: "User Story" | "Task" | "Bug" | "Feature";
  state: string;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  workItemType: "User Story" | "Task" | "Bug" | "Feature";
  state: string;
  assignedTo?: string;
  priority?: number;
  acceptanceCriteria?: string;
  tags: string[];
  createdDate: string | null;
  changedDate: string | null;
  lastSyncAt?: string | null;
  projectId?: string;
  parentId?: string;
  children: WorkItemRelation[];
  relatedItems: WorkItemRelation[];
  isUserStory: boolean;
  isTask: boolean;
  hasChildren: boolean;
  hasParent: boolean;
}

export interface TestCase {
  id: string;
  title: string;
  description: string;
  type: "unit" | "integration";
  priority: "low" | "medium" | "high";
  status: "draft" | "active" | "deprecated";
  steps: TestStep[];
  expectedResult: string;
  preconditions?: string;
  testData?: Record<string, any>;
  estimatedDuration?: number;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  generatedAt?: Date;
  generatedBy?: "ai" | "manual";
  generatedCode?: string;
}

export interface TestStep {
  step: number;
  action: string;
  expectedOutcome: string;
  testData?: Record<string, any>;
}

export interface TestCaseWorkItemRelation {
  id: string;
  testCaseId: string;
  workItemId: string;
  relationType: "covers" | "validates" | "depends_on";
  createdAt: Date;
}

export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  type: "smoke" | "regression" | "integration" | "custom";
  projectId: string;
  testCases: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseRelation {
  id: string;
  parentTestCaseId: string;
  childTestCaseId: string;
  relationType: "prerequisite" | "follows" | "blocks";
  createdAt: Date;
}

export interface TestGenerationContext {
  project: {
    name: string;
    domain?: string;
    businessRules?: string[];
  };
  userStory: WorkItem;
  relatedTasks: WorkItem[];
  existingTestCases: TestCase[];
  testType: "unit" | "integration";
  coverageLevel: "basic" | "comprehensive" | "custom";
  customRequirements?: string;
}

export interface TestGenerationResult {
  testCases: Omit<TestCase, "id" | "createdAt" | "updatedAt">[];
  relationships: Omit<TestCaseWorkItemRelation, "id" | "createdAt">[];
  suggestions: string[];
  confidence: number;
}
