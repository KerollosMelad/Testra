import OpenAI from 'openai';

// Create OpenAI client with provided API key and enhanced timeout configuration
export function createOpenAIClient(apiKey: string): OpenAI {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key. API key must start with "sk-"');
  }

  return new OpenAI({
    apiKey: apiKey,
    timeout: 120000, // 2 minutes timeout to handle longer requests
    maxRetries: 3,   // Retry failed requests up to 3 times with exponential backoff
    defaultHeaders: {
      'User-Agent': 'Testra-TestGenerator/1.0',
    },
  });
}

// Enhanced API key validation
export function isProjectOpenAIConfigured(apiKey: string): boolean {
  if (!apiKey) return false;
  if (typeof apiKey !== 'string') return false;
  if (!apiKey.startsWith('sk-')) return false;
  if (apiKey.length < 20) return false; // Basic length check
  return true;
}

// Test OpenAI API connection
export async function testOpenAIConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isProjectOpenAIConfigured(apiKey)) {
      return { success: false, error: 'Invalid API key format' };
    }

    const client = createOpenAIClient(apiKey);
    
    // Make a simple test request to verify the API key works
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 5,
      temperature: 0,
    });

    if (response.choices && response.choices.length > 0) {
      return { success: true };
    } else {
      return { success: false, error: 'No response from OpenAI API' };
    }
  } catch (error: any) {
    let errorMessage = 'Unknown error';
    
    if (error?.status === 401) {
      errorMessage = 'Invalid API key or insufficient permissions';
    } else if (error?.status === 403) {
      errorMessage = 'API key does not have required permissions';
    } else if (error?.status === 429) {
      errorMessage = 'Rate limit exceeded or insufficient credits';
    } else if (error?.status === 404) {
      errorMessage = 'API endpoint not found - check your API key and model access';
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
}

// Enhanced error handling for OpenAI API calls
export function handleOpenAIError(error: any): Error {
  let message = 'OpenAI API error';
  
  if (error?.status === 401) {
    message = 'Invalid OpenAI API key. Please check your API key in project settings.';
  } else if (error?.status === 403) {
    message = 'OpenAI API key does not have required permissions.';
  } else if (error?.status === 429) {
    message = 'OpenAI rate limit exceeded or insufficient credits. Please check your OpenAI account.';
  } else if (error?.status === 404) {
    message = 'OpenAI API endpoint not found. Please verify your API key has access to GPT-4.';
  } else if (error?.status >= 500) {
    message = 'OpenAI service is temporarily unavailable. Please try again later.';
  } else if (error?.message?.includes('Premature close')) {
    message = 'Connection to OpenAI was interrupted. Please try again.';
  } else if (error?.message?.includes('timeout')) {
    message = 'OpenAI request timed out. Please try again with a smaller request.';
  } else if (error?.message) {
    message = `OpenAI API error: ${error.message}`;
  }

  return new Error(message);
}

// Retry function with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
        throw handleOpenAIError(error);
      }

      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`OpenAI request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms...`, error?.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw handleOpenAIError(lastError!);
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