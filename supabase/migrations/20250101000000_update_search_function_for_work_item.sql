-- Update search_similar_test_cases_by_content function to support work item filtering
CREATE OR REPLACE FUNCTION search_similar_test_cases_by_content(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.8,
  project_id_param UUID DEFAULT NULL,
  work_item_id_param TEXT DEFAULT NULL,
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
  LEFT JOIN test_case_work_item_relations tcwir ON tc.id = tcwir.test_case_id
  WHERE (tce.embedding <=> query_embedding) < (1 - similarity_threshold)
    AND (project_id_param IS NULL OR tc.project_id = project_id_param)
    AND (work_item_id_param IS NULL OR tcwir.work_item_id = work_item_id_param)
  ORDER BY tce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$; 