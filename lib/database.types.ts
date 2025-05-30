export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          organization: string;
          project: string;
          token: string;
          ai_model: string;
          temperature: number;
          max_tokens: number;
          auto_generation: boolean;
          ai_chat: boolean;
          code_generation: boolean;
          created_at: string;
          last_sync: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          organization: string;
          project: string;
          token: string;
          ai_model: string;
          temperature: number;
          max_tokens: number;
          auto_generation: boolean;
          ai_chat: boolean;
          code_generation: boolean;
          created_at?: string;
          last_sync?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          organization?: string;
          project?: string;
          token?: string;
          ai_model?: string;
          temperature?: number;
          max_tokens?: number;
          auto_generation?: boolean;
          ai_chat?: boolean;
          code_generation?: boolean;
          created_at?: string;
          last_sync?: string | null;
        };
      };
      test_cases: {
        Row: {
          id: string;
          title: string;
          description: string;
          type: string;
          priority: string;
          status: string;
          steps: Json;
          expected_result: string;
          preconditions: string | null;
          test_data: Json | null;
          estimated_duration: number | null;
          project_id: string;
          created_at: string;
          updated_at: string;
          generated_at: string | null;
          generated_by: string | null;
          generated_code: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          type: string;
          priority: string;
          status?: string;
          steps: Json;
          expected_result: string;
          preconditions?: string | null;
          test_data?: Json | null;
          estimated_duration?: number | null;
          project_id: string;
          created_at?: string;
          updated_at?: string;
          generated_at?: string | null;
          generated_by?: string | null;
          generated_code?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          type?: string;
          priority?: string;
          status?: string;
          steps?: Json;
          expected_result?: string;
          preconditions?: string | null;
          test_data?: Json | null;
          estimated_duration?: number | null;
          project_id?: string;
          created_at?: string;
          updated_at?: string;
          generated_at?: string | null;
          generated_by?: string | null;
          generated_code?: string | null;
        };
      };
      test_case_work_item_relations: {
        Row: {
          id: string;
          test_case_id: string;
          work_item_id: string;
          relation_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_case_id: string;
          work_item_id: string;
          relation_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_case_id?: string;
          work_item_id?: string;
          relation_type?: string;
          created_at?: string;
        };
      };
      test_suites: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          type: string;
          project_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          type: string;
          project_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          type?: string;
          project_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      test_suite_items: {
        Row: {
          id: string;
          test_suite_id: string;
          test_case_id: string;
          order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_suite_id: string;
          test_case_id: string;
          order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_suite_id?: string;
          test_case_id?: string;
          order?: number;
          created_at?: string;
        };
      };
      test_case_relations: {
        Row: {
          id: string;
          parent_test_case_id: string;
          child_test_case_id: string;
          relation_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_test_case_id: string;
          child_test_case_id: string;
          relation_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_test_case_id?: string;
          child_test_case_id?: string;
          relation_type?: string;
          created_at?: string;
        };
      };
    };
  };
}
