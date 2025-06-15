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
import { Loader2, Sparkles, CheckCircle, AlertCircle, Code, FileText, Zap, ArrowLeft, ChevronUp, ChevronDown, Eye, Save, Square, Trash2 } from "lucide-react";
import { WorkItem, EnhancedTestCase } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  isDuplicate?: boolean;
  duplicateOf?: string;
  contentHash?: string;
  similarityScore?: number;
  duplicateType?: 'exact' | 'semantic';
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

interface SavedTestCase {
  id: string;
  title: string;
  description: string;
  type: 'unit' | 'integration';
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
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'configure' | 'streaming' | 'results'>('configure');
  
  // Existing saved tests for duplicate detection
  const [existingSavedTests, setExistingSavedTests] = useState<SavedTestCase[]>([]);
  
  // Streaming state
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalTestCases, setTotalTestCases] = useState(0);
  const [allSuggestions, setAllSuggestions] = useState<string[]>([]);
  const [finalConfidence, setFinalConfidence] = useState(0);
  
  // Selection state
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Batch duplicate check state
  const [batchCheckingDuplicates, setBatchCheckingDuplicates] = useState(false);
  
  // Delete state
  const [deletingTestCases, setDeletingTestCases] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Selection state for existing test cases
  const [selectedExistingTestCases, setSelectedExistingTestCases] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const [activeTab, setActiveTab] = useState('work-item');

  // Refresh existing test cases
  const refreshExistingTests = async () => {
    try {
      const existingTestsResponse = await fetch(
        `/api/work-items/${workItemId}/test-cases?projectId=${projectId}`
      );
      if (existingTestsResponse.ok) {
        const existingTestsData = await existingTestsResponse.json();
        setExistingSavedTests(existingTestsData.testCases || []);
        
        // Clear selection when refreshing (in case some selected items were deleted)
        setSelectedExistingTestCases(prev => {
          const newTestCaseIds = new Set((existingTestsData.testCases || []).map((tc: any) => tc.id));
          const filteredSelection = new Set([...prev].filter(id => newTestCaseIds.has(id)));
          return filteredSelection;
        });
      }
    } catch (error) {
      console.error('Error refreshing existing tests:', error);
    }
  };

  // Fetch work item details and existing saved tests
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch work item
        const workItemResponse = await fetch(`/api/work-items/${workItemId}`);
        if (!workItemResponse.ok) {
          throw new Error('Failed to fetch work item details');
        }
        const workItemData = await workItemResponse.json();
        setWorkItem(workItemData.workItem);

        // Fetch existing saved test cases for this work item (for duplicate detection)
        await refreshExistingTests();
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch work item details');
      } finally {
        setLoading(false);
      }
    };

    if (workItemId && projectId) {
      fetchData();
    }
  }, [workItemId, projectId]);

  // Normalize text for semantic comparison
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  // Extract key semantic elements for comparison
  const extractSemanticSignature = (testCase: StreamingTestCase | SavedTestCase): string => {
    // Normalize title and description
    const normalizedTitle = normalizeText(testCase.title);
    const normalizedDescription = normalizeText(testCase.description);
    const normalizedExpectedResult = normalizeText(testCase.expectedResult);
    
    // Extract key actions from steps
    const stepActions = testCase.steps?.map(step => 
      normalizeText(step.action)
    ).join(' ') || '';
    
    // Create a semantic signature focusing on core functionality
    const semanticElements = [
      normalizedDescription,
      normalizedExpectedResult,
      stepActions
    ].filter(Boolean);
    
    return semanticElements.join(' | ');
  };

  // Calculate similarity between two semantic signatures
  const calculateSimilarity = (sig1: string, sig2: string): number => {
    const words1 = new Set(sig1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(sig2.split(/\s+/).filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    // Jaccard similarity
    return union.size > 0 ? intersection.size / union.size : 0;
  };

  // Generate content hash for exact matching (fallback)
  const generateContentHash = (testCase: StreamingTestCase): string => {
    const content = [
      testCase.title,
      testCase.description,
      JSON.stringify(testCase.steps),
      testCase.expectedResult
    ].join('|');
    
    // Simple hash function (in production, you might want to use crypto API)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  };

  // Check for duplicates using vector embeddings against existing saved test cases
  const checkAndMarkDuplicates = async (testCases: StreamingTestCase[]): Promise<StreamingTestCase[]> => {
    try {
      console.log('Checking generated test cases against existing saved test cases with vector embeddings');
      // If no test cases to check, return as is
      if (!testCases || testCases.length === 0) {
        return testCases;
      }

      // Call the vector-based duplicate detection API
      const response = await fetch('/api/ai/test-cases/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          testCases: testCases.map(tc => ({
            title: tc.title,
            description: tc.description,
            type: tc.type,
            priority: tc.priority,
            steps: tc.steps,
            expectedResult: tc.expectedResult,
            preconditions: tc.preconditions,
          })),
          similarityThreshold: 0.95, // 95% similarity threshold - more precise duplicate detection
          checkAgainstExistingOnly: true, // Ensure we only check against saved test cases
        }),
      });

      if (!response.ok) {
        console.error('Failed to check duplicates with vector embeddings, falling back to local check');
        return checkAndMarkDuplicatesLocal(testCases);
      }

      const duplicateResults = await response.json();
      
      if (!duplicateResults.success) {
        console.error('Duplicate check API returned error, falling back to local check');
        return checkAndMarkDuplicatesLocal(testCases);
      }

      console.log(`Duplicate check completed: ${duplicateResults.statistics.duplicatesFound}/${duplicateResults.statistics.totalChecked} duplicates found`);

      // Map the results back to the test cases
      return testCases.map((testCase, index) => {
        const result = duplicateResults.results.find((r: any) => r.originalIndex === index);
        if (result) {
          return {
            ...testCase,
            contentHash: generateContentHash(testCase),
            isDuplicate: result.isDuplicate,
            duplicateOf: result.duplicateOf,
            duplicateType: result.duplicateType,
            similarityScore: result.similarityScore,
          };
        }
        return {
          ...testCase,
          contentHash: generateContentHash(testCase),
          isDuplicate: false,
          duplicateType: undefined,
        };
      });

    } catch (error) {
      console.error('Error checking duplicates with vector embeddings:', error);
      // Fallback to local duplicate checking
      return checkAndMarkDuplicatesLocal(testCases);
    }
  };

  // Batch check all generated test cases after streaming is complete
  const batchCheckAllDuplicates = async (allTestCases: StreamingTestCase[]): Promise<StreamingTestCase[]> => {
    try {
      console.log(`Performing batch duplicate check for ${allTestCases.length} generated test cases against existing saved test cases`);
      
      if (!allTestCases || allTestCases.length === 0) {
        return allTestCases;
      }

      // Call the vector-based duplicate detection API for all test cases at once
      const response = await fetch('/api/ai/test-cases/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          testCases: allTestCases.map(tc => ({
            title: tc.title,
            description: tc.description,
            type: tc.type,
            priority: tc.priority,
            steps: tc.steps,
            expectedResult: tc.expectedResult,
            preconditions: tc.preconditions,
          })),
          similarityThreshold: 0.95, // 95% similarity threshold - more precise duplicate detection
          checkAgainstExistingOnly: true,
        }),
      });

      if (!response.ok) {
        console.error('Failed to perform batch duplicate check');
        return allTestCases;
      }

      const duplicateResults = await response.json();
      
      if (!duplicateResults.success) {
        console.error('Batch duplicate check API returned error');
        return allTestCases;
      }

      console.log(`Batch duplicate check completed: ${duplicateResults.statistics.duplicatesFound}/${duplicateResults.statistics.totalChecked} duplicates found`);
      console.log(`- Exact duplicates: ${duplicateResults.statistics.exactDuplicates}`);
      console.log(`- Semantic duplicates: ${duplicateResults.statistics.semanticDuplicates}`);
      console.log(`- Unique test cases: ${duplicateResults.statistics.uniqueTestCases}`);

      // Map the results back to the test cases
      return allTestCases.map((testCase, index) => {
        const result = duplicateResults.results.find((r: any) => r.originalIndex === index);
        if (result) {
          return {
            ...testCase,
            contentHash: generateContentHash(testCase),
            isDuplicate: result.isDuplicate,
            duplicateOf: result.duplicateOf,
            duplicateType: result.duplicateType,
            similarityScore: result.similarityScore,
          };
        }
        return {
          ...testCase,
          contentHash: generateContentHash(testCase),
          isDuplicate: false,
          duplicateType: undefined,
        };
      });

    } catch (error) {
      console.error('Error performing batch duplicate check:', error);
      return allTestCases;
    }
  };

  // Fallback local duplicate checking (original implementation)
  const checkAndMarkDuplicatesLocal = (testCases: StreamingTestCase[]): StreamingTestCase[] => {
    return testCases.map(testCase => {
      const hash = generateContentHash(testCase);
      const semanticSignature = extractSemanticSignature(testCase);
      
      // First try exact hash match
      let duplicate = existingSavedTests.find(saved => saved.contentHash === hash);
      let duplicateType: 'exact' | 'semantic' | undefined;
      let similarityScore: number | undefined;
      
      if (duplicate) {
        duplicateType = 'exact';
        similarityScore = 1.0;
      } else {
        // If no exact match, try semantic similarity (threshold: 0.8 = 80% similarity)
        let bestMatch: SavedTestCase | undefined;
        let bestSimilarity = 0;
        
        existingSavedTests.forEach(saved => {
          const savedSignature = extractSemanticSignature(saved);
          const similarity = calculateSimilarity(semanticSignature, savedSignature);
          if (similarity >= 0.8 && similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = saved;
          }
        });
        
        if (bestMatch) {
          duplicate = bestMatch;
          duplicateType = 'semantic';
          similarityScore = bestSimilarity;
        }
      }
      
      return {
        ...testCase,
        contentHash: hash,
        isDuplicate: !!duplicate,
        duplicateOf: duplicate?.id,
        duplicateType,
        similarityScore
      };
    });
  };

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
          workItemId: workItemId,
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
              await handleStreamEvent(data);
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

  const handleStreamEvent = async (event: any) => {
    switch (event.type) {
      case 'start':
        console.log('Starting generation for:', event.data.workItem);
        break;
        
      case 'chunk':
        // Check for duplicates using vector embeddings
        const testCasesWithDuplicateInfo = await checkAndMarkDuplicates(event.data.testCases);
        
        const chunkData: ChunkData = {
          ...event.data,
          testCases: testCasesWithDuplicateInfo
        };
        
        setChunks(prev => {
          const existing = prev.find(c => c.chunkId === chunkData.chunkId);
          if (existing) {
            return prev.map(c => c.chunkId === chunkData.chunkId ? chunkData : c);
          }
          return [...prev, chunkData];
        });
        
        setCurrentProgress(chunkData.progress);
        setTotalTestCases(prev => prev + chunkData.testCases.length);
        setAllSuggestions(prev => [...prev, ...chunkData.suggestions]);
        
        if (chunkData.isComplete) {
          setFinalConfidence(chunkData.confidence);
          
          // Option: Perform batch duplicate check after all chunks are complete
          // Uncomment the following lines if you want to re-check all test cases at once
          // console.log('Performing final batch duplicate check...');
          // const allTestCases = getAllTestCasesWithIds();
          // const finalCheckedTestCases = await batchCheckAllDuplicates(allTestCases);
          // // Update chunks with final duplicate check results
          // if (finalCheckedTestCases.length > 0) {
          //   // Update chunks state with the final results
          //   console.log('Updated all test cases with final duplicate check results');
          // }
          
          setStep('results');
          setStreaming(false);
        }
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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStreaming(false);
      setStep('results');
    }
  };

  const goBack = () => {
    router.push(`/projects/${projectId}/stories`);
  };

  const getTestCaseId = (chunkId: string, testIndex: number) => {
    return `${chunkId}-${testIndex}`;
  };

  const getAllTestCasesWithIds = () => {
    const allTestCases: Array<StreamingTestCase & { id: string }> = [];
    
    chunks.forEach(chunk => {
      chunk.testCases.forEach((testCase, index) => {
        allTestCases.push({
          ...testCase,
          id: getTestCaseId(chunk.chunkId, index)
        });
      });
    });
    
    return allTestCases;
  };

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

  const handleSelectAll = () => {
    const allIds = getAllTestCasesWithIds()
      .filter(tc => !tc.isDuplicate) // Only select non-duplicates
      .map(tc => tc.id);
    setSelectedTestCases(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedTestCases(new Set());
  };

  // Manual trigger for batch duplicate check
  const handleBatchDuplicateCheck = async () => {
    setBatchCheckingDuplicates(true);
    try {
      console.log('Manually triggering batch duplicate check...');
      const allTestCases = getAllTestCasesWithIds();
      
      if (allTestCases.length === 0) {
        console.log('No test cases to check');
        return;
      }

      const checkedTestCases = await batchCheckAllDuplicates(allTestCases);
      
      // Update chunks with the new duplicate check results
      const updatedChunks = chunks.map(chunk => {
        const updatedTestCases = chunk.testCases.map((testCase, index) => {
          const testCaseId = getTestCaseId(chunk.chunkId, index);
          const updatedTestCase = checkedTestCases.find(tc => 
            tc.title === testCase.title && tc.description === testCase.description
          );
          return updatedTestCase || testCase;
        });
        
        return {
          ...chunk,
          testCases: updatedTestCases
        };
      });
      
      setChunks(updatedChunks);
      console.log('Updated all chunks with batch duplicate check results');
      
    } catch (error) {
      console.error('Error performing manual batch duplicate check:', error);
    } finally {
      setBatchCheckingDuplicates(false);
    }
  };

  // Delete test case
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

      // Refresh the existing tests list
      await refreshExistingTests();
      
      // Remove from selected if it was selected
      setSelectedExistingTestCases(prev => {
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

  // Handle existing test case selection
  const handleExistingTestCaseSelect = (testCaseId: string, checked: boolean) => {
    setSelectedExistingTestCases(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(testCaseId);
      } else {
        newSet.delete(testCaseId);
      }
      return newSet;
    });
  };

  // Select all existing test cases
  const handleSelectAllExisting = () => {
    const allIds = existingSavedTests.map(tc => tc.id);
    setSelectedExistingTestCases(new Set(allIds));
  };

  // Deselect all existing test cases
  const handleDeselectAllExisting = () => {
    setSelectedExistingTestCases(new Set());
  };

  // Bulk delete selected test cases
  const handleBulkDeleteSelected = async () => {
    if (selectedExistingTestCases.size === 0) return;

    setBulkDeleting(true);
    setDeleteError(null);

    const testCasesToDelete = Array.from(selectedExistingTestCases);
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
          const testCase = existingSavedTests.find(tc => tc.id === testCaseId);
          errors.push(`Failed to delete "${testCase?.title || testCaseId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Refresh the existing tests list
      await refreshExistingTests();
      
      // Clear selection
      setSelectedExistingTestCases(new Set());

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

  const handleSaveSelected = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const allTestCases = getAllTestCasesWithIds();
      const selectedTestCasesToSave = allTestCases
        .filter(tc => selectedTestCases.has(tc.id) && !tc.isDuplicate)
        .map(tc => ({
          title: tc.title,
          description: tc.description,
          type: tc.type,
          priority: tc.priority,
          steps: tc.steps,
          expectedResult: tc.expectedResult,
          preconditions: tc.preconditions,
          testData: tc.testData,
          estimatedDuration: tc.estimatedDuration,
          generatedCode: tc.generatedCode,
          coveredCriteria: tc.coveredCriteria,
          chunkId: tc.chunkId,
          testCaseId: tc.id
        }));

      if (selectedTestCasesToSave.length === 0) {
        setSaveError('No valid test cases selected for saving');
        return;
      }

      const response = await fetch('/api/azure/test-cases/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          workItemId,
          testCases: selectedTestCasesToSave,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save test cases');
      }

      const result = await response.json();
      setSaveSuccess(true);
      
      // Refresh existing tests to update duplicate detection
      await refreshExistingTests();
      
      // Switch to existing tests tab to show the newly saved test cases
      setActiveTab('existing-tests');
      
      console.log('Saved test cases:', result);
    } catch (error) {
      console.error('Error saving test cases:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save test cases');
    } finally {
      setSaving(false);
    }
  };

  const getTestTypeDescription = (type: string) => {
    switch (type) {
      case 'unit': return 'Story-focused tests that validate specific functionality and acceptance criteria';
      case 'integration': return 'End-to-end tests that validate workflows across multiple components';
      default: return '';
    }
  };

  const getCoverageDescription = (level: string) => {
    switch (level) {
      case 'basic': return 'Generate essential test cases covering main paths and critical functionality';
      case 'comprehensive': return 'Generate thorough test cases including edge cases, error scenarios, and boundary conditions';
      case 'custom': return 'Generate test cases based on your specific requirements';
      default: return '';
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
    return type === 'unit' ? FileText : Code;
  };

  const getDuplicateStatus = (testCase: StreamingTestCase) => {
    if (testCase.isDuplicate) {
      const isExactMatch = testCase.duplicateType === 'exact';
      const similarity = testCase.similarityScore ? Math.round(testCase.similarityScore * 100) : 100;
      
      return (
        <div className="flex items-center gap-1 ml-2">
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            Already Saved
          </Badge>
          <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
            {isExactMatch ? 'Exact Match' : `${similarity}% Similar`}
          </Badge>
        </div>
      );
    }
    return (
      <Badge variant="outline" className="ml-2 border-green-200 text-green-700">
        <CheckCircle className="w-3 h-3 mr-1" />
        New
      </Badge>
    );
  };

  const getSavedTestStatus = () => {
    return (
      <Badge variant="default" className="ml-2 bg-blue-600">
        <CheckCircle className="w-3 h-3 mr-1" />
        Saved in DB
      </Badge>
    );
  };

  const renderSavedTestCase = (testCase: SavedTestCase, index: number) => {
    const isDeleting = deletingTestCases.has(testCase.id);
    const isSelected = selectedExistingTestCases.has(testCase.id);
    
    return (
      <Card key={`saved-${testCase.id}`} className={`border-blue-200 bg-blue-50/30 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => handleExistingTestCaseSelect(testCase.id, checked as boolean)}
                disabled={isDeleting || bulkDeleting}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{testCase.title}</h4>
                  {getSavedTestStatus()}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getPriorityColor(testCase.priority)}>
                    {testCase.priority}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {(() => {
                      const Icon = getTypeIcon(testCase.type);
                      return <Icon className="h-3 w-3" />;
                    })()}
                    {testCase.type}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {testCase.status}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteTestCase(testCase.id, testCase.title)}
              disabled={isDeleting || bulkDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div>
              <h5 className="font-semibold text-sm mb-1">Description:</h5>
              <p className="text-sm text-muted-foreground">{testCase.description}</p>
            </div>
            
            {testCase.steps && testCase.steps.length > 0 && (
              <div>
                <h5 className="font-semibold text-sm mb-2">Test Steps:</h5>
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
            )}
            
            <div>
              <h5 className="font-semibold text-sm mb-1">Expected Result:</h5>
              <p className="text-sm text-muted-foreground">{testCase.expectedResult}</p>
            </div>

            {testCase.preconditions && (
              <div>
                <h5 className="font-semibold text-sm mb-1">Preconditions:</h5>
                <p className="text-sm text-muted-foreground">{testCase.preconditions}</p>
              </div>
            )}

            {testCase.estimatedDuration && (
              <div>
                <h5 className="font-semibold text-sm mb-1">Estimated Duration:</h5>
                <p className="text-sm text-muted-foreground">{testCase.estimatedDuration} minutes</p>
              </div>
            )}

            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Saved on {new Date(testCase.createdAt).toLocaleDateString()} at {new Date(testCase.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!workItem) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Work Item Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>The requested work item could not be found.</p>
            <Button onClick={goBack} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={goBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Stories
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">AI Test Generation</h1>
        </div>
        <p className="text-muted-foreground">
          Generate comprehensive test cases for work item #{workItem.id}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="work-item" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Work Item Details
          </TabsTrigger>
          <TabsTrigger value="existing-tests" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Existing Tests ({existingSavedTests.length})
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate New Tests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="work-item" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{workItem.title}</CardTitle>
                  <CardDescription className="mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{workItem.workItemType}</Badge>
                      <Badge variant="outline">{workItem.state}</Badge>
                      {workItem.assignedTo && (
                        <Badge variant="secondary">{workItem.assignedTo}</Badge>
                      )}
                    </div>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {workItem.description}
                  </p>
                </div>
                
                {workItem.acceptanceCriteria && (
                  <div>
                    <h4 className="font-semibold mb-2">Acceptance Criteria</h4>
                    <div 
                      className="text-sm text-muted-foreground prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: workItem.acceptanceCriteria }}
                    />
                  </div>
                )}

                {workItem.tags && workItem.tags.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Tags</h4>
                    <div className="flex gap-1 flex-wrap">
                      {workItem.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="existing-tests" className="mt-6">
          {deleteError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          
          {existingSavedTests.length > 0 ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Existing Saved Test Cases ({existingSavedTests.length})
                  </CardTitle>
                  <CardDescription>
                    These test cases are already saved to Azure DevOps. You can select multiple test cases for bulk operations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-4">
                    <Button
                      onClick={handleSelectAllExisting}
                      variant="outline"
                      size="sm"
                      disabled={bulkDeleting}
                    >
                      Select All
                    </Button>
                    <Button
                      onClick={handleDeselectAllExisting}
                      variant="outline"
                      size="sm"
                      disabled={bulkDeleting}
                    >
                      Deselect All
                    </Button>
                    <div className="flex-1" />
                    {selectedExistingTestCases.size > 0 && (
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
                        Delete Selected ({selectedExistingTestCases.size})
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <div className="grid gap-4">
                {existingSavedTests.map((testCase, index) => renderSavedTestCase(testCase, index))}
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  No Existing Test Cases
                </CardTitle>
                <CardDescription>
                  No test cases have been saved for this work item yet. Use the "Generate New Tests" tab to create some.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => setActiveTab('generate')}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Test Cases
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="generate" className="mt-6">
          {step === 'configure' && (
            <div className="space-y-6">
              {/* Test Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Test Generation Configuration</CardTitle>
                  <CardDescription>
                    Configure the AI test generation settings for this work item
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="testType">Test Type</Label>
                      <Select value={testType} onValueChange={(value: 'unit' | 'integration') => setTestType(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select test type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unit">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Story Tests
                            </div>
                          </SelectItem>
                          <SelectItem value="integration">
                            <div className="flex items-center gap-2">
                              <Code className="h-4 w-4" />
                              Integration Tests
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {getTestTypeDescription(testType)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="coverageLevel">Coverage Level</Label>
                      <Select value={coverageLevel} onValueChange={(value: 'basic' | 'comprehensive' | 'custom') => setCoverageLevel(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select coverage level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic Coverage</SelectItem>
                          <SelectItem value="comprehensive">Comprehensive Coverage</SelectItem>
                          <SelectItem value="custom">Custom Requirements</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {getCoverageDescription(coverageLevel)}
                      </p>
                    </div>
                  </div>

                  {coverageLevel === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="customRequirements">Custom Test Requirements</Label>
                      <Textarea
                        id="customRequirements"
                        placeholder="Describe specific test scenarios, edge cases, or requirements you want the AI to focus on..."
                        value={customRequirements}
                        onChange={(e) => setCustomRequirements(e.target.value)}
                        rows={4}
                      />
                      <p className="text-sm text-muted-foreground">
                        Provide specific requirements for test case generation
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={handleGenerate} 
                  disabled={streaming || (coverageLevel === 'custom' && !customRequirements.trim())}
                  className="flex items-center gap-2"
                >
                  {streaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Generate Test Cases
                </Button>
              </div>
            </div>
          )}

          {step === 'streaming' && (
            <div className="space-y-6">
              {/* Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating Test Cases...
                  </CardTitle>
                  <CardDescription>
                    AI is analyzing acceptance criteria and generating test cases in chunks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{currentProgress}%</span>
                    </div>
                    <Progress value={currentProgress} className="w-full" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">{chunks.length}</div>
                      <div className="text-sm text-muted-foreground">Chunks Processed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{totalTestCases}</div>
                      <div className="text-sm text-muted-foreground">Test Cases Generated</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">
                        {getAllTestCasesWithIds().filter(tc => tc.isDuplicate).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Duplicates Detected</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {Math.round(finalConfidence * 100)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Final Confidence</div>
                    </div>
                  </div>

                  <Button 
                    onClick={handleStop} 
                    variant="outline"
                    className="w-full"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Generation
                  </Button>
                </CardContent>
              </Card>

              {/* Live Results */}
              {chunks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Generated Test Cases (Live)</CardTitle>
                    <CardDescription>
                      Test cases are being generated in real-time. Duplicates will be marked automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full">
                      {chunks.map((chunk, chunkIndex) => (
                        <AccordionItem key={chunk.chunkId} value={chunk.chunkId}>
                          <AccordionTrigger className="text-left">
                            <div className="flex items-center justify-between w-full mr-4">
                              <span>
                                Chunk {chunk.currentChunkIndex + 1}: {chunk.testCases.length} test cases
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {Math.round(chunk.confidence * 100)}% confidence
                                </Badge>
                                {chunk.isComplete ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              <div>
                                <h5 className="font-semibold mb-2">Acceptance Criteria Covered:</h5>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                  {chunk.acceptanceCriteria.map((criteria, index) => (
                                    <li key={index}>{criteria}</li>
                                  ))}
                                </ul>
                              </div>
                              
                              <div className="grid gap-3">
                                {chunk.testCases.map((testCase, testIndex) => {
                                  const testCaseId = getTestCaseId(chunk.chunkId, testIndex);
                                  return (
                                    <Card key={testCaseId} className={`${testCase.isDuplicate ? 'opacity-60 border-orange-200' : ''}`}>
                                      <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                          <div className="flex items-center gap-2">
                                            <Checkbox
                                              checked={selectedTestCases.has(testCaseId) && !testCase.isDuplicate}
                                              onCheckedChange={(checked) => handleTestCaseSelect(testCaseId, checked as boolean)}
                                              disabled={testCase.isDuplicate}
                                            />
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <h4 className="font-semibold">{testCase.title}</h4>
                                                {getDuplicateStatus(testCase)}
                                              </div>
                                              <div className="flex items-center gap-2 mt-1">
                                                <Badge className={getPriorityColor(testCase.priority)}>
                                                  {testCase.priority}
                                                </Badge>
                                                <Badge variant="outline" className="flex items-center gap-1">
                                                  {(() => {
                                                    const Icon = getTypeIcon(testCase.type);
                                                    return <Icon className="h-3 w-3" />;
                                                  })()}
                                                  {testCase.type}
                                                </Badge>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="pt-0">
                                        <div className="space-y-3">
                                          <div>
                                            <h5 className="font-semibold text-sm mb-1">Description:</h5>
                                            <p className="text-sm text-muted-foreground">{testCase.description}</p>
                                          </div>
                                          
                                          {testCase.steps && testCase.steps.length > 0 && (
                                            <div>
                                              <h5 className="font-semibold text-sm mb-2">Test Steps:</h5>
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
                                          )}
                                          
                                          <div>
                                            <h5 className="font-semibold text-sm mb-1">Expected Result:</h5>
                                            <p className="text-sm text-muted-foreground">{testCase.expectedResult}</p>
                                          </div>

                                          {testCase.preconditions && (
                                            <div>
                                              <h5 className="font-semibold text-sm mb-1">Preconditions:</h5>
                                              <p className="text-sm text-muted-foreground">{testCase.preconditions}</p>
                                            </div>
                                          )}

                                          {testCase.estimatedDuration && (
                                            <div>
                                              <h5 className="font-semibold text-sm mb-1">Estimated Duration:</h5>
                                              <p className="text-sm text-muted-foreground">{testCase.estimatedDuration} minutes</p>
                                            </div>
                                          )}

                                          {testCase.isDuplicate && testCase.duplicateOf && (
                                            <div className="p-2 bg-orange-50 border border-orange-200 rounded">
                                              <p className="text-sm text-orange-800">
                                                <AlertCircle className="w-4 h-4 inline mr-1" />
                                                This test case is similar to an existing saved test case (ID: {testCase.duplicateOf})
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === 'results' && (
            <div className="space-y-6">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Test Generation Complete
                  </CardTitle>
                  <CardDescription>
                    Review and select test cases to save to Azure DevOps
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center mb-6">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{existingSavedTests.length}</div>
                      <div className="text-sm text-muted-foreground">Already Saved</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{totalTestCases}</div>
                      <div className="text-sm text-muted-foreground">New Generated</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {getAllTestCasesWithIds().filter(tc => !tc.isDuplicate).length}
                      </div>
                      <div className="text-sm text-muted-foreground">New & Unique</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">
                        {getAllTestCasesWithIds().filter(tc => tc.isDuplicate).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Duplicates</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {Math.round(finalConfidence * 100)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Confidence</div>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-4">
                    <Button
                      onClick={handleSelectAll}
                      variant="outline"
                      size="sm"
                    >
                      Select All New
                    </Button>
                    <Button
                      onClick={handleDeselectAll}
                      variant="outline"
                      size="sm"
                    >
                      Deselect All
                    </Button>
                    <Button
                      onClick={handleBatchDuplicateCheck}
                      variant="outline"
                      size="sm"
                      disabled={batchCheckingDuplicates || chunks.length === 0}
                      className="flex items-center gap-2"
                    >
                      {batchCheckingDuplicates ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Re-check Duplicates
                    </Button>
                    <div className="flex-1" />
                    <Button
                      onClick={handleSaveSelected}
                      disabled={selectedTestCases.size === 0 || saving}
                      className="flex items-center gap-2"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Selected ({selectedTestCases.size})
                    </Button>
                  </div>

                  {saveError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                  )}

                  {saveSuccess && (
                    <Alert className="mb-4">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Test cases saved successfully to Azure DevOps!
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* All Test Cases */}
              <Card>
                <CardHeader>
                  <CardTitle>Generated Test Cases</CardTitle>
                  <CardDescription>
                    Review all generated test cases. Duplicates are automatically detected and marked.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {chunks.map((chunk, chunkIndex) => (
                      <AccordionItem key={chunk.chunkId} value={chunk.chunkId}>
                        <AccordionTrigger className="text-left">
                          <div className="flex items-center justify-between w-full mr-4">
                            <span>
                              Chunk {chunk.currentChunkIndex + 1}: {chunk.testCases.length} test cases
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {Math.round(chunk.confidence * 100)}% confidence
                              </Badge>
                              <Badge variant="secondary">
                                {chunk.testCases.filter(tc => !tc.isDuplicate).length} new
                              </Badge>
                              {chunk.testCases.filter(tc => tc.isDuplicate).length > 0 && (
                                <Badge variant="outline" className="border-orange-200 text-orange-700">
                                  {chunk.testCases.filter(tc => tc.isDuplicate).length} duplicate
                                </Badge>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div>
                              <h5 className="font-semibold mb-2">Acceptance Criteria Covered:</h5>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {chunk.acceptanceCriteria.map((criteria, index) => (
                                  <li key={index}>{criteria}</li>
                                ))}
                              </ul>
                            </div>
                            
                            <div className="grid gap-3">
                              {chunk.testCases.map((testCase, testIndex) => {
                                const testCaseId = getTestCaseId(chunk.chunkId, testIndex);
                                return (
                                  <Card key={testCaseId} className={`${testCase.isDuplicate ? 'opacity-60 border-orange-200' : ''}`}>
                                    <CardHeader className="pb-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            checked={selectedTestCases.has(testCaseId) && !testCase.isDuplicate}
                                            onCheckedChange={(checked) => handleTestCaseSelect(testCaseId, checked as boolean)}
                                            disabled={testCase.isDuplicate}
                                          />
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <h4 className="font-semibold">{testCase.title}</h4>
                                              {getDuplicateStatus(testCase)}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                              <Badge className={getPriorityColor(testCase.priority)}>
                                                {testCase.priority}
                                              </Badge>
                                              <Badge variant="outline" className="flex items-center gap-1">
                                                {(() => {
                                                  const Icon = getTypeIcon(testCase.type);
                                                  return <Icon className="h-3 w-3" />;
                                                })()}
                                                {testCase.type}
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                      <div className="space-y-3">
                                        <div>
                                          <h5 className="font-semibold text-sm mb-1">Description:</h5>
                                          <p className="text-sm text-muted-foreground">{testCase.description}</p>
                                        </div>
                                        
                                        {testCase.steps && testCase.steps.length > 0 && (
                                          <div>
                                            <h5 className="font-semibold text-sm mb-2">Test Steps:</h5>
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
                                        )}
                                        
                                        <div>
                                          <h5 className="font-semibold text-sm mb-1">Expected Result:</h5>
                                          <p className="text-sm text-muted-foreground">{testCase.expectedResult}</p>
                                        </div>

                                        {testCase.preconditions && (
                                          <div>
                                            <h5 className="font-semibold text-sm mb-1">Preconditions:</h5>
                                            <p className="text-sm text-muted-foreground">{testCase.preconditions}</p>
                                          </div>
                                        )}

                                        {testCase.estimatedDuration && (
                                          <div>
                                            <h5 className="font-semibold text-sm mb-1">Estimated Duration:</h5>
                                            <p className="text-sm text-muted-foreground">{testCase.estimatedDuration} minutes</p>
                                          </div>
                                        )}

                                        {testCase.isDuplicate && testCase.duplicateOf && (
                                          <div className="p-2 bg-orange-50 border border-orange-200 rounded">
                                            <p className="text-sm text-orange-800">
                                              <AlertCircle className="w-4 h-4 inline mr-1" />
                                              {testCase.duplicateType === 'exact' 
                                                ? `This test case exactly matches an existing saved test case (ID: ${testCase.duplicateOf})`
                                                : `This test case is ${Math.round((testCase.similarityScore || 0) * 100)}% similar to an existing saved test case (ID: ${testCase.duplicateOf})`
                                              }
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>

              {/* Suggestions */}
              {allSuggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>AI Suggestions</CardTitle>
                    <CardDescription>
                      Additional recommendations for testing this work item
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {allSuggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                          <span className="text-sm">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={() => setStep('configure')} 
                  variant="outline"
                >
                  Generate New Tests
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 