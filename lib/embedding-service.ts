import OpenAI from "openai";
import { createHash } from "crypto";
import { supabaseAdmin } from "./supabase";
import { WorkItem, TestCase } from "./types";

export interface EmbeddingResult {
  embedding: number[];
  contentHash: string;
  modelVersion: string;
}

export interface SimilarityResult {
  id: string;
  title: string;
  description: string;
  type: string;
  similarity: number;
}

export interface CoverageGap {
  workItemId: string;
  azureId: string;
  title: string;
  workItemType: string;
  hasDirectTests: boolean;
  similarTestCount: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private modelVersion: string = "text-embedding-ada-002";

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  // Generate content hash to avoid re-embedding unchanged content
  private generateContentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  // Create embeddings content from work item
  private createWorkItemContent(workItem: WorkItem): string {
    const parts = [
      `Title: ${workItem.title}`,
      workItem.description ? `Description: ${workItem.description}` : "",
      `Type: ${workItem.workItemType}`,
      workItem.acceptanceCriteria
        ? `Acceptance Criteria: ${workItem.acceptanceCriteria}`
        : "",
      workItem.tags && workItem.tags.length > 0
        ? `Tags: ${workItem.tags.join(", ")}`
        : "",
    ].filter(Boolean);

    return parts.join("\n");
  }

  // Create embeddings content from test case
  private createTestCaseContent(testCase: TestCase): string {
    const parts = [
      `Title: ${testCase.title}`,
      `Description: ${testCase.description}`,
      `Type: ${testCase.type}`,
      `Priority: ${testCase.priority}`,
      testCase.preconditions ? `Preconditions: ${testCase.preconditions}` : "",
      `Expected Result: ${testCase.expectedResult}`,
      testCase.steps.length > 0
        ? `Steps: ${testCase.steps
            .map(
              (step) =>
                `${step.step}. ${step.action} - Expected: ${step.expectedOutcome}`,
            )
            .join("\n")}`
        : "",
    ].filter(Boolean);

    return parts.join("\n");
  }

