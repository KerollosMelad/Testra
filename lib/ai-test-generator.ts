import { createOpenAIClient, OpenAITestGenerationResponse } from './openai';
import { WorkItem, TestCase, TestGenerationContext, TestGenerationResult } from './types';
import { createEmbeddingService } from './embedding-service';
import OpenAI from 'openai';

// Enhanced interfaces for chunked generation
interface AcceptanceCriteriaChunk {
  id: string;
  criteria: string[];
  originalCriteria: string[]; // Keep original text before summarization
  relatedTo?: string[]; // IDs of other chunks this relates to
  priority: 'high' | 'medium' | 'low';
  dependsOn?: string[]; // IDs of chunks that must be generated first
  estimatedTokens: number;
}

interface ChunkedGenerationContext extends TestGenerationContext {
  currentChunk?: AcceptanceCriteriaChunk;
  previouslyGeneratedTests?: TestCase[];
  previousTestsSummary?: string;
  totalChunks?: number;
  currentChunkIndex?: number;
  allChunks?: AcceptanceCriteriaChunk[];
}

interface StreamingTestGenerationResult {
  chunk: TestGenerationResult;
  isComplete: boolean;
  progress: number; // 0-100
  chunkId: string;
  currentChunkIndex: number;
  totalChunks: number;
  acceptanceCriteria: string[]; // The criteria this chunk covers
  canPause: boolean;
}

interface TestGenerationOptions {
  enableStreaming?: boolean;
  maxTokensPerChunk?: number;
  enablePause?: boolean;
  chunkSize?: number; // 2-3 by default
}

// Enhanced TestCase interface
interface EnhancedTestCase extends TestCase {
  coveredCriteria?: string[]; // Which acceptance criteria this test covers
  chunkId?: string; // Which chunk generated this test
  dependsOnTests?: string[]; // Test IDs this test depends on
}

export class AITestGenerator {
  private temperature: number;
  private maxTokens: number;
  private openai: OpenAI;
  private embeddingService: any;

