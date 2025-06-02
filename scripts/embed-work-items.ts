#!/usr/bin/env tsx
import { Command } from 'commander';
import { createEmbeddingService } from '../lib/embedding-service';
import { supabaseAdmin } from '../lib/supabase';

const program = new Command();

async function embedWorkItems(projectId: string, apiKey: string) {
  console.log(`🚀 Starting embedding process for project: ${projectId}`);
  
  const embeddingService = createEmbeddingService(apiKey);
  
  try {
    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    console.log(`📋 Project: ${project.name}`);
    
    // Embed work items
    console.log('\n🔍 Embedding work items...');
    await embeddingService.embedProjectWorkItems(projectId);
    
    // Embed test cases
    console.log('\n🧪 Embedding test cases...');
    await embeddingService.embedProjectTestCases(projectId);
    
    console.log('\n✅ Embedding process completed successfully!');
    
    // Show coverage analysis
    console.log('\n📊 Coverage Analysis:');
    const coverageGaps = await embeddingService.findCoverageGaps(projectId);
    
    console.log(`\n📈 Coverage Summary:`);
    console.log(`  Total work items: ${coverageGaps.length}`);
    console.log(`  With direct tests: ${coverageGaps.filter(gap => gap.hasDirectTests).length}`);
    console.log(`  Without tests: ${coverageGaps.filter(gap => !gap.hasDirectTests && gap.similarTestCount === 0).length}`);
    console.log(`  With similar tests only: ${coverageGaps.filter(gap => !gap.hasDirectTests && gap.similarTestCount > 0).length}`);
    
    // Show top coverage gaps
    const topGaps = coverageGaps
      .filter(gap => !gap.hasDirectTests)
      .sort((a, b) => a.similarTestCount - b.similarTestCount)
      .slice(0, 5);
      
    if (topGaps.length > 0) {
      console.log('\n🎯 Top Coverage Gaps:');
      topGaps.forEach((gap, index) => {
        console.log(`  ${index + 1}. ${gap.title} (${gap.workItemType})`);
        console.log(`     Azure ID: ${gap.azureId}`);
        console.log(`     Similar tests: ${gap.similarTestCount}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error during embedding process:', error);
    process.exit(1);
  }
}

async function searchSimilar(projectId: string, apiKey: string, query: string, type: 'work-items' | 'test-cases') {
  console.log(`🔍 Searching for similar ${type} in project: ${projectId}`);
  console.log(`📝 Query: "${query}"`);
  
  const embeddingService = createEmbeddingService(apiKey);
  
  try {
    const results = type === 'work-items' 
      ? await embeddingService.findSimilarWorkItems(query)
      : await embeddingService.findSimilarTestCases(query);
    
    if (results.length === 0) {
      console.log('❌ No similar items found.');
      return;
    }
    
    console.log(`\n✅ Found ${results.length} similar ${type}:`);
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Type: ${result.type}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      if (result.description) {
        console.log(`   Description: ${result.description.substring(0, 100)}...`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error during search:', error);
    process.exit(1);
  }
}

async function analyzeGaps(projectId: string, apiKey: string) {
  console.log(`📊 Analyzing test coverage gaps for project: ${projectId}`);
  
  const embeddingService = createEmbeddingService(apiKey);
  
  try {
    const coverageGaps = await embeddingService.findCoverageGaps(projectId);
    
    // Group by coverage status
    const withDirectTests = coverageGaps.filter(gap => gap.hasDirectTests);
    const withoutTests = coverageGaps.filter(gap => !gap.hasDirectTests && gap.similarTestCount === 0);
    const withSimilarOnly = coverageGaps.filter(gap => !gap.hasDirectTests && gap.similarTestCount > 0);
    
    console.log('\n📈 Coverage Summary:');
    console.log(`  ✅ With direct tests: ${withDirectTests.length}`);
    console.log(`  ⚠️  With similar tests only: ${withSimilarOnly.length}`);
    console.log(`  ❌ Without any tests: ${withoutTests.length}`);
    console.log(`  📊 Total work items: ${coverageGaps.length}`);
    console.log(`  📈 Coverage rate: ${((withDirectTests.length / coverageGaps.length) * 100).toFixed(1)}%`);
    
    // Show high-priority gaps
    const highPriorityGaps = withoutTests
      .filter(gap => gap.workItemType === 'Feature' || gap.workItemType === 'User Story')
      .slice(0, 10);
      
    if (highPriorityGaps.length > 0) {
      console.log('\n🚨 High Priority Coverage Gaps:');
      highPriorityGaps.forEach((gap, index) => {
        console.log(`  ${index + 1}. ${gap.title}`);
        console.log(`     Type: ${gap.workItemType}`);
        console.log(`     Azure ID: ${gap.azureId}`);
        console.log('');
      });
    }
    
    // Show items with similar tests but no direct tests
    if (withSimilarOnly.length > 0) {
      console.log('\n🔍 Items with Similar Tests (consider creating direct tests):');
      withSimilarOnly.slice(0, 5).forEach((gap, index) => {
        console.log(`  ${index + 1}. ${gap.title}`);
        console.log(`     Type: ${gap.workItemType}`);
        console.log(`     Similar tests found: ${gap.similarTestCount}`);
        console.log(`     Azure ID: ${gap.azureId}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error during gap analysis:', error);
    process.exit(1);
  }
}

// Main CLI setup
program
  .name('embed-work-items')
  .description('CLI tool for embedding work items and test cases for vector search')
  .version('1.0.0');

program
  .command('embed')
  .description('Embed all work items and test cases for a project')
  .requiredOption('-p, --project <projectId>', 'Project ID')
  .requiredOption('-k, --api-key <apiKey>', 'OpenAI API key')
  .action(async (options) => {
    await embedWorkItems(options.project, options.apiKey);
  });

program
  .command('search')
  .description('Search for similar work items or test cases')
  .requiredOption('-p, --project <projectId>', 'Project ID')
  .requiredOption('-k, --api-key <apiKey>', 'OpenAI API key')
  .requiredOption('-q, --query <query>', 'Search query')
  .option('-t, --type <type>', 'Search type: work-items or test-cases', 'work-items')
  .action(async (options) => {
    if (!['work-items', 'test-cases'].includes(options.type)) {
      console.error('❌ Type must be either "work-items" or "test-cases"');
      process.exit(1);
    }
    await searchSimilar(options.project, options.apiKey, options.query, options.type);
  });

program
  .command('gaps')
  .description('Analyze test coverage gaps')
  .requiredOption('-p, --project <projectId>', 'Project ID')
  .requiredOption('-k, --api-key <apiKey>', 'OpenAI API key')
  .action(async (options) => {
    await analyzeGaps(options.project, options.apiKey);
  });

// Example usage
program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log('🚀 Usage Examples:');
    console.log('');
    console.log('1. Embed all work items and test cases:');
    console.log('   npm run embed -- embed -p <project-id> -k <openai-api-key>');
    console.log('');
    console.log('2. Search for similar work items:');
    console.log('   npm run embed -- search -p <project-id> -k <openai-api-key> -q "user login authentication" -t work-items');
    console.log('');
    console.log('3. Search for similar test cases:');
    console.log('   npm run embed -- search -p <project-id> -k <openai-api-key> -q "login validation test" -t test-cases');
    console.log('');
    console.log('4. Analyze test coverage gaps:');
    console.log('   npm run embed -- gaps -p <project-id> -k <openai-api-key>');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Run embed first to generate embeddings');
    console.log('   - Use descriptive queries for better search results');
    console.log('   - Analyze gaps regularly to identify testing needs');
  });

if (require.main === module) {
  program.parse(process.argv);
} 