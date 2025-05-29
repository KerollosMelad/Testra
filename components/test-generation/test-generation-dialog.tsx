'use client'
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, CheckCircle, AlertCircle, Code, FileText, Zap } from "lucide-react";
import { WorkItem, TestGenerationResult } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TestGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItem: WorkItem;
  projectId: string;
}

interface GeneratedTestCase {
  title: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'api';
  priority: 'low' | 'medium' | 'high';
  steps: Array<{
    step: number;
    action: string;
    expectedOutcome: string;
    testData?: Record<string, any>;
  }>;
  expectedResult: string;
  preconditions?: string;
  testData?: Record<string, any>;
  estimatedDuration?: number;
  generatedCode?: string;
}

export function TestGenerationDialog({ open, onOpenChange, workItem, projectId }: TestGenerationDialogProps) {
  const [testType, setTestType] = useState<'unit' | 'integration' | 'e2e' | 'api'>('integration');
  const [coverageLevel, setCoverageLevel] = useState<'basic' | 'comprehensive' | 'custom'>('basic');
  const [customRequirements, setCustomRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'configure' | 'generating' | 'results'>('configure');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setStep('generating');

    try {
      const response = await fetch('/api/ai/generate-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          workItemId: workItem.id,
          testType,
          coverageLevel,
          customRequirements: customRequirements || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate test cases');
      }

      const data = await response.json();
      setResult(data.data);
      setStep('results');
    } catch (err: any) {
      setError(err.message || 'Failed to generate test cases');
      setStep('configure');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('configure');
    setResult(null);
    setError(null);
    setCustomRequirements('');
    onOpenChange(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'unit': return <Code className="w-4 h-4" />;
      case 'integration': return <Zap className="w-4 h-4" />;
      case 'e2e': return <FileText className="w-4 h-4" />;
      case 'api': return <Code className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Generate AI Test Cases
          </DialogTitle>
          <DialogDescription>
            Generate comprehensive test cases for: <strong>{workItem.title}</strong>
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' && (
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="testType">Test Type</Label>
                  <Select value={testType} onValueChange={(value: any) => setTestType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select test type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unit">Unit Tests</SelectItem>
                      <SelectItem value="integration">Integration Tests</SelectItem>
                      <SelectItem value="e2e">End-to-End Tests</SelectItem>
                      <SelectItem value="api">API Tests</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="coverageLevel">Coverage Level</Label>
                  <Select value={coverageLevel} onValueChange={(value: any) => setCoverageLevel(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select coverage level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic Coverage</SelectItem>
                      <SelectItem value="comprehensive">Comprehensive Coverage</SelectItem>
                      <SelectItem value="custom">Custom Requirements</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Work Item Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs">{workItem.workItemType}</Badge>
                      <Badge variant="outline" className="text-xs">{workItem.state}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">{workItem.description}</p>
                    {workItem.acceptanceCriteria && (
                      <div className="text-xs text-gray-500">
                        <strong>Acceptance Criteria:</strong> Available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {coverageLevel === 'custom' && (
              <div>
                <Label htmlFor="customRequirements">Custom Requirements</Label>
                <Textarea
                  id="customRequirements"
                  placeholder="Describe specific test scenarios, edge cases, or requirements you want to include..."
                  value={customRequirements}
                  onChange={(e) => setCustomRequirements(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Generating Test Cases</h3>
              <p className="text-gray-600">AI is analyzing your work item and creating comprehensive test cases...</p>
            </div>
          </div>
        )}

        {step === 'results' && result && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold">Generated {result.testCases.length} Test Cases</h3>
              </div>
              <Badge variant="secondary">
                Confidence: {Math.round(result.confidence * 100)}%
              </Badge>
            </div>

            {result.suggestions.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>AI Suggestions:</strong>
                  <ul className="mt-2 space-y-1">
                    {result.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm">• {suggestion}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {result.testCases.map((testCase, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeIcon(testCase.type)}
                          <Badge variant="outline">{testCase.type}</Badge>
                          <Badge className={getPriorityColor(testCase.priority)}>
                            {testCase.priority}
                          </Badge>
                          {testCase.estimatedDuration && (
                            <Badge variant="secondary" className="text-xs">
                              ~{testCase.estimatedDuration}min
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base">{testCase.title}</CardTitle>
                        <CardDescription className="mt-1">{testCase.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {testCase.preconditions && (
                      <div>
                        <Label className="text-xs font-semibold">Preconditions:</Label>
                        <p className="text-sm text-gray-600">{testCase.preconditions}</p>
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-xs font-semibold">Test Steps:</Label>
                      <ol className="mt-1 space-y-1">
                        {testCase.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="text-sm">
                            <span className="font-medium">{step.step}.</span> {step.action}
                            <div className="text-xs text-gray-500 ml-4">
                              Expected: {step.expectedOutcome}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Expected Result:</Label>
                      <p className="text-sm text-gray-600">{testCase.expectedResult}</p>
                    </div>

                    {testCase.generatedCode && (
                      <div>
                        <Label className="text-xs font-semibold">Generated Code:</Label>
                        <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                          {testCase.generatedCode}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Test Cases
                  </>
                )}
              </Button>
            </>
          )}
          
          {step === 'results' && (
            <>
              <Button variant="outline" onClick={() => setStep('configure')}>
                Generate More
              </Button>
              <Button onClick={handleClose}>
                Save Test Cases
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 