  constructor(
    apiKey: string,
    temperature: number = 0.7, 
    maxTokens: number = 2000
  ) {
    this.openai = createOpenAIClient(apiKey);
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
      const response = await this.getAIResponse(prompt, context.testType);
      
      // Transform and return result
      return this.transformToTestGenerationResult(response, enhancedContext);
    } catch (error) {
      console.error('Error generating test cases:', error);
      throw new Error(`Failed to generate test cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async enhanceContextWithSimilarItems(context: TestGenerationContext): Promise<TestGenerationContext> {
    try {
          // Only enhance context for integration tests - story tests should focus on the specific work item only
    if (context.testType !== 'integration') {
      return {
        ...context,
        relatedTasks: [], // Clear related tasks for story tests
      };
    }
      
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
    const itemType = allowedTypes.includes(item.type) ? item.type as 'unit' | 'integration' : 'integration';
    
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

  private async getAIResponse(prompt: string, testType: string = 'integration'): Promise<OpenAITestGenerationResponse> {
    const completionParams = this.buildCompletionParams(prompt, testType);

    const completion = await this.openai.chat.completions.create(completionParams);

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return this.parseAIResponse(response);
  }

  private buildCompletionParams(prompt: string, testType: string = 'integration'): any {
    const params: any = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(testType)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' }
    };

    return params;
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

  private getSystemPrompt(testType: string = 'integration'): string {
    if (testType === 'unit') {
      return this.getStoryTestSystemPrompt();
    } else {
      return this.getIntegrationTestSystemPrompt();
    }
  }

  private getStoryTestSystemPrompt(): string {
    return `You are an expert test case designer specializing in creating detailed test scenarios.

**IMPORTANT: You generate TEST SCENARIOS, not test code.**

Your task is to create story test scenarios that thoroughly validate individual user story functionality.

## What "Story Testing" Means:
- Test scenarios that focus on ONE user story in isolation
- Validate all acceptance criteria for that specific user story  
- Mock or stub external dependencies and related user stories
- Focus on the user story's internal logic and behavior
- Ensure the user story works correctly by itself

## Expected Output Format:
For each test scenario, provide:

**Test Scenario Title:** [Clear, descriptive title]
**Description:** [What this scenario validates]
**Preconditions:** [Setup requirements, mocked dependencies]
**Test Steps:** [Numbered steps to execute]
**Expected Results:** [What should happen at each step]

## Requirements:
- Generate TEST SCENARIOS, not code
- Each scenario should map directly to acceptance criteria
- Include realistic test data and user interactions
- Specify what external dependencies need to be mocked
- Focus on user story behavior in isolation
- Provide clear, executable test steps
- Validate user story functionality thoroughly

**DO NOT generate story test code - generate test scenarios that can be executed manually or automated later.**

## JSON Response Format:
Return your response as a valid JSON object with this exact structure:

{
  "testCases": [
    {
      "title": "Clear, descriptive test scenario name",
      "description": "What this scenario validates",
      "type": "unit",
      "priority": "low" | "medium" | "high",
      "steps": [
        {
          "step": 1,
          "action": "Action to perform",
          "expectedOutcome": "Expected result",
          "testData": {}
        }
      ],
      "expectedResult": "Overall expected outcome",
      "preconditions": "Setup requirements and mocked dependencies",
      "testData": {},
      "estimatedDuration": 10
    }
  ],
  "suggestions": ["Additional recommendations"],
  "confidence": 0.9
}

**IMPORTANT: Respond with ONLY the JSON object. No additional text.**`;
  }

  private getIntegrationTestSystemPrompt(): string {
    return `You are an expert test case designer specializing in creating detailed integration test scenarios.

**IMPORTANT: You generate TEST SCENARIOS, not test code.**

Your task is to create integration test scenarios that validate interactions between user stories and system components.

## What "Integration Testing" Means:
- Test scenarios that validate interactions between multiple user stories
- Test data flow and communication between system components
- Validate end-to-end workflows that span multiple user stories
- Test real system integrations (APIs, databases, external services)
- Ensure user stories work together correctly

## Expected Output Format:
For each test scenario, provide:

**Test Scenario Title:** [Clear, descriptive title]
**Description:** [What integration this scenario validates]
**Preconditions:** [Setup requirements, data dependencies]
**Test Steps:** [Numbered steps to execute]
**Expected Results:** [What should happen at each step]

## Requirements:
- Generate TEST SCENARIOS, not code
- Focus on interactions between user stories and components
- Include realistic end-to-end workflows
- Test actual system integrations where possible
- Validate data consistency across components
- Provide clear, executable test steps
- Test complete user journeys and workflows

**DO NOT generate integration test code - generate test scenarios that validate system integrations and user story interactions.**

## JSON Response Format:
Return your response as a valid JSON object with this exact structure:

{
  "testCases": [
    {
      "title": "Clear, descriptive test scenario name",
      "description": "What integration this scenario validates",
      "type": "integration",
      "priority": "low" | "medium" | "high",
      "steps": [
        {
          "step": 1,
          "action": "Action to perform",
          "expectedOutcome": "Expected result",
          "testData": {}
        }
      ],
      "expectedResult": "Overall expected outcome",
      "preconditions": "Setup requirements and data dependencies",
      "testData": {},
      "estimatedDuration": 15
    }
  ],
  "suggestions": ["Additional recommendations"],
  "confidence": 0.9
}

**IMPORTANT: Respond with ONLY the JSON object. No additional text.**`;
  }

  private buildPrompt(context: TestGenerationContext): string {
    const { project, userStory, relatedTasks, existingTestCases, testType, coverageLevel, customRequirements } = context;

    const sections = [
      this.buildProjectSection(project),
      this.buildUserStorySection(userStory, customRequirements),
      this.buildRelatedTasksSection(relatedTasks),
      this.buildTestRequirementsSection(testType, coverageLevel),
      this.buildExistingTestCasesSection(existingTestCases),
      this.buildInstructionsSection(testType, coverageLevel, customRequirements)
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

  private buildInstructionsSection(testType: string, coverageLevel: string, customRequirements?: string): string {
    if (testType === 'unit') {
      return this.buildStoryTestInstructions(coverageLevel, customRequirements);
    } else {
      return this.buildIntegrationTestInstructions(coverageLevel, customRequirements);
    }
  }

  private buildStoryTestInstructions(coverageLevel: string, customRequirements?: string): string {
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
      : coverageLevel === 'custom' && customRequirements
      ? `**CUSTOM COVERAGE REQUIREMENTS:**
- Generate test cases ONLY for the following custom requirements
- Ignore standard acceptance criteria - focus exclusively on custom requirements
- Custom requirements to test:
${customRequirements}
- Generate appropriate number of test cases to thoroughly cover these specific requirements`
      : `**CUSTOM COVERAGE:**
- Follow the specific custom requirements provided
- Balance thoroughness with the requested scope`;

    const testScenarioGuidance = coverageLevel === 'custom' && customRequirements
      ? `**TEST SCENARIO REQUIREMENTS:**
1. Focus EXCLUSIVELY on the custom requirements specified above
2. Generate test scenarios that validate only these custom requirements
3. Include realistic test data and expected outcomes for isolated validation
4. Provide estimated duration in minutes (typically 5-15 minutes per scenario)
5. Generate test scenarios (executable steps), NOT test code
6. Ensure each scenario validates one specific custom requirement
7. Ignore acceptance criteria - test only the custom requirements`
      : `**TEST SCENARIO REQUIREMENTS:**
1. Cover the acceptance criteria thoroughly based on coverage level
2. Include realistic test data and expected outcomes for isolated user story validation
3. Provide estimated duration in minutes (typically 5-15 minutes per scenario)
4. Generate test scenarios (executable steps), NOT test code
5. Focus solely on the current user story without external dependencies
6. Ensure each scenario validates one specific behavior or criterion`;

    return `**STORY TESTING:**
- Test ONLY the specific user story functionality in complete isolation
- Mock or stub ALL external dependencies (APIs, databases, other user stories)
- Focus on user story behavior, input validation, and error handling
- Test business logic and state management within the user story

${coverageGuidance}

${testScenarioGuidance}

**IMPORTANT:** Generate test scenarios (manual or automatable steps), NOT test code. Focus on quality over quantity. Each scenario should validate specific user story behavior in isolation and be executable by the testing team.`;
  }

  private buildIntegrationTestInstructions(coverageLevel: string, customRequirements?: string): string {
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
      : coverageLevel === 'custom' && customRequirements
      ? `**CUSTOM COVERAGE REQUIREMENTS:**
- Generate test cases ONLY for the following custom requirements
- Ignore standard acceptance criteria - focus exclusively on custom requirements
- Custom requirements to test:
${customRequirements}
- Generate appropriate number of test cases to thoroughly cover these specific requirements`
      : `**CUSTOM COVERAGE:**
- Follow the specific custom requirements provided
- Balance thoroughness with the requested scope`;

    const testScenarioGuidance = coverageLevel === 'custom' && customRequirements
      ? `**TEST SCENARIO REQUIREMENTS:**
1. Focus EXCLUSIVELY on the custom requirements specified above
2. Generate test scenarios that validate only these custom requirements
3. Include realistic test data and expected outcomes for integration validation
4. Provide estimated duration in minutes
5. Generate test scenarios (executable steps), NOT test code
6. Ensure each scenario validates one specific custom requirement through integration
7. Ignore acceptance criteria - test only the custom requirements`
      : `**TEST SCENARIO REQUIREMENTS:**
1. Cover the acceptance criteria thoroughly based on coverage level
2. Include realistic test data and expected outcomes
3. Provide estimated duration in minutes
4. Generate test scenarios (executable steps), NOT test code
5. Build upon related work items and avoid duplicating existing test cases
6. Ensure each scenario is clear, actionable, and valuable`;

    return `**INTEGRATION TESTING:**
- Test interactions between user stories and system components
- Include API contracts, database operations, and external service calls
- Leverage similar work items to understand system integration points
- Test error propagation across component boundaries

${coverageGuidance}

${testScenarioGuidance}

**IMPORTANT:** Generate test scenarios (manual or automatable steps), NOT test code. Focus on quality over quantity. Each scenario should directly validate the requirements and be executable by the testing team.`;
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
        model: 'gpt-4o',
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

  // New streaming generation method
  async *generateTestCasesStreaming(
    context: TestGenerationContext, 
    options: TestGenerationOptions = {}
  ): AsyncGenerator<StreamingTestGenerationResult, void, unknown> {
    const {
      enableStreaming = true,
      maxTokensPerChunk = 1500,
      chunkSize = 3,
      enablePause = true
    } = options;

    try {
      let chunks: AcceptanceCriteriaChunk[] = [];

      // Handle custom requirements differently - don't chunk, use as single item
      if (context.coverageLevel === 'custom' && context.customRequirements) {
        chunks = [{
          id: 'custom-requirements',
          criteria: [context.customRequirements],
          originalCriteria: [context.customRequirements],
          priority: 'high' as const,
          estimatedTokens: this.estimateTokens(context.customRequirements)
        }];
      } else {
        // Parse and chunk acceptance criteria for standard coverage
        chunks = await this.analyzeAndChunkAcceptanceCriteria(
          context.userStory.acceptanceCriteria || '',
          chunkSize,
          maxTokensPerChunk
        );
      }

      let previousTests: TestCase[] = [];
      let previousSummary = '';

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Create chunked context
        const chunkedContext: ChunkedGenerationContext = {
          ...context,
          currentChunk: chunk,
          previouslyGeneratedTests: previousTests,
          previousTestsSummary: previousSummary,
          totalChunks: chunks.length,
          currentChunkIndex: i,
          allChunks: chunks
        };

        try {
          // Generate tests for this chunk
          const result = await this.generateTestCasesForChunk(chunkedContext);
          
          // Add covered criteria to test cases
          const enhancedTestCases = result.testCases.map(tc => ({
            ...tc,
            coveredCriteria: chunk.originalCriteria,
            chunkId: chunk.id
          })) as (TestCase & { coveredCriteria: string[]; chunkId: string })[];

          // Update previous tests and summary
          previousTests = [...previousTests, ...enhancedTestCases];
          previousSummary = this.createDetailedTestSummary(previousTests);

          yield {
            chunk: {
              ...result,
              testCases: enhancedTestCases
            },
            isComplete: i === chunks.length - 1,
            progress: Math.round(((i + 1) / chunks.length) * 100),
            chunkId: chunk.id,
            currentChunkIndex: i,
            totalChunks: chunks.length,
            acceptanceCriteria: chunk.originalCriteria,
            canPause: enablePause
          };

        } catch (error) {
          console.error(`Error generating tests for chunk ${chunk.id}:`, error);
          
          // Continue with next chunk instead of failing completely
          yield {
            chunk: {
              testCases: [],
              relationships: [],
              suggestions: [`Failed to generate tests for criteria: ${chunk.originalCriteria.join(', ')}`],
              confidence: 0
            },
            isComplete: i === chunks.length - 1,
            progress: Math.round(((i + 1) / chunks.length) * 100),
            chunkId: chunk.id,
            currentChunkIndex: i,
            totalChunks: chunks.length,
            acceptanceCriteria: chunk.originalCriteria,
            canPause: enablePause
          };
        }
      }

    } catch (error) {
      console.error('Error in streaming generation:', error);
      throw new Error(`Failed to generate test cases in streaming mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced acceptance criteria analysis and chunking
  private analyzeAndChunkAcceptanceCriteria(
    acceptanceCriteria: string,
    maxChunkSize: number = 3,
    maxTokensPerChunk: number = 1500
  ): Promise<AcceptanceCriteriaChunk[]> {
    
    // Parse acceptance criteria into individual items
    const criteriaItems = this.parseAcceptanceCriteria(acceptanceCriteria);
    
    if (criteriaItems.length === 0) {
      // Fallback: treat the entire acceptanceCriteria as a single chunk
      const cleanedCriteria = this.extractPlainTextFromHTML(acceptanceCriteria);
      
      return Promise.resolve([{
        id: 'chunk-1',
        criteria: [cleanedCriteria],
        originalCriteria: [cleanedCriteria],
        priority: 'high',
        estimatedTokens: this.estimateTokens(cleanedCriteria)
      }]);
    }

    // Clean HTML from criteria items
    const cleanedItems = criteriaItems.map(item => this.extractPlainTextFromHTML(item));

    // Detect dependencies between criteria
    const dependencies = this.detectCriteriaDependencies(cleanedItems);
    
    // Create chunks based on dependencies and size limits
    const chunks = this.createOptimalChunks(cleanedItems, dependencies, maxChunkSize, maxTokensPerChunk);
    
    return Promise.resolve(chunks);
  }

  private parseAcceptanceCriteria(acceptanceCriteria: string): string[] {
    if (!acceptanceCriteria) {
      return [];
    }
    
    // First clean HTML from the input
    const cleanedInput = this.extractPlainTextFromHTML(acceptanceCriteria);
    
    // Try to extract from structured patterns
    let criteria = this.parseTextCriteria(cleanedInput);
    
    // If no criteria found, try extracting from description that contains "Acceptance Criteria:"
    if (criteria.length === 0) {
      criteria = this.extractCriteriaFromDescription(cleanedInput);
    }
    
    return criteria;
  }
  
  private extractCriteriaFromDescription(text: string): string[] {
    // Handle case where acceptance criteria are embedded in description
    const criteriaMatch = text.match(/(?:✅\s*)?(?:acceptance\s+criteria|criteria)[:\s]+(.*?)(?:\n\n|$)/i);
    
    if (criteriaMatch && criteriaMatch[1]) {
      const criteriaText = criteriaMatch[1].trim();
      
      // Try to split by periods followed by capital letters (sentence boundaries)
      const sentences = criteriaText
        .split(/\.\s+(?=[A-Z]|Patient|Booking|Doctor|Time)/)
        .map(s => s.trim())
        .filter(s => s.length > 10)
        .map(s => s.endsWith('.') ? s : s + '.');
      
      if (sentences.length > 1) {
        return sentences;
      }
      
      // Fallback: split by common patterns in the text
      return this.parseTextCriteria(criteriaText);
    }
    
    return [];
  }

  private parseTextCriteria(text: string): string[] {
    // Enhanced patterns with better matching
    const patterns = [
      // Numbered lists with various formats
      /(?:^|\n)\s*\d+[\.\)]\s+(.+?)(?=\n\s*\d+[\.\)]|\n\s*[A-Z]|$)/g,
      // Bullet points  
      /(?:^|\n)\s*[-•*]\s+(.+?)(?=\n\s*[-•*]|\n\s*[A-Z]|$)/g,
      // BDD format
      /(?:^|\n)\s*(?:Given|When|Then|And|But)\s+(.+?)(?=\n\s*(?:Given|When|Then|And|But)|\n\s*[A-Z]|$)/gi,
      // Requirements format
      /(?:^|\n)\s*(?:Patient|Booking|Doctor|Time|User)\s+(.+?)(?=\n\s*(?:Patient|Booking|Doctor|Time|User)|\n\s*[A-Z]|$)/gi,
    ];

    let items: string[] = [];
    
    // Try each pattern to find the best match
    for (const pattern of patterns) {
      const matches = Array.from(text.matchAll(pattern));
      if (matches.length > 0) {
        items = matches
          .map(match => match[1]?.trim() || match[0]?.trim())
          .filter(item => item && item.length > 10);
        
        if (items.length > 1) {
          break;
        }
      }
    }
    
    // If patterns didn't work, try sentence splitting
    if (items.length <= 1) {
      const sentences = text
        .split(/\.\s+(?=[A-Z]|Patient|Booking|Doctor|Time|User)/)
        .map(s => s.trim())
        .filter(s => s.length > 15)
        .map(s => s.endsWith('.') ? s : s + '.');
      
      if (sentences.length > 1) {
        items = sentences;
      }
    }
    
    // Last resort: split by key requirement words
    if (items.length <= 1) {
      const requirements = text
        .split(/(?=\b(?:Patient|Booking|Doctor|Time|User)\s+(?:can|must|should|will))/i)
        .map(s => s.trim())
        .filter(s => s.length > 10);
      
      if (requirements.length > 1) {
        items = requirements;
      }
    }

    return items
      .map(item => this.cleanCriteriaText(item.trim()))
      .filter(item => item.length > 5)
      .slice(0, 15); // Reasonable limit
  }

