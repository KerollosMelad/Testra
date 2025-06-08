// Simple test script to verify embedding functionality
// Run with: node scripts/test-embeddings.js

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEmbeddings() {
  console.log('🔍 Testing embedding functionality...\n');

  try {
    // Check if embedding tables exist
    console.log('1. Checking embedding tables...');
    const { data: workItemEmbeddings, error: workItemError } = await supabase
      .from('work_item_embeddings')
      .select('id, work_item_id, model_version, created_at')
      .limit(5);

    const { data: testCaseEmbeddings, error: testCaseError } = await supabase
      .from('test_case_embeddings')
      .select('id, test_case_id, model_version, created_at')
      .limit(5);

    if (workItemError) {
      console.error('❌ Error accessing work_item_embeddings:', workItemError.message);
      return;
    }

    if (testCaseError) {
      console.error('❌ Error accessing test_case_embeddings:', testCaseError.message);
      return;
    }

    console.log(`✅ Found ${workItemEmbeddings?.length || 0} work item embeddings`);
    console.log(`✅ Found ${testCaseEmbeddings?.length || 0} test case embeddings`);

    if (workItemEmbeddings && workItemEmbeddings.length > 0) {
      console.log('   Latest work item embeddings:');
      workItemEmbeddings.forEach((item, index) => {
        console.log(`   ${index + 1}. Work Item ID: ${item.work_item_id}, Model: ${item.model_version}, Created: ${item.created_at}`);
      });
    }

    // Test vector search functions
    console.log('\n2. Testing vector search functions...');
    
    // Test search_similar_work_items function with a dummy query
    const testEmbedding = Array(1536).fill(0.001); // Dummy embedding vector
    
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_similar_work_items', {
        query_embedding: JSON.stringify(testEmbedding),
        similarity_threshold: 0.5,
        match_count: 3
      });

    if (searchError) {
      console.error('❌ Error testing search function:', searchError.message);
    } else {
      console.log(`✅ Search function works! Found ${searchResults?.length || 0} results`);
      if (searchResults && searchResults.length > 0) {
        console.log('   Search results:');
        searchResults.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.title} (${result.work_item_type}) - Similarity: ${result.similarity}`);
        });
      }
    }

    // Check work items without embeddings
    console.log('\n3. Checking work items missing embeddings...');
    const { data: workItemsWithoutEmbeddings, error: missingError } = await supabase
      .from('work_items')
      .select('id, azure_id, title, work_item_type')
      .not('id', 'in', `(${workItemEmbeddings?.map(e => `'${e.work_item_id}'`).join(',') || "''"})`)
      .limit(10);

    if (missingError) {
      console.error('❌ Error checking missing embeddings:', missingError.message);
    } else {
      console.log(`📋 Found ${workItemsWithoutEmbeddings?.length || 0} work items without embeddings`);
      if (workItemsWithoutEmbeddings && workItemsWithoutEmbeddings.length > 0) {
        console.log('   Work items needing embeddings:');
        workItemsWithoutEmbeddings.slice(0, 5).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title} (${item.work_item_type}) - Azure ID: ${item.azure_id}`);
        });
      }
    }

    console.log('\n✅ Embedding test completed!');
    
    if (workItemEmbeddings?.length === 0) {
      console.log('\n💡 To create embeddings:');
      console.log('   1. Ensure OpenAI API key is configured in your project');
      console.log('   2. Run "Sync & Embed" in the work items dashboard');
      console.log('   3. Or use the "Create Embeddings" button in the search interface');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEmbeddings(); 