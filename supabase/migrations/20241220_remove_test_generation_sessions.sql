-- Remove test generation sessions and chunks tables
-- Revert test_cases table to original state

-- Drop session tables
DROP TABLE IF EXISTS test_generation_chunks CASCADE;
DROP TABLE IF EXISTS test_generation_sessions CASCADE;

-- Remove session-related columns from test_cases table
ALTER TABLE test_cases 
  DROP COLUMN IF EXISTS generated_from_session_id,
  DROP COLUMN IF EXISTS generated_from_chunk_id,
  DROP COLUMN IF EXISTS covered_criteria;

-- Add content_hash column for duplicate detection during saves
ALTER TABLE test_cases 
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64) UNIQUE;

-- Create index for faster hash lookups
CREATE INDEX IF NOT EXISTS idx_test_cases_content_hash ON test_cases(content_hash);

-- Add function to generate content hash
CREATE OR REPLACE FUNCTION generate_test_case_hash(
  p_title TEXT,
  p_description TEXT,
  p_steps JSONB,
  p_expected_result TEXT
) RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(
    digest(
      COALESCE(p_title, '') || '|' || 
      COALESCE(p_description, '') || '|' || 
      COALESCE(p_steps::text, '') || '|' || 
      COALESCE(p_expected_result, ''),
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to automatically generate hash on insert/update
CREATE OR REPLACE FUNCTION set_test_case_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_hash = generate_test_case_hash(
    NEW.title,
    NEW.description,
    NEW.steps,
    NEW.expected_result
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_test_case_hash ON test_cases;
CREATE TRIGGER trigger_set_test_case_hash
  BEFORE INSERT OR UPDATE ON test_cases
  FOR EACH ROW
  EXECUTE FUNCTION set_test_case_hash(); 