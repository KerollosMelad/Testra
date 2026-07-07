'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WorkItemsList } from "@/components/dashboard/work-items-list";
import { TestCaseCard, TestCaseData } from "@/components/test-cases/test-case-card";
import { 
  Info, 
  FolderOpen, 
  TestTube, 
  GitBranch, 
  Settings,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2
} from "lucide-react";
import Link from "next/link";

interface ProjectData {
  id: string;
  name: string;
  description?: string;
  organization: string;
  project: string;
  token: string;
  openaiApiKey?: string;
  aiModel?: string;
  temperature?: number;
  maxTokens?: number;
  autoGeneration?: boolean;
  aiChat?: boolean;
  codeGeneration?: boolean;
  createdAt: Date;
  lastSync?: Date;
}

interface ProjectTabsProps {
  project: ProjectData;
  defaultTab?: string;
}

export function ProjectTabs({ project, defaultTab = "overview" }: ProjectTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || defaultTab;
  });
  const [testCases, setTestCases] = useState<TestCaseData[]>([]);
  const [loadingTestCases, setLoadingTestCases] = useState(false);
  const [testCasesError, setTestCasesError] = useState<string | null>(null);
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set());
  const [deletingTestCases, setDeletingTestCases] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Handle tab changes and update URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (newTab === defaultTab) {
      newSearchParams.delete('tab');
    } else {
      newSearchParams.set('tab', newTab);
    }
    const newUrl = `${pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  };

  // Update active tab when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ['overview', 'work-items', 'test-cases'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Fetch test cases when test cases tab is accessed
  const fetchTestCases = async () => {
    try {
      setLoadingTestCases(true);
      setTestCasesError(null);
      
      const response = await fetch(`/api/projects/${project.id}/test-cases`);
      if (!response.ok) {
        throw new Error('Failed to fetch test cases');
      }
      
      const data = await response.json();
      setTestCases(data.testCases || []);
    } catch (error) {
      console.error('Error fetching test cases:', error);
      setTestCasesError(error instanceof Error ? error.message : 'Failed to fetch test cases');
    } finally {
      setLoadingTestCases(false);
    }
  };

  // Load test cases when switching to test cases tab
  useEffect(() => {
    if (activeTab === 'test-cases' && testCases.length === 0 && !loadingTestCases) {
      fetchTestCases();
    }
  }, [activeTab]);

  // Handle test case selection
  const handleTestCaseSelect = (testCaseId: string, checked: boolean) => {
    setSelectedTestCases(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(testCaseId);
      } else {
        newSet.delete(testCaseId);
      }
      return newSet;
    });
  };

  // Select all test cases
  const handleSelectAll = () => {
    const allIds = testCases.map(tc => tc.id);
    setSelectedTestCases(new Set(allIds));
  };

  // Deselect all test cases
  const handleDeselectAll = () => {
    setSelectedTestCases(new Set());
  };

  // Delete single test case
  const handleDeleteTestCase = async (testCaseId: string, testCaseTitle: string) => {
    setDeletingTestCases(prev => new Set([...prev, testCaseId]));

    try {
      const response = await fetch(`/api/test-cases/${testCaseId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete test case');
      }

      // Refresh the test cases list
      await fetchTestCases();
      
      // Remove from selected if it was selected
      setSelectedTestCases(prev => {
        const newSet = new Set(prev);
        newSet.delete(testCaseId);
        return newSet;
      });
      
      console.log(`Successfully deleted test case: ${testCaseTitle}`);
    } catch (error) {
      console.error('Error deleting test case:', error);
      setTestCasesError(error instanceof Error ? error.message : 'Failed to delete test case');
    } finally {
      setDeletingTestCases(prev => {
        const newSet = new Set(prev);
        newSet.delete(testCaseId);
        return newSet;
      });
    }
  };

  // Bulk delete selected test cases
  const handleBulkDeleteSelected = async () => {
    if (selectedTestCases.size === 0) return;

    setBulkDeleting(true);
    const testCasesToDelete = Array.from(selectedTestCases);
    let successCount = 0;

    try {
      for (const testCaseId of testCasesToDelete) {
        try {
          const response = await fetch(`/api/test-cases/${testCaseId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            successCount++;
          }
        } catch (error) {
          console.error(`Error deleting test case ${testCaseId}:`, error);
        }
      }

      // Refresh the test cases list
      await fetchTestCases();
      
      // Clear selection
      setSelectedTestCases(new Set());

      console.log(`Bulk delete completed: ${successCount} successful`);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      setTestCasesError('Failed to complete bulk delete operation');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Handle view code
  const handleViewCode = (testCase: TestCaseData) => {
    console.log('View code for test case:', testCase.title);
  };

  // Handle run test
  const handleRunTest = (testCase: TestCaseData) => {
    console.log('Run test case:', testCase.title);
  };

  // Get test case statistics
  const testCaseStats = {
    total: testCases.length,
    unit: testCases.filter(tc => tc.type === 'unit').length,
    integration: testCases.filter(tc => tc.type === 'integration').length,
    e2e: testCases.filter(tc => tc.type === 'e2e').length,
    high: testCases.filter(tc => tc.priority === 'high').length,
    medium: testCases.filter(tc => tc.priority === 'medium').length,
    low: testCases.filter(tc => tc.priority === 'low').length,
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview" className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="work-items" className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Work Items
        </TabsTrigger>
        <TabsTrigger value="test-cases" className="flex items-center gap-2">
          <TestTube className="w-4 h-4" />
          Test Cases ({testCaseStats.total})
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Project Details
            </CardTitle>
            <CardDescription>
              Configuration and information about this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="text-sm text-gray-500">Organization:</span>
                <div className="font-medium text-lg">{project.organization}</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Project:</span>
                <div className="font-medium text-lg">{project.project}</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Created:</span>
                <div className="font-medium text-lg">
                  {project.createdAt.toLocaleDateString()}
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Last Sync:</span>
                <div className="font-medium text-lg">
                  {project.lastSync ? project.lastSync.toLocaleDateString() : "Never"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
            <CardDescription>
              Settings for AI-powered test generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <span className="text-sm text-gray-500">AI Model:</span>
                <div className="font-medium">{project.aiModel || 'GPT-4o'}</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Temperature:</span>
                <div className="font-medium">{project.temperature || 0.7}</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Max Tokens:</span>
                <div className="font-medium">{project.maxTokens || 4000}</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Auto Generation:</span>
                <Badge variant={project.autoGeneration ? "default" : "secondary"}>
                  {project.autoGeneration ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div>
                <span className="text-sm text-gray-500">AI Chat:</span>
                <Badge variant={project.aiChat ? "default" : "secondary"}>
                  {project.aiChat ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div>
                <span className="text-sm text-gray-500">Code Generation:</span>
                <Badge variant={project.codeGeneration ? "default" : "secondary"}>
                  {project.codeGeneration ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks for this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button onClick={() => handleTabChange('work-items')}>
                <FolderOpen className="w-4 h-4 mr-2" />
                View Work Items
              </Button>
              <Button onClick={() => handleTabChange('test-cases')} variant="outline">
                <TestTube className="w-4 h-4 mr-2" />
                View Test Cases
              </Button>
              <Link href={`/projects/${project.id}/settings`}>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Work Items Tab */}
      <TabsContent value="work-items" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Work Items
            </CardTitle>
            <CardDescription>
              User stories, tasks, bugs, and features from Azure DevOps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkItemsList
              organization={project.organization}
              project={project.project}
              token={project.token}
              projectId={project.id}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Test Cases Tab */}
      <TabsContent value="test-cases" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="w-5 h-5" />
                  Test Cases ({testCaseStats.total})
                </CardTitle>
                <CardDescription>
                  AI-generated test cases for this project
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={fetchTestCases} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Link href={`/projects/${project.id}/test-cases`}>
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTestCases ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading test cases...</span>
                </div>
              </div>
            ) : testCasesError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{testCasesError}</AlertDescription>
              </Alert>
            ) : testCases.length === 0 ? (
              <div className="text-center py-8">
                <TestTube className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Test Cases Found
                </h3>
                <p className="text-gray-600 mb-4">
                  Start by generating test cases for your work items.
                </p>
                <Button onClick={() => handleTabChange('work-items')}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  View Work Items
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{testCaseStats.total}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{testCaseStats.unit}</div>
                      <div className="text-sm text-muted-foreground">Unit</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{testCaseStats.integration}</div>
                      <div className="text-sm text-muted-foreground">Integration</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">{testCaseStats.e2e}</div>
                      <div className="text-sm text-muted-foreground">E2E</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{testCaseStats.high}</div>
                      <div className="text-sm text-muted-foreground">High Priority</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">{testCaseStats.medium}</div>
                      <div className="text-sm text-muted-foreground">Medium Priority</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-gray-600">{testCaseStats.low}</div>
                      <div className="text-sm text-muted-foreground">Low Priority</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bulk Actions */}
                {testCases.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button
                            onClick={handleSelectAll}
                            variant="outline"
                            size="sm"
                            disabled={bulkDeleting}
                          >
                            Select All ({testCases.length})
                          </Button>
                          <Button
                            onClick={handleDeselectAll}
                            variant="outline"
                            size="sm"
                            disabled={bulkDeleting}
                          >
                            Deselect All
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {selectedTestCases.size} selected
                          </span>
                        </div>
                        {selectedTestCases.size > 0 && (
                          <Button
                            onClick={handleBulkDeleteSelected}
                            variant="destructive"
                            size="sm"
                            disabled={bulkDeleting}
                            className="flex items-center gap-2"
                          >
                            {bulkDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Delete Selected ({selectedTestCases.size})
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Test Cases List */}
                <div className="space-y-4">
                  {testCases.slice(0, 5).map((testCase) => (
                    <TestCaseCard
                      key={testCase.id}
                      testCase={testCase}
                      isSelected={selectedTestCases.has(testCase.id)}
                      onSelect={handleTestCaseSelect}
                      onDelete={handleDeleteTestCase}
                      onViewCode={handleViewCode}
                      onRunTest={handleRunTest}
                      showSelection={true}
                      showWorkItem={true}
                      showActions={true}
                      isDeleting={deletingTestCases.has(testCase.id) || bulkDeleting}
                    />
                  ))}
                  {testCases.length > 5 && (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground mb-4">
                          Showing 5 of {testCases.length} test cases
                        </p>
                        <Link href={`/projects/${project.id}/test-cases`}>
                          <Button>
                            View All {testCases.length} Test Cases
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
} 