-- Create work_items table
CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  azure_id TEXT UNIQUE NOT NULL, -- The actual Azure DevOps work item ID
  title TEXT NOT NULL,
  description TEXT,
  work_item_type TEXT NOT NULL, -- User Story, Task, Bug, Feature
  state TEXT NOT NULL,
  assigned_to TEXT,
  priority TEXT,
  acceptance_criteria TEXT,
  tags JSONB, -- Array of tags
  created_date TIMESTAMP WITH TIME ZONE,
  changed_date TIMESTAMP WITH TIME ZONE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create work_item_relations table
CREATE TABLE IF NOT EXISTS work_item_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  child_work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL, -- parent, child, related, predecessor, successor
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_work_item_id, child_work_item_id, relation_type)
);

-- Update test_case_work_item_relations to reference work_items table
-- First, we need to add a foreign key constraint to work_items
ALTER TABLE test_case_work_item_relations 
ADD CONSTRAINT fk_work_item_relations_work_item_id 
FOREIGN KEY (work_item_id) REFERENCES work_items(azure_id);

-- Create indexes for work_items
CREATE INDEX IF NOT EXISTS idx_work_items_project_id ON work_items(project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_azure_id ON work_items(azure_id);
CREATE INDEX IF NOT EXISTS idx_work_items_work_item_type ON work_items(work_item_type);
CREATE INDEX IF NOT EXISTS idx_work_items_state ON work_items(state);

-- Enable realtime for work_items tables
DO $ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE work_items;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_item_relations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE work_item_relations;
  END IF;
END $;