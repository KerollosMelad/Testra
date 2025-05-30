-- Check if openai_api_key column exists and add it if not
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'openai_api_key') THEN
    ALTER TABLE projects ADD COLUMN openai_api_key TEXT;
  END IF;
  
  -- Also check for open_ai_key (with underscore) in case that's what was intended
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'open_ai_key') THEN
    ALTER TABLE projects ADD COLUMN open_ai_key TEXT;
  END IF;
END$$;
