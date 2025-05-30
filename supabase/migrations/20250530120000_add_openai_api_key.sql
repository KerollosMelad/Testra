-- Add OpenAI API key field to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS openai_api_key TEXT; 