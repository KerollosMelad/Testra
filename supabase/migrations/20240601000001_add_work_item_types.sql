-- Add work_item_types column to projects table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'work_item_types') THEN
    ALTER TABLE projects ADD COLUMN work_item_types TEXT[] DEFAULT ARRAY['User Story', 'Task', 'Bug', 'Feature'];
  END IF;
END$$;
