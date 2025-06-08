'use client'
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, CheckCircle, AlertCircle, Code, FileText, Zap, Pause, Play, Square, ArrowLeft } from "lucide-react";
import { WorkItem } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface StreamingTestCase {
  title: string;
  description: string;
  type: 'unit' | 'integration';
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
  coveredCriteria?: string[];
  chunkId?: string;
}

interface ChunkData {
  chunkId: string;
  currentChunkIndex: number;
  totalChunks: number;
  progress: number;
  acceptanceCriteria: string[];
  testCases: StreamingTestCase[];
  suggestions: string[];
  confidence: number;
  isComplete: boolean;
  canPause: boolean;
}

export default function TestGenerationPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const workItemId = params.workItemId as string;

  const [workItem, setWorkItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [testType, setTestType] = useState<'unit' | 'integration'>('unit');
  const [coverageLevel, setCoverageLevel] = useState<'basic' | 'comprehensive' | 'custom'>('basic');
  const [customRequirements, setCustomRequirements] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'configure' | 'streaming' | 'results'>('configure');
  
  // Streaming state
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalTestCases, setTotalTestCases] = useState(0);
  const [allSuggestions, setAllSuggestions] = useState<string[]>([]);
  const [finalConfidence, setFinalConfidence] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch work item details
  useEffect(() => {
    const fetchWorkItem = async () => {
      try {
        const response = await fetch(`/api/work-items/${workItemId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch work item details');
        }
        
        const data = await response.json();
        setWorkItem(data.workItem);
      } catch (error) {
        console.error('Error fetching work item:', error);
        setError('Failed to fetch work item details');
      } finally {
        setLoading(false);
      }
    };

    if (workItemId && projectId) {
      fetchWorkItem();
    }
  }, [workItemId, projectId]);

  const handleGenerate = async () => {
    setStreaming(true);
    setError(null);
    setStep('streaming');
    setChunks([]);
    setCurrentProgress(0);
    setTotalTestCases(0);
    setAllSuggestions([]);
    setFinalConfidence(0);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/generate-tests/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          workItemId: workItem?.id,
          testType,
          coverageLevel,
          customRequirements: customRequirements || undefined,
          chunkSize: 3,
          maxTokensPerChunk: 1500,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate test cases');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(data);
            } catch (parseError) {
              console.error('Error parsing stream data:', parseError);
            }
          }
        }
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to generate test cases');
        setStep('configure');
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleStreamEvent = (event: any) => {
    switch (event.type) {
      case 'start':
        console.log('Starting generation for:', event.data.workItem);
        break;
        
      case 'chunk':
        const chunkData: ChunkData = event.data;
        setChunks(prev => {
          const existing = prev.find(c => c.chunkId === chunkData.chunkId);
          if (existing) {
            return prev.map(c => c.chunkId === chunkData.chunkId ? chunkData : c);
          }
          return [...prev, chunkData];
        });
        setCurrentProgress(chunkData.progress);
        setTotalTestCases(prev => prev + chunkData.testCases.length);
        break;
        
      case 'complete':
        setFinalConfidence(event.data.finalConfidence);
        setStep('results');
        setStreaming(false);
        break;
        
      case 'error':
        setError(event.data.error);
        setStep('configure');
        setStreaming(false);
        break;
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    // Note: In a real implementation, you'd send a pause signal to the backend
  };

  const handleResume = () => {
    setIsPaused(false);
    // Note: In a real implementation, you'd send a resume signal to the backend
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStreaming(false);
    setStep('configure');
    setChunks([]);
  };

  const goBack = () => {
    if (streaming && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    router.back();
  };

  const getTestTypeDescription = (type: string) => {
    switch (type) {
      case 'unit':
        return 'Test individual components/functions in isolation for this specific work item only';
      case 'integration':
        return 'Test interactions between components, leveraging similar work items and system dependencies';
      default:
        return '';
    }
  };

  const getCoverageDescription = (level: string) => {
    switch (level) {
      case 'basic':
        return 'Generate essential test scenarios covering main functionality and happy path';
      case 'comprehensive':
        return 'Generate detailed test coverage including edge cases, error handling, and all acceptance criteria';
      case 'custom':
        return 'Define specific test requirements and scenarios to focus on';
      default:
        return '';
    }
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
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const allTestCases = chunks.flatMap(chunk => chunk.testCases);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!workItem) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Work item not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Generate AI Test Cases</h1>
          </div>
        </div>
        <p className="text-gray-600">
          Generate comprehensive test cases for: <strong>{workItem.title}</strong>
        </p>
      </div>

      {step === 'configure' && (
        <div className="space-y-8">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Test Configuration</CardTitle>
                  <CardDescription>Configure the type and scope of test cases to generate</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="testType">Test Type</Label>
                      <Select value={testType} onValueChange={(value: any) => setTestType(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select test type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unit">
                            <div className="flex flex-col">
                              <span className="font-medium">Unit Tests</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="integration">
                            <div className="flex flex-col">
                              <span className="font-medium">Integration Tests</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-600 mt-2">
                        {getTestTypeDescription(testType)}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="coverageLevel">Coverage Level</Label>
                      <Select value={coverageLevel} onValueChange={(value: any) => setCoverageLevel(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select coverage level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">
                            <div className="flex flex-col">
                              <span className="font-medium">Basic Coverage</span>
                              <span className="text-xs text-gray-500">Essential scenarios only</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="comprehensive">
                            <div className="flex flex-col">
                              <span className="font-medium">Comprehensive Coverage</span>
                              <span className="text-xs text-gray-500">Detailed with edge cases</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="custom">
                            <div className="flex flex-col">
                              <span className="font-medium">Custom Requirements</span>
                              <span className="text-xs text-gray-500">Define specific scenarios</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-600 mt-2">
                        {getCoverageDescription(coverageLevel)}
                      </p>
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
                        className="mt-2"
                      />
                    </div>
                  )}

                  <div className="pt-4">
                    <Button onClick={handleGenerate} disabled={streaming} size="lg">
                      {streaming ? (
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
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Work Item Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge>{workItem.workItemType}</Badge>
                    <Badge variant="outline">{workItem.state}</Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Description</Label>
                    <p className="text-sm text-gray-600 mt-1">{workItem.description}</p>
                  </div>
                  {workItem.acceptanceCriteria && (
                    <div>
                      <Label className="text-sm font-semibold">Acceptance Criteria</Label>
                      <div className="text-sm text-gray-600 mt-1 bg-gray-50 p-3 rounded-md">
                        <pre className="whitespace-pre-wrap font-sans">{workItem.acceptanceCriteria}</pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {step === 'streaming' && (
        <div className="space-y-8">
          {/* Progress Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <div>
                    <CardTitle>Generating Test Cases</CardTitle>
                    <CardDescription>AI is analyzing acceptance criteria and creating comprehensive test cases</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-sm">{currentProgress}% Complete</Badge>
                  <Badge variant="outline" className="text-sm">{totalTestCases} tests generated</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={currentProgress} className="w-full h-2" />
                
                {/* Control Buttons */}
                <div className="flex justify-center gap-3">
                  {!isPaused ? (
                    <Button variant="outline" onClick={handlePause}>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleResume}>
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button variant="destructive" onClick={handleStop}>
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Streaming Results */}
          <div className="space-y-6">
            {chunks.map((chunk, chunkIndex) => (
              <div key={chunk.chunkId} className="space-y-4">
                {/* Acceptance Criteria Header */}
                <Card className="border-l-4 border-l-blue-500 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-blue-900">
                      Chunk {chunk.currentChunkIndex + 1} - Acceptance Criteria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {chunk.acceptanceCriteria.map((criteria, index) => (
                        <li key={index} className="text-blue-800 flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{criteria}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Test Cases for this chunk */}
                <div className="grid gap-4">
                  {chunk.testCases.map((testCase, testIndex) => (
                    <Card key={`${chunk.chunkId}-${testIndex}`} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              {getTypeIcon(testCase.type)}
                              <Badge variant="outline">{testCase.type}</Badge>
                              <Badge className={getPriorityColor(testCase.priority)}>
                                {testCase.priority}
                              </Badge>
                              {testCase.estimatedDuration && (
                                <Badge variant="secondary">
                                  ~{testCase.estimatedDuration}min
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-lg">{testCase.title}</CardTitle>
                            <CardDescription className="mt-2">{testCase.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>

                {chunkIndex < chunks.length - 1 && <Separator className="my-6" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'results' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <CardTitle>Generated {allTestCases.length} Test Cases</CardTitle>
                    <CardDescription>Test case generation completed successfully</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm">
                  Confidence: {Math.round(finalConfidence * 100)}%
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {allSuggestions.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>AI Suggestions:</strong>
                <ul className="mt-3 space-y-1">
                  {allSuggestions.slice(0, 5).map((suggestion, index) => (
                    <li key={index} className="text-sm">• {suggestion}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Final Results organized by chunks */}
          <div className="space-y-8">
            {chunks.map((chunk, chunkIndex) => (
              <div key={chunk.chunkId} className="space-y-4">
                {/* Acceptance Criteria Header */}
                <Card className="border-l-4 border-l-blue-500 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-blue-900">
                      Acceptance Criteria - Chunk {chunk.currentChunkIndex + 1}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {chunk.acceptanceCriteria.map((criteria, index) => (
                        <li key={index} className="text-blue-800 flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{criteria}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Test Cases for this chunk */}
                <div className="grid gap-6">
                  {chunk.testCases.map((testCase, testIndex) => (
                    <Card key={`${chunk.chunkId}-${testIndex}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              {getTypeIcon(testCase.type)}
                              <Badge variant="outline">{testCase.type}</Badge>
                              <Badge className={getPriorityColor(testCase.priority)}>
                                {testCase.priority}
                              </Badge>
                              {testCase.estimatedDuration && (
                                <Badge variant="secondary">
                                  ~{testCase.estimatedDuration}min
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-lg">{testCase.title}</CardTitle>
                            <CardDescription className="mt-2">{testCase.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {testCase.preconditions && (
                          <div>
                            <Label className="text-sm font-semibold">Preconditions:</Label>
                            <p className="text-sm text-gray-600 mt-1">{testCase.preconditions}</p>
                          </div>
                        )}
                        
                        <div>
                          <Label className="text-sm font-semibold">Test Steps:</Label>
                          <ol className="mt-2 space-y-2">
                            {testCase.steps.map((step, stepIndex) => (
                              <li key={stepIndex} className="text-sm border-l-2 border-gray-200 pl-4">
                                <span className="font-medium">{step.step}.</span> {step.action}
                                <div className="text-xs text-gray-500 mt-1">
                                  <strong>Expected:</strong> {step.expectedOutcome}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold">Expected Result:</Label>
                          <p className="text-sm text-gray-600 mt-1">{testCase.expectedResult}</p>
                        </div>

                        {testCase.generatedCode && (
                          <div>
                            <Label className="text-sm font-semibold">Generated Code:</Label>
                            <pre className="text-xs bg-gray-100 p-3 rounded-md mt-2 overflow-x-auto">
                              {testCase.generatedCode}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {chunkIndex < chunks.length - 1 && <Separator className="my-8" />}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 pt-6">
            <Button variant="outline" size="lg" onClick={() => setStep('configure')}>
              Generate More
            </Button>
            <Button size="lg">
              Save Test Cases
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 