import { createOpenAIClient, OpenAITestGenerationRequest, OpenAITestGenerationResponse } from './openai';
import { WorkItem, TestCase, TestGenerationContext, TestGenerationResult } from './types';
import OpenAI from 'openai';

export class AITestGenerator {
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private openai: OpenAI;

  constructor(
    apiKey: string,
    model: string = 'gpt-4', 
    temperature: number = 0.7, 
    maxTokens: number = 2000
  ) {
    this.openai = createOpenAIClient(apiKey);
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async generateTestCases(context: TestGenerationContext): Promise<TestGenerationResult> {
    try {
      const prompt = this.buildPrompt(context);
      
      // Be more conservative with JSON format support - only enable for models we're absolutely sure about
      console.log('Using model:', this.model);
      const supportsJsonFormat = (
        this.model === 'gpt-4' || 
        this.model === 'gpt-4-turbo' || 
        this.model === 'gpt-4-turbo-preview' ||
        this.model === 'gpt-4-1106-preview' ||
        this.model === 'gpt-3.5-turbo-1106' || 
        this.model === 'gpt-3.5-turbo-0125'
      );
      
      console.log('Model supports JSON format:', supportsJsonFormat);
      
      const completionParams: any = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      };

      // Only add response_format for models that definitely support it
      if (supportsJsonFormat) {
        completionParams.response_format = { type: 'json_object' };
        console.log('Using structured JSON response format');
      } else {
        console.log('Using text response format with JSON parsing');
      }

      let completion;
      try {
        completion = await this.openai.chat.completions.create(completionParams);
      } catch (formatError: any) {
        // If the error is about response_format, retry without it
        if (formatError.message?.includes('response_format')) {
          console.log('JSON format not supported, retrying without response_format');
          delete completionParams.response_format;
          completion = await this.openai.chat.completions.create(completionParams);
        } else {
          throw formatError;
        }
      }

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      let parsedResponse: OpenAITestGenerationResponse;
      
      try {
        // Try to parse as JSON
        parsedResponse = JSON.parse(response);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResponse = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            // If still fails, create a fallback response
            parsedResponse = this.createFallbackResponse(response, context);
          }
        } else {
          // Create fallback response if no JSON found
          parsedResponse = this.createFallbackResponse(response, context);
        }
      }
      
