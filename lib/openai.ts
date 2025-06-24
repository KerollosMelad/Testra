import OpenAI from 'openai';

// Create OpenAI client with provided API key and timeout configuration
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey,
    timeout: 60000, // 60 seconds timeout to prevent hanging
    maxRetries: 2,  // Retry failed requests up to 2 times
  });
}

// Check if project-specific OpenAI is configured
export function isProjectOpenAIConfigured(apiKey: string): boolean {
  return Boolean(apiKey && apiKey.startsWith('sk-'));
}

// Types for OpenAI responses
export interface OpenAITestGenerationResponse {
  testCases: Array<{
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
  }>;
  suggestions: string[];
  confidence: number;
} 