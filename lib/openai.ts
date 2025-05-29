import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export { openai };

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

// Helper function to check if OpenAI is configured
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
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