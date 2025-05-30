-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  organization TEXT NOT NULL,
  project TEXT NOT NULL,
  token TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  temperature FLOAT NOT NULL,
  max_tokens INTEGER NOT NULL,
  auto_generation BOOLEAN NOT NULL,
  ai_chat BOOLEAN NOT NULL,
  code_generation BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync TIMESTAMP WITH TIME ZONE
);

-- Create test_cases table
CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  steps JSONB NOT NULL,
  expected_result TEXT NOT NULL,
  preconditions TEXT,
  test_data JSONB,
  estimated_duration INTEGER,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_at TIMESTAMP WITH TIME ZONE,
  generated_by TEXT,
  generated_code TEXT
);

-- Create test_case_work_item_relations table
CREATE TABLE IF NOT EXISTS test_case_work_item_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(test_case_id, work_item_id, relation_type)
);

-- Create test_suites table
CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create test_suite_items table
CREATE TABLE IF NOT EXISTS test_suite_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(test_suite_id, test_case_id)
);

-- Create test_case_relations table
CREATE TABLE IF NOT EXISTS test_case_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  child_test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_test_case_id, child_test_case_id, relation_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_type ON test_cases(type);
CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status);
CREATE INDEX IF NOT EXISTS idx_test_case_work_item_relations_work_item_id ON test_case_work_item_relations(work_item_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_project_id ON test_suites(project_id);
CREATE INDEX IF NOT EXISTS idx_test_suite_items_test_suite_id ON test_suite_items(test_suite_id);

-- Enable realtime
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'projects') THEN
    alter publication supabase_realtime add table projects;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'test_cases') THEN
    alter publication supabase_realtime add table test_cases;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'test_case_work_item_relations') THEN
    alter publication supabase_realtime add table test_case_work_item_relations;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'test_suites') THEN
    alter publication supabase_realtime add table test_suites;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'test_suite_items') THEN
    alter publication supabase_realtime add table test_suite_items;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'test_case_relations') THEN
    alter publication supabase_realtime add table test_case_relations;
  END IF;
END $$;