import { createOpenAIClient, OpenAITestGenerationRequest, OpenAITestGenerationResponse } from './openai';
import { WorkItem, TestCase, TestGenerationContext, TestGenerationResult } from './types';
import { createEmbeddingService } from './embedding-service';
import OpenAI from 'openai';

export class AITestGenerator {
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private openai: OpenAI;
  private embeddingService: any;

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
    this.embeddingService = createEmbeddingService(apiKey);
  }

  async generateTestCases(context: TestGenerationContext): Promise<TestGenerationResult> {
    try {
      // Enhance context with related work items ONLY for integration tests
      const enhancedContext = await this.enhanceContextWithSimilarItems(context);
      
      // Build the prompt
      const prompt = this.buildPrompt(enhancedContext);
      
      // Get AI response
      const response = await this.getAIResponse(prompt);
      
      // Transform and return result
      return this.transformToTestGenerationResult(response, enhancedContext);
    } catch (error) {
      console.error('Error generating test cases:', error);
      throw new Error(`Failed to generate test cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async enhanceContextWithSimilarItems(context: TestGenerationContext): Promise<TestGenerationContext> {
    try {
      // Only enhance context for integration tests - unit tests should focus on the specific work item only
      if (context.testType !== 'integration') {
        console.log('Unit test mode: focusing on specific work item only');
        return {
          ...context,
          relatedTasks: [], // Clear related tasks for unit tests
        };
      }

      console.log('Integration test mode: finding similar work items using embeddings');
      
      // Create search query from user story
      const searchQuery = this.createSearchQuery(context.userStory);
      
      // Find similar work items using embeddings for integration tests
      const similarWorkItems = await this.findSimilarWorkItems(searchQuery, context.userStory.id);
      
      // Find similar test cases to avoid duplication
      const similarTestCases = await this.findSimilarTestCases(searchQuery);
      
      return {
        ...context,
        relatedTasks: [...context.relatedTasks, ...similarWorkItems],
        existingTestCases: [...context.existingTestCases, ...similarTestCases]
      };
    } catch (error) {
      console.error('Error enhancing context with embeddings:', error);
      // Return original context if embeddings fail
      return context;
    }
  }

  private createSearchQuery(userStory: WorkItem): string {
    const parts = [
      userStory.title,
      userStory.description,
      userStory.acceptanceCriteria,
      ...userStory.tags
    ].filter(Boolean);
    
    return parts.join(' ');
  }

  private async findSimilarWorkItems(query: string, excludeAzureId: string): Promise<WorkItem[]> {
    try {
      const similarItems = await this.embeddingService.findSimilarWorkItems(query, 0.8, 5);
      
      // Filter out the current work item (using Azure ID) and convert to WorkItem format
      return similarItems
        .filter((item: any) => item.id !== excludeAzureId) // item.id is azure_id from the search results
        .map((item: any) => this.convertToWorkItem(item))
        .slice(0, 3); // Limit to top 3 similar items
    } catch (error) {
      console.error('Error finding similar work items:', error);
      return [];
    }
  }

  private async findSimilarTestCases(query: string): Promise<TestCase[]> {
    try {
      const similarCases = await this.embeddingService.findSimilarTestCases(query, 0.8, 5);
      
      // Convert to TestCase format
      return similarCases
        .map((item: any) => this.convertToTestCase(item))
        .slice(0, 3); // Limit to top 3 similar test cases
    } catch (error) {
      console.error('Error finding similar test cases:', error);
      return [];
    }
  }

  private convertToWorkItem(item: any): WorkItem {
    return {
      id: item.id,
      title: item.title,
      description: item.description || '',
      workItemType: item.type,
      state: 'Active', // Default state
      tags: [],
      createdDate: null,
      changedDate: null,
      parentId: undefined,
      children: [],
      relatedItems: [],
      isUserStory: item.type === 'User Story',
      isTask: item.type === 'Task',
      hasChildren: false,
      hasParent: false,
    };
  }

  private convertToTestCase(item: any): TestCase {
    // Ensure type is one of the allowed values, default to 'integration' for unsupported types
    const allowedTypes = ['unit', 'integration'] as const;
    const itemType = allowedTypes.includes(item.type) ? item.type : 'integration';
    
    return {
      id: item.id,
      title: item.title,
      description: item.description || '',
      type: itemType as 'unit' | 'integration',
      priority: item.priority as 'low' | 'medium' | 'high',
      status: 'active' as const,
      steps: [],
      expectedResult: 'Test should pass',
      projectId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async getAIResponse(prompt: string): Promise<OpenAITestGenerationResponse> {
    const completionParams = this.buildCompletionParams(prompt);
    
    let completion;
    try {
      completion = await this.openai.chat.completions.create(completionParams);
    } catch (formatError: any) {
      // Retry without response_format if it fails
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

    return this.parseAIResponse(response);
  }

  private buildCompletionParams(prompt: string): any {
    const supportsJsonFormat = this.checkJsonFormatSupport();
    
    const params: any = {
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

    if (supportsJsonFormat) {
      params.response_format = { type: 'json_object' };
      console.log('Using structured JSON response format');
    } else {
      console.log('Using text response format with JSON parsing');
    }

    return params;
  }

  private checkJsonFormatSupport(): boolean {
    const supportedModels = [
      'gpt-4', 
      'gpt-4-turbo', 
      'gpt-4-turbo-preview',
      'gpt-4-1106-preview',
      'gpt-3.5-turbo-1106', 
      'gpt-3.5-turbo-0125'
    ];
    
    return supportedModels.includes(this.model);
  }

  private parseAIResponse(response: string): OpenAITestGenerationResponse {
    try {
      return JSON.parse(response);
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          return this.createFallbackResponse(response);
        }
      } else {
        return this.createFallbackResponse(response);
      }
    }
  }

  private createFallbackResponse(response: string): OpenAITestGenerationResponse {
    const testCase = {
      title: 'Generated Test Case',
      description: 'Test case generated from AI response',
      type: 'integration' as const,
      priority: 'medium' as const,
      steps: [
        {
          step: 1,
          action: 'Execute test scenario',
          expectedOutcome: 'Test should pass',
          testData: {}
        }
      ],
      expectedResult: 'Test should validate the requirements',
      preconditions: 'System should be ready',
      testData: {},
      estimatedDuration: 15,
      generatedCode: '// Generated test code placeholder'
    };

    return {
      testCases: [testCase],
      suggestions: [
        'The AI response could not be parsed as JSON. Please try again.',
        'Consider using a more recent model that supports structured output.'
      ],
      confidence: 0.5
    };
  }

  private getSystemPrompt(): string {
    return `You are an expert QA engineer and test automation specialist. Your task is to generate comprehensive test cases based on user stories and project context.

Guidelines:
1. Generate test cases that cover both positive and negative scenarios
2. Include edge cases and boundary conditions
3. Consider user experience and accessibility
4. Provide clear, actionable test steps
5. Include appropriate test data and expected results
6. Consider the specified test type (unit, integration)
7. **STRICTLY follow the coverage level requirements (basic vs comprehensive)**
8. **LEVERAGE similar work items and existing test cases to avoid duplication**

**TEST TYPE FOCUS:**

**UNIT TESTS:**
- Focus ONLY on the specific work item functionality
- Test individual components, functions, or methods in isolation
- Mock external dependencies and integrations
- Validate component behavior with various inputs
- Test error handling within the component
- Avoid testing interactions with other components

**INTEGRATION TESTS:**
- Focus on component interactions and data flow
- Test API contracts and data transformations
- Include database transaction testing where applicable
- Test error handling across component boundaries
- Consider asynchronous operations and event-driven scenarios
- **Use provided similar work items to understand system interactions**
- Test integration points between current and related components

**COVERAGE LEVEL REQUIREMENTS:**

**BASIC COVERAGE:**
- Generate 2-4 essential test cases covering main functionality
- Focus on happy path scenarios and critical user journeys
- Include primary success scenarios from acceptance criteria
- One basic error handling test case
- Limit complexity and focus on core functionality

**COMPREHENSIVE COVERAGE:**
- Generate 6-12 detailed test cases covering all aspects
- Include multiple positive and negative scenarios
- Cover all acceptance criteria thoroughly
- Include edge cases, boundary conditions, and error scenarios
- Test data validation, security aspects, and performance considerations
- Include accessibility and usability testing where relevant
- Cover all user roles and permission levels if applicable

**CONTEXT UTILIZATION:**
- Use provided similar work items to understand related functionality (integration tests only)
- Reference existing test cases to avoid duplication and build upon coverage
- Identify integration points between the current story and related work items
- Consider how changes might affect related components

IMPORTANT: You MUST respond with a valid JSON object only. Do not include any text before or after the JSON.

Response format: Return ONLY a valid JSON object with this structure:
{
  "testCases": [
    {
      "title": "string",
      "description": "string", 
      "type": "unit|integration",
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

    const sections = [
      this.buildProjectSection(project),
      this.buildUserStorySection(userStory, customRequirements),
      this.buildRelatedTasksSection(relatedTasks),
      this.buildTestRequirementsSection(testType, coverageLevel),
      this.buildExistingTestCasesSection(existingTestCases),
      this.buildInstructionsSection(testType, coverageLevel)
    ];

    return sections.join('\n\n');
  }

  private buildProjectSection(project: { name: string; domain?: string; businessRules?: string[] }): string {
    return `**Project Context:**
- Name: ${project.name}
- Domain: ${project.domain || 'Not specified'}
- Business Rules: ${project.businessRules?.join(', ') || 'None specified'}`;
  }

  private buildUserStorySection(workItem: WorkItem, customRequirements?: string): string {
    let section = `**USER STORY TO TEST:**
Title: ${workItem.title}
Type: ${workItem.workItemType}
State: ${workItem.state}

**Description:**
${workItem.description || 'No description provided'}`;

    if (workItem.acceptanceCriteria) {
      section += `

**Acceptance Criteria:**
${workItem.acceptanceCriteria}`;
    }

    if (customRequirements) {
      section += `

**Custom Test Requirements:**
${customRequirements}`;
    }

    return section;
  }

  private buildRelatedTasksSection(relatedTasks: WorkItem[]): string {
    if (relatedTasks.length === 0) {
      return '**Related Tasks & Similar Items:**\nNo related tasks found';
    }

    const taskList = relatedTasks
      .map(task => `- ${task.title} (${task.state}) - ${task.workItemType}`)
      .join('\n');
    
    return `**Related Tasks & Similar Items:**\n${taskList}`;
  }

  private buildTestRequirementsSection(testType: string, coverageLevel: string): string {
    return `**TEST CONFIGURATION:**
- Test Type: ${testType}
- Coverage Level: ${coverageLevel}`;
  }

  private buildExistingTestCasesSection(existingTestCases: TestCase[]): string {
    if (existingTestCases.length === 0) {
      return '**Existing Test Cases:**\nNo existing test cases found';
    }

    return `**Existing Test Cases:**
${existingTestCases.length} existing test cases found. Avoid duplication and build upon existing coverage.
Similar test cases:
${existingTestCases.slice(0, 3).map(tc => `- ${tc.title} (${tc.type})`).join('\n')}`;
  }

  private buildInstructionsSection(testType: string, coverageLevel: string): string {
    const testTypeGuidance = testType === 'unit' 
      ? `**UNIT TEST FOCUS:**
- Test ONLY the specific work item functionality in isolation
- Mock all external dependencies and integrations
- Focus on component behavior, input validation, and error handling
- Avoid testing interactions with other system components`
      : `**INTEGRATION TEST FOCUS:**
- Test component interactions and data flow between systems
- Include API contracts, database operations, and external service calls
- Leverage similar work items to understand system integration points
- Test error propagation across component boundaries`;

    const coverageGuidance = coverageLevel === 'basic'
      ? `**BASIC COVERAGE REQUIREMENTS:**
- Generate 2-4 essential test cases only
- Focus on happy path and primary success scenarios
- Include one basic error handling case
- Cover main acceptance criteria without edge cases`
      : coverageLevel === 'comprehensive'
      ? `**COMPREHENSIVE COVERAGE REQUIREMENTS:**
- Generate 6-12 detailed test cases
- Cover ALL acceptance criteria thoroughly
- Include multiple positive and negative scenarios
- Test edge cases, boundary conditions, and error scenarios
- Include data validation, security, and performance considerations`
      : `**CUSTOM COVERAGE:**
- Follow the specific custom requirements provided
- Balance thoroughness with the requested scope`;

    return `${testTypeGuidance}

${coverageGuidance}

**GENERAL REQUIREMENTS:**
1. Cover the acceptance criteria thoroughly based on coverage level
2. Include realistic test data and expected outcomes
3. Provide estimated duration in minutes
4. Include generated code examples where applicable
5. ${testType === 'integration' ? 'Build upon related work items and avoid duplicating existing test cases' : 'Focus solely on the current work item without external dependencies'}
6. Ensure each test case is clear, actionable, and valuable

Focus on quality over quantity. Each test case should directly validate the requirements and be executable by the testing team.`;
  }

  private transformToTestGenerationResult(
    response: OpenAITestGenerationResponse, 
    context: TestGenerationContext
  ): TestGenerationResult {
    const testCases = response.testCases.map(testCase => {
      // Ensure type is one of the allowed values, default to 'integration' for unsupported types
      const allowedTypes = ['unit', 'integration'] as const;
      const testCaseType = allowedTypes.includes(testCase.type as any) ? testCase.type as 'unit' | 'integration' : 'integration';
      
      return {
        title: testCase.title,
        description: testCase.description,
        type: testCaseType,
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
      };
    });

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

  // Method to generate test code specifically
  async generateTestCode(
    testCase: Partial<TestCase>, 
    framework: string = 'jest',
    language: string = 'typescript'
  ): Promise<string> {
    try {
      const prompt = this.buildTestCodePrompt(testCase, framework, language);

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

  private buildTestCodePrompt(testCase: Partial<TestCase>, framework: string, language: string): string {
    return `Generate ${framework} test code in ${language} for the following test case:

**Test Case:**
- Title: ${testCase.title}
- Description: ${testCase.description}
- Type: ${testCase.type}
- Steps: ${testCase.steps?.map(step => `${step.step}. ${step.action} - Expected: ${step.expectedOutcome}`).join('\n')}
- Expected Result: ${testCase.expectedResult}

Please generate clean, well-commented, and executable test code that follows best practices for ${framework} and ${language}.`;
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