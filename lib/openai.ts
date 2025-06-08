import OpenAI from 'openai';

// Create OpenAI client with provided API key
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey,
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