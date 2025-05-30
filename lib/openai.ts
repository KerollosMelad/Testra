import OpenAI from 'openai';

// Create OpenAI client with provided API key
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey,
  });
}

// Initialize default OpenAI client (for backward compatibility)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export { openai };

// Check if global OpenAI is configured (for backward compatibility)
export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Check if project-specific OpenAI is configured
export function isProjectOpenAIConfigured(apiKey: string): boolean {
  return Boolean(apiKey && apiKey.startsWith('sk-'));
}

// Types for OpenAI responses
export interface OpenAITestGenerationRequest {
  userStory: {
    id: string;
    title: string;
    description: string;
    acceptanceCriteria?: string;
  };
  projectContext: {
    name: string;
    domain?: string;
    businessRules?: string[];
  };
  testType: 'unit' | 'integration' | 'e2e' | 'api';
  coverageLevel: 'basic' | 'comprehensive' | 'custom';
  customRequirements?: string;
}

export interface OpenAITestGenerationResponse {
  testCases: Array<{
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
  }>;
  suggestions: string[];
  confidence: number;
}

// Helper function to get available models
export function getAvailableModels(): Array<{ id: string; name: string; description: string }> {
  return [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'Most capable model, best for complex test generation'
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      description: 'Faster and more cost-effective than GPT-4'
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient for simpler test cases'
    }
  ];
} 