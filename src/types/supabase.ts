export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          ai_chat: boolean
          ai_model: string
          auto_generation: boolean
          code_generation: boolean
          created_at: string | null
          description: string | null
          id: string
          last_sync: string | null
          max_tokens: number
          name: string
          open_ai_key: string | null
          openai_api_key: string | null
          organization: string
          project: string
          temperature: number
          token: string
          work_item_types: string[] | null
        }
        Insert: {
          ai_chat: boolean
          ai_model: string
          auto_generation: boolean
          code_generation: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          last_sync?: string | null
          max_tokens: number
          name: string
          open_ai_key?: string | null
          openai_api_key?: string | null
          organization: string
          project: string
          temperature: number
          token: string
          work_item_types?: string[] | null
        }
        Update: {
          ai_chat?: boolean
          ai_model?: string
          auto_generation?: boolean
          code_generation?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          last_sync?: string | null
          max_tokens?: number
          name?: string
          open_ai_key?: string | null
          openai_api_key?: string | null
          organization?: string
          project?: string
          temperature?: number
          token?: string
          work_item_types?: string[] | null
        }
        Relationships: []
      }
      test_case_relations: {
        Row: {
          child_test_case_id: string
          created_at: string | null
          id: string
          parent_test_case_id: string
          relation_type: string
        }
        Insert: {
          child_test_case_id: string
          created_at?: string | null
          id?: string
          parent_test_case_id: string
          relation_type: string
        }
        Update: {
          child_test_case_id?: string
          created_at?: string | null
          id?: string
          parent_test_case_id?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_case_relations_child_test_case_id_fkey"
            columns: ["child_test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_case_relations_parent_test_case_id_fkey"
            columns: ["parent_test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_case_work_item_relations: {
        Row: {
          created_at: string | null
          id: string
          relation_type: string
          test_case_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          relation_type: string
          test_case_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          relation_type?: string
          test_case_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_work_item_relations_work_item_id"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["azure_id"]
          },
          {
            foreignKeyName: "test_case_work_item_relations_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          created_at: string | null
          description: string
          estimated_duration: number | null
          expected_result: string
          generated_at: string | null
          generated_by: string | null
          generated_code: string | null
          id: string
          preconditions: string | null
          priority: string
          project_id: string
          status: string
          steps: Json
          test_data: Json | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          estimated_duration?: number | null
          expected_result: string
          generated_at?: string | null
          generated_by?: string | null
          generated_code?: string | null
          id?: string
          preconditions?: string | null
          priority: string
          project_id: string
          status?: string
          steps: Json
          test_data?: Json | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          estimated_duration?: number | null
          expected_result?: string
          generated_at?: string | null
          generated_by?: string | null
          generated_code?: string | null
          id?: string
          preconditions?: string | null
          priority?: string
          project_id?: string
          status?: string
          steps?: Json
          test_data?: Json | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      test_suite_items: {
        Row: {
          created_at: string | null
          id: string
          order: number | null
          test_case_id: string
          test_suite_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order?: number | null
          test_case_id: string
          test_suite_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order?: number | null
          test_case_id?: string
          test_suite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_suite_items_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_suite_items_test_suite_id_fkey"
            columns: ["test_suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      test_suites: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          project_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          project_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_suites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_relations: {
        Row: {
          child_work_item_id: string
          created_at: string | null
          id: string
          parent_work_item_id: string
          relation_type: string
        }
        Insert: {
          child_work_item_id: string
          created_at?: string | null
          id?: string
          parent_work_item_id: string
          relation_type: string
        }
        Update: {
          child_work_item_id?: string
          created_at?: string | null
          id?: string
          parent_work_item_id?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_relations_child_work_item_id_fkey"
            columns: ["child_work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_relations_parent_work_item_id_fkey"
            columns: ["parent_work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          acceptance_criteria: string | null
          assigned_to: string | null
          azure_id: string
          changed_date: string | null
          created_date: string | null
          description: string | null
          id: string
          last_sync_at: string | null
          priority: string | null
          project_id: string
          state: string
          tags: Json | null
          title: string
          work_item_type: string
        }
        Insert: {
          acceptance_criteria?: string | null
          assigned_to?: string | null
          azure_id: string
          changed_date?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          last_sync_at?: string | null
          priority?: string | null
          project_id: string
          state: string
          tags?: Json | null
          title: string
          work_item_type: string
        }
        Update: {
          acceptance_criteria?: string | null
          assigned_to?: string | null
          azure_id?: string
          changed_date?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          last_sync_at?: string | null
          priority?: string | null
          project_id?: string
          state?: string
          tags?: Json | null
          title?: string
          work_item_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