  private detectCriteriaDependencies(criteria: string[]): Map<number, number[]> {
    const dependencies = new Map<number, number[]>();

    for (let i = 0; i < criteria.length; i++) {
      const deps: number[] = [];
      
      for (let j = 0; j < criteria.length; j++) {
        if (i === j) continue;
        
        if (this.haveDependency(criteria[i], criteria[j])) {
          deps.push(j);
        }
      }
      
      if (deps.length > 0) {
        dependencies.set(i, deps);
      }
    }

    return dependencies;
  }

  private haveDependency(criteriaA: string, criteriaB: string): boolean {
    const aLower = criteriaA.toLowerCase();
    const bLower = criteriaB.toLowerCase();

    // Sequential dependency keywords
    const sequentialKeywords = ['after', 'then', 'once', 'following', 'when', 'upon'];
    const hasSequential = sequentialKeywords.some(keyword => 
      aLower.includes(keyword) && aLower.indexOf(keyword) < aLower.length * 0.7
    );

    // State dependencies - one mentions output/result of another
    const stateKeywords = ['login', 'authenticate', 'register', 'submit', 'save', 'create', 'delete'];
    const sharedStates = stateKeywords.filter(keyword => 
      aLower.includes(keyword) && bLower.includes(keyword)
    );

    // Shared entities (extract nouns/key terms)
    const sharedEntities = this.findSharedEntities(aLower, bLower);

    return hasSequential || sharedStates.length > 0 || sharedEntities.length > 2;
  }

