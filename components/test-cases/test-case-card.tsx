'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  TestTube, 
  Code, 
  Play, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Clock,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TestCaseData {
  id: string;
  title: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  priority: 'low' | 'medium' | 'high';
  status: string;
  steps: Array<{
    step: number;
    action: string;
    expectedOutcome: string;
    testData?: Record<string, any>;
  }>;
  expectedResult: string;
  preconditions?: string;
  estimatedDuration?: number;
  contentHash: string;
  createdAt: string;
  generatedAt?: string;
  generatedBy?: string;
  generatedCode?: string;
  azureId?: string;
  workItem?: {
    id: string;
    title: string;
    type: string;
    state: string;
  } | null;
}

interface TestCaseCardProps {
  testCase: TestCaseData;
  isSelected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onDelete?: (id: string, title: string) => void;
  onViewCode?: (testCase: TestCaseData) => void;
  onRunTest?: (testCase: TestCaseData) => void;
  showSelection?: boolean;
  showWorkItem?: boolean;
  showActions?: boolean;
  isDeleting?: boolean;
  className?: string;
}

const getTypeColor = (type: string) => {
  switch (type) {
    case "unit":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "integration":
      return "bg-green-100 text-green-800 border-green-200";
    case "e2e":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800 border-red-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "low":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "active":
    case "passed":
      return "bg-green-100 text-green-800 border-green-200";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    case "design":
    case "ready":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "blocked":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export function TestCaseCard({
  testCase,
  isSelected = false,
  onSelect,
  onDelete,
  onViewCode,
  onRunTest,
  showSelection = false,
  showWorkItem = false,
  showActions = true,
  isDeleting = false,
  className
}: TestCaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={cn(
      "hover:shadow-md transition-all duration-200",
      isSelected && "ring-2 ring-blue-500 ring-offset-2",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {showSelection && onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(testCase.id, checked as boolean)}
                disabled={isDeleting}
                className="mt-1"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <TestTube className="w-4 h-4 text-gray-500" />
                <CardTitle className="text-lg">{testCase.title}</CardTitle>
                {testCase.azureId && (
                  <Badge variant="outline" className="text-xs">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Azure #{testCase.azureId}
                  </Badge>
                )}
              </div>
              <CardDescription className="mb-3">{testCase.description}</CardDescription>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getTypeColor(testCase.type)}>
                  {testCase.type.toUpperCase()}
                </Badge>
                <Badge className={getPriorityColor(testCase.priority)}>
                  {testCase.priority.toUpperCase()}
                </Badge>
                <Badge className={getStatusColor(testCase.status)}>
                  {testCase.status}
                </Badge>
                {testCase.estimatedDuration && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {testCase.estimatedDuration}min
                  </Badge>
                )}
                {testCase.generatedBy && (
                  <Badge variant="outline" className="text-xs">
                    <User className="w-3 h-3 mr-1" />
                    {testCase.generatedBy}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {showActions && (
            <div className="flex items-center gap-2">
              {testCase.generatedCode && onViewCode && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onViewCode(testCase)}
                  className="flex items-center gap-1"
                >
                  <Code className="w-3 h-3" />
                  Code
                </Button>
              )}
              {onRunTest && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onRunTest(testCase)}
                  className="flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  Run
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(testCase.id, testCase.title)}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {showWorkItem && testCase.workItem && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-blue-800">Work Item:</span>
              <span className="text-blue-700">#{testCase.workItem.id} - {testCase.workItem.title}</span>
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                {testCase.workItem.type}
              </Badge>
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                {testCase.workItem.state}
              </Badge>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {testCase.preconditions && (
            <div>
              <h5 className="font-semibold text-sm mb-1">Preconditions:</h5>
              <p className="text-sm text-muted-foreground">{testCase.preconditions}</p>
            </div>
          )}
          
          {testCase.steps && testCase.steps.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-sm">Test Steps:</h5>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs h-6 px-2"
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </div>
              <div className={cn(
                "transition-all duration-200 overflow-hidden",
                isExpanded ? "max-h-none" : "max-h-24"
              )}>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  {testCase.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="text-muted-foreground">
                      <span className="font-medium">{step.action}</span>
                      {step.expectedOutcome && (
                        <span className="text-green-600"> → {step.expectedOutcome}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
          
          <div>
            <h5 className="font-semibold text-sm mb-1">Expected Result:</h5>
            <p className="text-sm text-muted-foreground">{testCase.expectedResult}</p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-4">
              <span>Created: {new Date(testCase.createdAt).toLocaleDateString()}</span>
              {testCase.generatedAt && (
                <span>Generated: {new Date(testCase.generatedAt).toLocaleDateString()}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span>Saved</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 