      return this.transformToTestGenerationResult(parsedResponse, context);
    } catch (error) {
      console.error('Error generating test cases:', error);
      throw new Error(`Failed to generate test cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert QA engineer and test automation specialist. Your task is to generate comprehensive test cases based on user stories and project context.

Guidelines:
1. Generate test cases that cover both positive and negative scenarios
2. Include edge cases and boundary conditions
3. Consider user experience and accessibility
4. Provide clear, actionable test steps
5. Include appropriate test data and expected results
6. Consider the specified test type (unit, integration, e2e, api)
7. Match the coverage level requested (basic, comprehensive, custom)

IMPORTANT: You MUST respond with a valid JSON object only. Do not include any text before or after the JSON. The response must be parseable JSON.

Response format: Return ONLY a valid JSON object with the following structure:
{
  "testCases": [
    {
      "title": "string",
      "description": "string", 
      "type": "unit|integration|e2e|api",
      "priority": "low|medium|high",
      "steps": [
        {
          "step": number,
          "action": "string",
          "expectedOutcome": "string",
          "testData": {}
        }
      ],
      "expectedResult": "string",
      "preconditions": "string",
      "testData": {},
      "estimatedDuration": number,
      "generatedCode": "string"
    }
  ],
  "suggestions": ["string"],
  "confidence": number
}`;
  }

  private buildPrompt(context: TestGenerationContext): string {
    const { project, userStory, relatedTasks, existingTestCases, testType, coverageLevel, customRequirements } = context;

    let prompt = `Generate ${testType} test cases for the following user story:

**Project Context:**
- Name: ${project.name}
- Domain: ${project.domain || 'Not specified'}
- Business Rules: ${project.businessRules?.join(', ') || 'None specified'}

**User Story:**
- ID: ${userStory.id}
- Title: ${userStory.title}
- Description: ${userStory.description}
- Acceptance Criteria: ${userStory.acceptanceCriteria || 'Not provided'}
- State: ${userStory.state}
- Priority: ${userStory.priority || 'Not specified'}

**Related Tasks:**
${relatedTasks.length > 0 ? relatedTasks.map(task => `- ${task.title} (${task.state})`).join('\n') : 'No related tasks'}

**Test Requirements:**
- Test Type: ${testType}
- Coverage Level: ${coverageLevel}
- Custom Requirements: ${customRequirements || 'None'}

**Existing Test Cases:**
${existingTestCases.length > 0 ? `${existingTestCases.length} existing test cases found. Avoid duplication.` : 'No existing test cases'}

Please generate comprehensive test cases that:
1. Cover the acceptance criteria thoroughly
2. Include both positive and negative test scenarios
3. Consider edge cases and error conditions
4. Are appropriate for ${testType} testing
5. Match the ${coverageLevel} coverage level requested
6. Include realistic test data and expected outcomes
7. Provide estimated duration in minutes
8. Include generated code examples where applicable (especially for unit and API tests)

Focus on quality over quantity. Each test case should be clear, actionable, and valuable.`;

    return prompt;
  }

  private transformToTestGenerationResult(
    response: OpenAITestGenerationResponse, 
    context: TestGenerationContext
  ): TestGenerationResult {
    const testCases = response.testCases.map(testCase => ({
      title: testCase.title,
      description: testCase.description,
      type: testCase.type,
      priority: testCase.priority,
      status: 'draft' as const,
      steps: testCase.steps,
      expectedResult: testCase.expectedResult,
      preconditions: testCase.preconditions,
      testData: testCase.testData,
      estimatedDuration: testCase.estimatedDuration,
      projectId: '', // Will be set when saving
      generatedAt: new Date(),
      generatedBy: 'ai' as const,
      generatedCode: testCase.generatedCode,
    }));

    const relationships = testCases.map((_, index) => ({
      testCaseId: '', // Will be set when saving
      workItemId: context.userStory.id,
      relationType: 'covers' as const,
    }));

    return {
      testCases,
      relationships,
      suggestions: response.suggestions || [],
      confidence: response.confidence || 0.8,
    };
  }

  // Create a fallback response when JSON parsing fails
  private createFallbackResponse(response: string, context: TestGenerationContext): OpenAITestGenerationResponse {
    // Extract test case information from the text response
    const lines = response.split('\n').filter(line => line.trim());
    
    // Try to create a basic test case from the response
    const testCase = {
      title: `Test case for ${context.userStory.title}`,
      description: `Generated test case for work item: ${context.userStory.title}`,
      type: context.testType,
      priority: 'medium' as const,
      steps: [
        {
          step: 1,
          action: `Test the functionality described in: ${context.userStory.title}`,
          expectedOutcome: 'The feature should work as expected',
          testData: {}
        }
      ],
      expectedResult: 'The test should pass and validate the acceptance criteria',
      preconditions: 'System should be in a ready state',
      testData: {},
      estimatedDuration: 15,
      generatedCode: `// Test code for ${context.userStory.title}\n// TODO: Implement test logic`
    };

    return {
      testCases: [testCase],
      suggestions: [
        'The AI response could not be parsed as JSON. Please try again.',
        'Consider using a more recent model that supports structured output.',
        'Review the generated test case and modify as needed.'
      ],
      confidence: 0.5
    };
  }

  // Method to generate test code specifically
  async generateTestCode(
    testCase: Partial<TestCase>, 
    framework: string = 'jest',
    language: string = 'typescript'
  ): Promise<string> {
    try {
      const prompt = `Generate ${framework} test code in ${language} for the following test case:

**Test Case:**
- Title: ${testCase.title}
- Description: ${testCase.description}
- Type: ${testCase.type}
- Steps: ${testCase.steps?.map(step => `${step.step}. ${step.action} - Expected: ${step.expectedOutcome}`).join('\n')}
- Expected Result: ${testCase.expectedResult}

Please generate clean, well-commented, and executable test code that follows best practices for ${framework} and ${language}.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert test automation engineer. Generate clean, executable test code using ${framework} framework in ${language}. Follow best practices and include proper assertions, setup, and teardown as needed.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent code generation
        max_tokens: 1500,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating test code:', error);
      throw new Error(`Failed to generate test code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Factory function to create AI test generator with project settings
export function createAITestGenerator(
  apiKey: string,
  model: string = 'gpt-4',
  temperature: number = 0.7,
  maxTokens: number = 2000
): AITestGenerator {
  return new AITestGenerator(apiKey, model, temperature, maxTokens);
} 