  // Generate embedding using OpenAI
  async generateEmbedding(content: string): Promise<EmbeddingResult> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.modelVersion,
        input: content.replace(/\n/g, " ").trim(),
      });

      return {
        embedding: response.data[0].embedding,
        contentHash: this.generateContentHash(content),
        modelVersion: this.modelVersion,
      };
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Embed work item and store in database
  async embedWorkItem(workItem: WorkItem): Promise<void> {
    try {
      const content = this.createWorkItemContent(workItem);
      const contentHash = this.generateContentHash(content);

      // Check if embedding already exists and is up to date
      const { data: existingEmbedding } = await supabaseAdmin
        .from("work_item_embeddings")
        .select("content_hash")
        .eq("work_item_id", workItem.id)
        .single();

      if (existingEmbedding?.content_hash === contentHash) {
        console.log(`Embedding for work item ${workItem.id} is up to date`);
        return;
      }

      // Generate new embedding
      const embeddingResult = await this.generateEmbedding(content);

      // Store in database
      await supabaseAdmin.from("work_item_embeddings").upsert({
        work_item_id: workItem.id,
        embedding: JSON.stringify(embeddingResult.embedding),
        content_hash: embeddingResult.contentHash,
        model_version: embeddingResult.modelVersion,
        updated_at: new Date().toISOString(),
      });

      console.log(`Embedded work item: ${workItem.title}`);
    } catch (error) {
      console.error(`Error embedding work item ${workItem.id}:`, error);
      throw error;
    }
  }

  // Embed test case and store in database
  async embedTestCase(testCase: TestCase): Promise<void> {
    try {
      const content = this.createTestCaseContent(testCase);
      const contentHash = this.generateContentHash(content);

      // Check if embedding already exists and is up to date
      const { data: existingEmbedding } = await supabaseAdmin
        .from("test_case_embeddings")
        .select("content_hash")
        .eq("test_case_id", testCase.id)
        .single();

      if (existingEmbedding?.content_hash === contentHash) {
        console.log(`Embedding for test case ${testCase.id} is up to date`);
        return;
      }

      // Generate new embedding
      const embeddingResult = await this.generateEmbedding(content);

      // Store in database
      await supabaseAdmin.from("test_case_embeddings").upsert({
        test_case_id: testCase.id,
        embedding: JSON.stringify(embeddingResult.embedding),
        content_hash: embeddingResult.contentHash,
        model_version: embeddingResult.modelVersion,
        updated_at: new Date().toISOString(),
      });

      console.log(`Embedded test case: ${testCase.title}`);
    } catch (error) {
      console.error(`Error embedding test case ${testCase.id}:`, error);
      throw error;
    }
  }

  // Find similar work items using vector search
  async findSimilarWorkItems(
    queryText: string,
    similarityThreshold: number = 0.7,
    matchCount: number = 10,
  ): Promise<SimilarityResult[]> {
    try {
      const embeddingResult = await this.generateEmbedding(queryText);

      const { data, error } = await supabaseAdmin.rpc(
        "search_similar_work_items",
        {
          query_embedding: JSON.stringify(embeddingResult.embedding),
          similarity_threshold: similarityThreshold,
          match_count: matchCount,
        },
      );

      if (error) {
        throw error;
      }

      return data.map((item: any) => ({
        id: item.azure_id,
        title: item.title,
        description: item.description || "",
        type: item.work_item_type,
        similarity: 1 - item.similarity, // Convert distance to similarity
      }));
    } catch (error) {
      console.error("Error finding similar work items:", error);
      throw error;
    }
  }

  // Find similar test cases using vector search
  async findSimilarTestCases(
    queryText: string,
    similarityThreshold: number = 0.7,
    matchCount: number = 10,
  ): Promise<SimilarityResult[]> {
    try {
      const embeddingResult = await this.generateEmbedding(queryText);

      const { data, error } = await supabaseAdmin.rpc(
        "search_similar_test_cases",
        {
          query_embedding: JSON.stringify(embeddingResult.embedding),
          similarity_threshold: similarityThreshold,
          match_count: matchCount,
        },
      );

      if (error) {
        throw error;
      }

      return data.map((item: any) => ({
        id: item.test_case_id,
        title: item.title,
        description: item.description || "",
        type: item.type,
        similarity: 1 - item.similarity, // Convert distance to similarity
      }));
    } catch (error) {
      console.error("Error finding similar test cases:", error);
      throw error;
    }
  }

  // Find similar test cases by comparing a specific test case's content with existing saved test cases
  async findSimilarTestCasesByContent(
    testCase: TestCase | Partial<TestCase>,
    similarityThreshold: number = 0.8,
    projectId?: string
  ): Promise<Array<{ id: string; title: string; description: string; type: string; similarity: number; contentHash: string }>> {
    try {
      // Create content from test case
      const content = this.createTestCaseContentFromPartial(testCase);
      const embeddingResult = await this.generateEmbedding(content);

      const { data, error } = await supabaseAdmin.rpc(
        "search_similar_test_cases_by_content",
        {
          query_embedding: JSON.stringify(embeddingResult.embedding),
          similarity_threshold: similarityThreshold,
          project_id_param: projectId || null,
          match_count: 10,
        },
      );

      if (error) {
        console.error("Database error in findSimilarTestCasesByContent:", error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        id: item.test_case_id,
        title: item.title,
        description: item.description || "",
        type: item.type,
        contentHash: item.content_hash,
        similarity: 1 - item.similarity, // Convert distance to similarity
      }));
    } catch (error) {
      console.error("Error finding similar test cases by content:", error);
      // Fallback to empty array if embeddings fail
      return [];
    }
  }

  // Helper method to create content from partial test case
  private createTestCaseContentFromPartial(testCase: TestCase | Partial<TestCase>): string {
    const parts = [
      testCase.title ? `Title: ${testCase.title}` : "",
      testCase.description ? `Description: ${testCase.description}` : "",
      testCase.type ? `Type: ${testCase.type}` : "",
      testCase.priority ? `Priority: ${testCase.priority}` : "",
      testCase.preconditions ? `Preconditions: ${testCase.preconditions}` : "",
      testCase.expectedResult ? `Expected Result: ${testCase.expectedResult}` : "",
      testCase.steps && testCase.steps.length > 0
        ? `Steps: ${testCase.steps
            .map(
              (step) =>
                `${step.step}. ${step.action} - Expected: ${step.expectedOutcome}`,
            )
            .join("\n")}`
        : "",
    ].filter(Boolean);

    return parts.join("\n");
  }

  // Batch check multiple test cases for duplicates
  async checkTestCasesForDuplicates(
    testCases: (TestCase | Partial<TestCase>)[],
    projectId?: string,
    similarityThreshold: number = 0.97,
    checkAgainstExistingOnly: boolean = true
  ): Promise<Array<{
    testCase: TestCase | Partial<TestCase>;
    isDuplicate: boolean;
    duplicateOf?: string;
    similarityScore?: number;
    duplicateType: 'exact' | 'semantic' | 'none';
  }>> {
    const results = [];
    
    // Note: checkAgainstExistingOnly parameter is included for API compatibility
    // This method already checks against existing saved test cases by default

    for (const testCase of testCases) {
      try {
        // Generate content hash for exact matching
        const content = this.createTestCaseContentFromPartial(testCase);
        const contentHash = this.generateContentHash(content);

        // First check for exact content hash match
        const { data: exactMatches, error: exactError } = await supabaseAdmin
          .from('test_cases')
          .select('id, title, content_hash')
          .eq('content_hash', contentHash)
          .limit(1);

        if (exactError) {
          console.error("Error checking exact matches:", exactError);
        }

        if (exactMatches && exactMatches.length > 0) {
          results.push({
            testCase,
            isDuplicate: true,
            duplicateOf: exactMatches[0].id,
            similarityScore: 1.0,
            duplicateType: 'exact' as const
          });
          continue;
        }

        // If no exact match, check for semantic similarity using vector embeddings
        const similarCases = await this.findSimilarTestCasesByContent(
          testCase, 
          similarityThreshold,
          projectId
        );

        if (similarCases.length > 0) {
          const bestMatch = similarCases[0]; // Already sorted by similarity
          console.log(`Duplicate found for "${testCase.title}": ${Math.round(bestMatch.similarity * 100)}% similar to "${bestMatch.title}" (threshold: ${Math.round(similarityThreshold * 100)}%)`);
          results.push({
            testCase,
            isDuplicate: true,
            duplicateOf: bestMatch.id,
            similarityScore: bestMatch.similarity,
            duplicateType: 'semantic' as const
          });
        } else {
          console.log(`No duplicates found for "${testCase.title}" (threshold: ${Math.round(similarityThreshold * 100)}%)`);
          results.push({
            testCase,
            isDuplicate: false,
            duplicateType: 'none' as const
          });
        }

      } catch (error) {
        console.error("Error checking test case for duplicates:", error);
        // If checking fails, assume no duplicate to be safe
        results.push({
          testCase,
          isDuplicate: false,
          duplicateType: 'none' as const
        });
      }
    }

    return results;
  }

  // Find test coverage gaps for a project
  async findCoverageGaps(
    projectId: string,
    similarityThreshold: number = 0.8,
  ): Promise<CoverageGap[]> {
    try {
      const { data, error } = await supabaseAdmin.rpc("find_coverage_gaps", {
        project_id_param: projectId,
        similarity_threshold: similarityThreshold,
      });

      if (error) {
        throw error;
      }

      return data.map((item: any) => ({
        workItemId: item.work_item_id,
        azureId: item.azure_id,
        title: item.title,
        workItemType: item.work_item_type,
        hasDirectTests: item.has_direct_tests,
        similarTestCount: item.similar_test_count,
      }));
    } catch (error) {
      console.error("Error finding coverage gaps:", error);
      throw error;
    }
  }

  // Batch embed all work items in a project
  async embedProjectWorkItems(projectId: string): Promise<void> {
    try {
      const { data: workItems, error } = await supabaseAdmin
        .from("work_items")
        .select("*")
        .eq("project_id", projectId);

      if (error) {
        throw error;
      }

      console.log(
        `Embedding ${workItems?.length || 0} work items for project ${projectId}`,
      );

      for (const workItem of workItems || []) {
        await this.embedWorkItem({
          id: workItem.id,
          title: workItem.title,
          description: workItem.description || "",
          workItemType: workItem.work_item_type as any,
          state: workItem.state,
          assignedTo: workItem.assigned_to,
          priority: workItem.priority,
          acceptanceCriteria: workItem.acceptance_criteria || "",
          tags: Array.isArray(workItem.tags) ? workItem.tags : [],
          createdDate: workItem.created_date,
          changedDate: workItem.changed_date,
          parentId: undefined,
          children: [],
          relatedItems: [],
          isUserStory: workItem.work_item_type === "User Story",
          isTask: workItem.work_item_type === "Task",
          hasChildren: false,
          hasParent: false,
        });
      }

      console.log(`Completed embedding work items for project ${projectId}`);
    } catch (error) {
      console.error("Error embedding project work items:", error);
      throw error;
    }
  }

  // Batch embed all test cases in a project
  async embedProjectTestCases(projectId: string): Promise<void> {
    try {
      const { data: testCases, error } = await supabaseAdmin
        .from("test_cases")
        .select("*")
        .eq("project_id", projectId);

      if (error) {
        throw error;
      }

      console.log(
        `Embedding ${testCases?.length || 0} test cases for project ${projectId}`,
      );

      for (const testCase of testCases || []) {
        await this.embedTestCase({
          id: testCase.id,
          title: testCase.title,
          description: testCase.description,
          type: testCase.type as any,
          priority: testCase.priority as any,
          status: testCase.status as any,
          steps: Array.isArray(testCase.steps) ? testCase.steps : [],
          expectedResult: testCase.expected_result,
          preconditions: testCase.preconditions,
          testData: testCase.test_data,
          estimatedDuration: testCase.estimated_duration,
          projectId: testCase.project_id,
          createdAt: new Date(testCase.created_at),
          updatedAt: new Date(testCase.updated_at || testCase.created_at),
          generatedAt: testCase.generated_at
            ? new Date(testCase.generated_at)
            : undefined,
          generatedBy: testCase.generated_by as any,
          generatedCode: testCase.generated_code,
        });
      }

      console.log(`Completed embedding test cases for project ${projectId}`);
    } catch (error) {
      console.error("Error embedding project test cases:", error);
      throw error;
    }
  }
}

// Factory function to create embedding service
export function createEmbeddingService(apiKey: string): EmbeddingService {
  return new EmbeddingService(apiKey);
}
