-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table for work items
CREATE TABLE IF NOT EXISTS work_item_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI ada-002 embedding size
  content_hash TEXT NOT NULL, -- To avoid re-embedding unchanged content
  model_version TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(work_item_id)
);

-- Create embeddings table for test cases
CREATE TABLE IF NOT EXISTS test_case_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI ada-002 embedding size
  content_hash TEXT NOT NULL, -- To avoid re-embedding unchanged content
  model_version TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(test_case_id)
);

-- Create similarity search functions
CREATE OR REPLACE FUNCTION search_similar_work_items(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  work_item_id UUID,
  azure_id TEXT,
  title TEXT,
  description TEXT,
  work_item_type TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wi.id,
    wi.azure_id,
    wi.title,
    wi.description,
    wi.work_item_type,
    (wie.embedding <=> query_embedding)::float as similarity
  FROM work_item_embeddings wie
  JOIN work_items wi ON wie.work_item_id = wi.id
  WHERE (wie.embedding <=> query_embedding) < (1 - similarity_threshold)
  ORDER BY wie.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_similar_test_cases(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  test_case_id UUID,
  title TEXT,
  description TEXT,
  type TEXT,
  priority TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.title,
    tc.description,
    tc.type,
    tc.priority,
    (tce.embedding <=> query_embedding)::float as similarity
  FROM test_case_embeddings tce
  JOIN test_cases tc ON tce.test_case_id = tc.id
  WHERE (tce.embedding <=> query_embedding) < (1 - similarity_threshold)
  ORDER BY tce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar test cases by content with optional project filtering
CREATE OR REPLACE FUNCTION search_similar_test_cases_by_content(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.8,
  project_id_param UUID DEFAULT NULL,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  test_case_id UUID,
  title TEXT,
  description TEXT,
  type TEXT,
  content_hash TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.title,
    tc.description,
    tc.type,
    tc.content_hash,
    (tce.embedding <=> query_embedding)::float as similarity
  FROM test_case_embeddings tce
  JOIN test_cases tc ON tce.test_case_id = tc.id
  WHERE (tce.embedding <=> query_embedding) < (1 - similarity_threshold)
    AND (project_id_param IS NULL OR tc.project_id = project_id_param)
  ORDER BY tce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find test coverage gaps
CREATE OR REPLACE FUNCTION find_coverage_gaps(
  project_id_param UUID,
  similarity_threshold float DEFAULT 0.8
)
RETURNS TABLE (
  work_item_id UUID,
  azure_id TEXT,
  title TEXT,
  work_item_type TEXT,
  has_direct_tests BOOLEAN,
  similar_test_count INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH work_item_tests AS (
    SELECT 
      wi.id as work_item_id,
      wi.azure_id,
      wi.title,
      wi.work_item_type,
      COUNT(tcwir.test_case_id) > 0 as has_direct_tests
    FROM work_items wi
    LEFT JOIN test_case_work_item_relations tcwir ON wi.azure_id = tcwir.work_item_id
    WHERE wi.project_id = project_id_param
    GROUP BY wi.id, wi.azure_id, wi.title, wi.work_item_type
  ),
  similar_tests AS (
    SELECT 
      wit.work_item_id,
      COUNT(DISTINCT tc.id) as similar_test_count
    FROM work_item_tests wit
    JOIN work_item_embeddings wie ON wit.work_item_id = wie.work_item_id
    JOIN test_case_embeddings tce ON (wie.embedding <=> tce.embedding) < (1 - similarity_threshold)
    JOIN test_cases tc ON tce.test_case_id = tc.id
    GROUP BY wit.work_item_id
  )
  SELECT 
    wit.work_item_id,
    wit.azure_id,
    wit.title,
    wit.work_item_type,
    wit.has_direct_tests,
    COALESCE(st.similar_test_count, 0)::INT
  FROM work_item_tests wit
  LEFT JOIN similar_tests st ON wit.work_item_id = st.work_item_id
  ORDER BY wit.has_direct_tests ASC, COALESCE(st.similar_test_count, 0) ASC;
END;
$$;

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_work_item_embeddings_vector ON work_item_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_test_case_embeddings_vector ON test_case_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_item_embeddings_work_item_id ON work_item_embeddings(work_item_id);
CREATE INDEX IF NOT EXISTS idx_test_case_embeddings_test_case_id ON test_case_embeddings(test_case_id);
CREATE INDEX IF NOT EXISTS idx_work_item_embeddings_content_hash ON work_item_embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_test_case_embeddings_content_hash ON test_case_embeddings(content_hash);

-- Enable realtime for embedding tables
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_item_embeddings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE work_item_embeddings;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'test_case_embeddings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE test_case_embeddings;
  END IF;
END $$; 