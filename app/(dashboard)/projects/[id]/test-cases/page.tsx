'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TestCaseCard, TestCaseData } from "@/components/test-cases/test-case-card";
import { 
  TestTube, 
  Search, 
  Filter, 
  Loader2, 
  AlertCircle, 
  Trash2,
  Code,
  Play,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

interface ProjectTestCasesPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProjectTestCasesPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [testCases, setTestCases] = useState<TestCaseData[]>([]);
  const [filteredTestCases, setFilteredTestCases] = useState<TestCaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set());
  const [deletingTestCases, setDeletingTestCases] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch test cases
  const fetchTestCases = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/projects/${projectId}/test-cases`);
      if (!response.ok) {
        throw new Error('Failed to fetch test cases');
      }
      
      const data = await response.json();
      setTestCases(data.testCases || []);
    } catch (error) {
      console.error('Error fetching test cases:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch test cases');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (projectId) {
      fetchTestCases();
    }
  }, [projectId]);

  // Filter test cases
  useEffect(() => {
    let filtered = testCases;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(tc => 
        tc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tc.workItem?.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tc => tc.type === typeFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(tc => tc.priority === priorityFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tc => tc.status.toLowerCase() === statusFilter);
    }

    setFilteredTestCases(filtered);
  }, [testCases, searchTerm, typeFilter, priorityFilter, statusFilter]);

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
    const allIds = filteredTestCases.map(tc => tc.id);
    setSelectedTestCases(new Set(allIds));
  };

  // Deselect all test cases
  const handleDeselectAll = () => {
    setSelectedTestCases(new Set());
  };

  // Delete single test case
  const handleDeleteTestCase = async (testCaseId: string, testCaseTitle: string) => {
    setDeleteError(null);
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
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete test case');
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
    setDeleteError(null);

    const testCasesToDelete = Array.from(selectedTestCases);
    const errors: string[] = [];
    let successCount = 0;

    try {
      // Delete test cases one by one
      for (const testCaseId of testCasesToDelete) {
        try {
          const response = await fetch(`/api/test-cases/${testCaseId}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete test case');
          }

          successCount++;
        } catch (error) {
          const testCase = testCases.find(tc => tc.id === testCaseId);
          errors.push(`Failed to delete "${testCase?.title || testCaseId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Refresh the test cases list
      await fetchTestCases();
      
      // Clear selection
      setSelectedTestCases(new Set());

      if (errors.length > 0) {
        setDeleteError(`Successfully deleted ${successCount} test cases. Errors: ${errors.join(', ')}`);
      }

      console.log(`Bulk delete completed: ${successCount} successful, ${errors.length} errors`);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      setDeleteError('Failed to complete bulk delete operation');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Handle view code
  const handleViewCode = (testCase: TestCaseData) => {
    // TODO: Implement code viewing modal or navigation
    console.log('View code for test case:', testCase.title);
  };

  // Handle run test
  const handleRunTest = (testCase: TestCaseData) => {
    // TODO: Implement test execution
    console.log('Run test case:', testCase.title);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
  };

  // Get statistics
  const stats = {
    total: testCases.length,
    unit: testCases.filter(tc => tc.type === 'unit').length,
    integration: testCases.filter(tc => tc.type === 'integration').length,
    e2e: testCases.filter(tc => tc.type === 'e2e').length,
    high: testCases.filter(tc => tc.priority === 'high').length,
    medium: testCases.filter(tc => tc.priority === 'medium').length,
    low: testCases.filter(tc => tc.priority === 'low').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading test cases...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Cases</h1>
          <p className="text-gray-600 mt-1">All test cases generated for this project</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${projectId}?tab=test-cases`}>
            <Button variant="outline" size="sm">
              Back to Project
            </Button>
          </Link>
          <Button onClick={fetchTestCases} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.unit}</div>
            <div className="text-sm text-muted-foreground">Unit</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.integration}</div>
            <div className="text-sm text-muted-foreground">Integration</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.e2e}</div>
            <div className="text-sm text-muted-foreground">E2E</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.high}</div>
            <div className="text-sm text-muted-foreground">High Priority</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
            <div className="text-sm text-muted-foreground">Medium Priority</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.low}</div>
            <div className="text-sm text-muted-foreground">Low Priority</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input 
                placeholder="Search test cases..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="unit">Unit</SelectItem>
                <SelectItem value="integration">Integration</SelectItem>
                <SelectItem value="e2e">E2E</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {filteredTestCases.length > 0 && (
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
                  Select All ({filteredTestCases.length})
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

      {/* Error Display */}
      {(error || deleteError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Test Cases List */}
      {filteredTestCases.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <TestTube className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {testCases.length === 0 ? 'No Test Cases Found' : 'No Test Cases Match Your Filters'}
            </h3>
            <p className="text-gray-600 mb-4">
              {testCases.length === 0 
                ? 'Start by generating test cases for your work items.'
                : 'Try adjusting your search criteria or clearing the filters.'
              }
            </p>
            {testCases.length > 0 && (
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTestCases.map((testCase) => (
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
        </div>
      )}
    </div>
  );
} 