  private findSharedEntities(textA: string, textB: string): string[] {
    // Simple entity extraction - look for repeated important words
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'should', 'must', 'can', 'will'];
    
    const wordsA = textA.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
    const wordsB = textB.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
    
    return wordsA.filter(word => wordsB.includes(word));
  }

  private cleanCriteriaText(text: string): string {
    if (!text) return text;
    
    // Remove trailing numbers that are likely from next criteria (e.g., "text. 2." -> "text.")
    let cleaned = text.replace(/\.\s*\d+\.\s*$/, '.');
    
    // Remove standalone trailing numbers (e.g., "text 2." -> "text.")
    cleaned = cleaned.replace(/\s+\d+\.\s*$/, '.');
    
    // Remove trailing periods followed by spaces and numbers
    cleaned = cleaned.replace(/\.\s+\d+\s*$/, '.');
    
    // Ensure it ends with a period if it's a complete sentence
    if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
      cleaned += '.';
    }
    
    return cleaned.trim();
  }

  private createOptimalChunks(
    criteria: string[],
    dependencies: Map<number, number[]>,
    maxChunkSize: number,
    maxTokensPerChunk: number
  ): AcceptanceCriteriaChunk[] {
    const chunks: AcceptanceCriteriaChunk[] = [];
    const processed = new Set<number>();
    
    let chunkId = 1;

    for (let i = 0; i < criteria.length; i++) {
      if (processed.has(i)) continue;

      const chunk: AcceptanceCriteriaChunk = {
        id: `chunk-${chunkId++}`,
        criteria: [],
        originalCriteria: [],
        priority: this.determinePriority(criteria[i]),
        estimatedTokens: 0,
        dependsOn: []
      };

      // Start with current criteria
      chunk.criteria.push(criteria[i]);
      chunk.originalCriteria.push(criteria[i]);
      chunk.estimatedTokens = this.estimateTokens(criteria[i]);
      processed.add(i);

      // Add dependent criteria if they fit
      const dependents = dependencies.get(i) || [];
      for (const depIndex of dependents) {
        if (processed.has(depIndex)) continue;
        if (chunk.criteria.length >= maxChunkSize) break;

        const additionalTokens = this.estimateTokens(criteria[depIndex]);
        if (chunk.estimatedTokens + additionalTokens > maxTokensPerChunk) break;

        chunk.criteria.push(criteria[depIndex]);
        chunk.originalCriteria.push(criteria[depIndex]);
        chunk.estimatedTokens += additionalTokens;
        processed.add(depIndex);
      }

      // Handle too-long individual criteria
      if (chunk.estimatedTokens > maxTokensPerChunk && chunk.criteria.length === 1) {
        const summarized = this.summarizeLongCriteria(chunk.criteria[0]);
        chunk.criteria = [summarized];
        chunk.estimatedTokens = this.estimateTokens(summarized);
      }

      chunks.push(chunk);
    }

    return chunks;
  }

  private determinePriority(criteria: string): 'high' | 'medium' | 'low' {
    const highPriorityKeywords = ['must', 'required', 'critical', 'essential', 'login', 'security', 'payment'];
    const lowPriorityKeywords = ['nice to have', 'optional', 'future', 'enhancement'];
    
    const lowerCriteria = criteria.toLowerCase();
    
    if (highPriorityKeywords.some(keyword => lowerCriteria.includes(keyword))) {
      return 'high';
    }
    
    if (lowPriorityKeywords.some(keyword => lowerCriteria.includes(keyword))) {
      return 'low';
    }
    
    return 'medium';
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private summarizeLongCriteria(criteria: string): string {
    // Simple summarization - take first sentence and key points
    const sentences = criteria.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 1) return criteria;
    
    const firstSentence = sentences[0].trim();
    const keyWords = criteria.toLowerCase().match(/\b(?:must|should|will|can|required|when|if|then)\b/g) || [];
    
    return `${firstSentence}. [Key requirements: ${keyWords.slice(0, 3).join(', ')}]`;
  }

  private createDetailedTestSummary(tests: TestCase[]): string {
    if (tests.length === 0) return 'No tests generated yet.';
    
    const summary = tests.map(test => 
      `• ${test.title} (${test.type}, ${test.priority} priority) - ${test.description}`
    ).join('\n');
    
    return `Previously generated tests (${tests.length} total):\n${summary}`;
  }

  // Enhanced method for chunk-specific generation
  private async generateTestCasesForChunk(context: ChunkedGenerationContext): Promise<TestGenerationResult> {
    try {
      // Enhance context with similar items (only for integration tests)
      const enhancedContext = await this.enhanceContextWithSimilarItems(context);
      
      // Build chunk-specific prompt
      const prompt = this.buildChunkedPrompt(enhancedContext);
      
      // Get AI response
      const response = await this.getAIResponse(prompt, context.testType);
      
      // Transform and return result
      return this.transformToTestGenerationResult(response, enhancedContext);
    } catch (error) {
      console.error('Error generating test cases for chunk:', error);
      throw new Error(`Failed to generate test cases for chunk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildChunkedPrompt(context: ChunkedGenerationContext): string {
    const { project, userStory, testType, coverageLevel, currentChunk, customRequirements } = context;

    // Build clean, focused prompt
    const sections = [
      `# TEST GENERATION REQUEST`,
      ``,
      `## Project: ${project.name}`,
      `Domain: ${project.domain || 'Not specified'}`,
      ``,
      `## User Story: ${userStory.title}`,
      `**Type:** ${userStory.workItemType} | **State:** ${userStory.state}`,
      ``,
      this.buildCleanUserStoryDescription(userStory),
      ``,
      this.buildAcceptanceCriteriaSection(currentChunk, coverageLevel, customRequirements),
      ``,
      `## Test Requirements`,
      `- **Test Type:** ${testType}`,
      `- **Coverage Level:** ${coverageLevel}`,
      ``,
      this.buildTestingInstructions(testType, coverageLevel, currentChunk, customRequirements),
    ];

    return sections.filter(section => section !== null).join('\n');
  }

  private buildCleanUserStoryDescription(userStory: WorkItem): string {
    if (!userStory.description) return '**Description:** No description provided';
    
    // Clean up the description by removing acceptance criteria if embedded
    let cleanDescription = userStory.description
      .replace(/(?:✅\s*)?(?:acceptance\s+criteria|criteria)[:\s]+.*$/i, '')
      .trim();
    
    if (!cleanDescription) {
      cleanDescription = 'No additional description provided';
    }

    return `**Description:**\n${cleanDescription}`;
  }

  private buildAcceptanceCriteriaSection(chunk?: AcceptanceCriteriaChunk, coverageLevel?: string, customRequirements?: string): string {
    if (coverageLevel === 'custom' && customRequirements) {
      return `## Custom Requirements (Focus Area)
${customRequirements}`;
    }
    
    if (!chunk || !chunk.originalCriteria || chunk.originalCriteria.length === 0) {
      return '## Acceptance Criteria\nNo specific acceptance criteria provided for this test generation.';
    }
    
    const criteriaList = chunk.originalCriteria
      .map((criteria, index) => `${index + 1}. ${criteria}`)
      .join('\n');
    
    return `## Acceptance Criteria (Focus Area)\n${criteriaList}`;
  }

  private buildTestingInstructions(testType: string, coverageLevel: string, chunk?: AcceptanceCriteriaChunk, customRequirements?: string): string {
    const criteriaCount = chunk?.originalCriteria?.length || 0;
    
    if (testType === 'unit') {
      return this.buildStoryTestInstructionsForChunk(coverageLevel, criteriaCount, customRequirements);
    } else {
      return this.buildIntegrationTestInstructionsForChunk(coverageLevel, criteriaCount, customRequirements);
    }
  }

  private buildStoryTestInstructionsForChunk(coverageLevel: string, criteriaCount: number, customRequirements?: string): string {
    if (coverageLevel === 'custom' && customRequirements) {
      return `## Testing Instructions
**STORY TESTING:** Create test scenarios that validate the custom requirements in isolation.
**CUSTOM COVERAGE:** Generate test cases ONLY for the custom requirements specified above.

**Expected Output:** Test scenarios that directly validate the custom requirements above.

**Test Scenario Requirements:**
- Each scenario must map to specific custom requirements
- Focus EXCLUSIVELY on the custom requirements specified
- Mock or stub external dependencies (APIs, databases, other user stories)
- Include realistic test data for component validation
- Provide clear, executable test steps with setup requirements
- Focus only on the custom requirements - ignore standard acceptance criteria
- Validate custom requirement behavior independently

**IMPORTANT:** Generate test scenarios (manual or automatable steps), NOT test code. Each scenario should be executable by a tester or QA engineer.

**JSON Response Format:** Return your response as a valid JSON object with the structure:
{
  "testCases": [
    {
      "title": "Test scenario name",
      "description": "What custom requirement this validates",
      "type": "unit",
      "priority": "medium",
      "steps": [{"step": 1, "action": "...", "expectedOutcome": "...", "testData": {}}],
      "expectedResult": "Overall outcome",
      "preconditions": "Setup requirements",
      "testData": {},
      "estimatedDuration": 10
    }
  ],
  "suggestions": [],
  "confidence": 0.9
}

**Respond with ONLY the JSON object.**`;
    }

    const expectedTests = coverageLevel === 'comprehensive' 
      ? Math.min(12, criteriaCount * 3)
      : Math.min(4, criteriaCount + 1);

    const coverageGuidance = coverageLevel === 'comprehensive'
      ? `**COMPREHENSIVE COVERAGE:** Generate 6-12 detailed test scenarios covering all criteria.`
      : `**BASIC COVERAGE:** Generate 2-4 essential test scenarios focusing on core functionality.`;

    return `## Testing Instructions
**STORY TESTING:** Create test scenarios that validate this user story in isolation.
${coverageGuidance}

**Expected Output:** Approximately ${expectedTests} test scenarios that directly validate the acceptance criteria above.

**Test Scenario Requirements:**
- Each scenario must map to specific acceptance criteria
- Focus on testing this user story's functionality in isolation
- Mock or stub external dependencies (APIs, databases, other user stories)
- Include realistic test data for component validation
- Provide clear, executable test steps with setup requirements
- Focus only on the criteria listed above
- Validate user story behavior independently

**IMPORTANT:** Generate test scenarios (manual or automatable steps), NOT test code. Each scenario should be executable by a tester or QA engineer.

**JSON Response Format:** Return your response as a valid JSON object with the structure:
{
  "testCases": [
    {
      "title": "Test scenario name",
      "description": "What this validates",
      "type": "unit",
      "priority": "medium",
      "steps": [{"step": 1, "action": "...", "expectedOutcome": "...", "testData": {}}],
      "expectedResult": "Overall outcome",
      "preconditions": "Setup requirements",
      "testData": {},
      "estimatedDuration": 10
    }
  ],
  "suggestions": [],
  "confidence": 0.9
}

**Respond with ONLY the JSON object.**`;
  }

  private buildIntegrationTestInstructionsForChunk(coverageLevel: string, criteriaCount: number, customRequirements?: string): string {
    if (coverageLevel === 'custom' && customRequirements) {
      return `## Testing Instructions
**INTEGRATION TESTING:** Create test scenarios that validate the custom requirements through system integrations.
**CUSTOM COVERAGE:** Generate test cases ONLY for the custom requirements specified above.

**Expected Output:** Integration test scenarios that directly validate the custom requirements above.

**Test Scenario Requirements:**
- Each scenario must map to specific custom requirements
- Focus EXCLUSIVELY on the custom requirements specified
- Include realistic end-to-end workflows and data flow for custom requirements
- Test actual system integrations where appropriate for custom requirements
- Provide clear, executable test steps
- Focus only on the custom requirements - ignore standard acceptance criteria
- Validate complete user journeys and system interactions for custom requirements

**IMPORTANT:** Generate test scenarios (manual or automatable steps), NOT test code. Each scenario should validate how the custom requirements integrate with other system components.

**JSON Response Format:** Return your response as a valid JSON object with the structure:
{
  "testCases": [
    {
      "title": "Test scenario name",
      "description": "What custom requirement integration this validates",
      "type": "integration",
      "priority": "medium",
      "steps": [{"step": 1, "action": "...", "expectedOutcome": "...", "testData": {}}],
      "expectedResult": "Overall outcome",
      "preconditions": "Setup requirements",
      "testData": {},
      "estimatedDuration": 15
    }
  ],
  "suggestions": [],
  "confidence": 0.9
}

**Respond with ONLY the JSON object.**`;
    }

    const expectedTests = coverageLevel === 'comprehensive' 
      ? Math.min(12, criteriaCount * 3)
      : Math.min(4, criteriaCount + 1);

    const coverageGuidance = coverageLevel === 'comprehensive'
      ? `**COMPREHENSIVE COVERAGE:** Generate 6-12 detailed test scenarios covering all criteria.`
      : `**BASIC COVERAGE:** Generate 2-4 essential test scenarios focusing on core functionality.`;

    return `## Testing Instructions
**INTEGRATION TESTING:** Create test scenarios that validate interactions between user stories and system components.
${coverageGuidance}

**Expected Output:** Approximately ${expectedTests} integration test scenarios that directly validate the acceptance criteria above.

**Test Scenario Requirements:**
- Each scenario must map to specific acceptance criteria
- Focus on interactions between multiple user stories or components
- Include realistic end-to-end workflows and data flow
- Test actual system integrations where appropriate
- Provide clear, executable test steps
- Focus only on the criteria listed above
- Validate complete user journeys and system interactions

**IMPORTANT:** Generate test scenarios (manual or automatable steps), NOT test code. Each scenario should validate how this user story integrates with other system components.

**JSON Response Format:** Return your response as a valid JSON object with the structure:
{
  "testCases": [
    {
      "title": "Test scenario name",
      "description": "What integration this validates",
      "type": "integration",
      "priority": "medium",
      "steps": [{"step": 1, "action": "...", "expectedOutcome": "...", "testData": {}}],
      "expectedResult": "Overall outcome",
      "preconditions": "Setup requirements",
      "testData": {},
      "estimatedDuration": 15
    }
  ],
  "suggestions": [],
  "confidence": 0.9
}

**Respond with ONLY the JSON object.**`;
  }

  private extractPlainTextFromHTML(html: string): string {
    if (!html) return '';
    
    // If it's not HTML content, return as-is
    if (!html.includes('<') || !html.includes('>')) {
      return html.trim();
    }
    
    // Remove HTML tags and clean up text
    const plainText = html
      .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove style tags and content
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags and content
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')  // Replace &nbsp; with space
      .replace(/&lt;/g, '<')    // Decode HTML entities
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
    
    return plainText;
  }
}

// Factory function to create AI test generator with project settings
export function createAITestGenerator(
  apiKey: string,
  temperature: number = 0.7,
  maxTokens: number = 2000
): AITestGenerator {
  return new AITestGenerator(apiKey, temperature, maxTokens);
} 