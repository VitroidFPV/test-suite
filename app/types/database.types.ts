export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      tags: {
        Row: {
          color: string
          id: string
          title: string
        }
        Insert: {
          color?: string
          id?: string
          title?: string
        }
        Update: {
          color?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      test_case_group_links: {
        Row: {
          case: string
          group: string
        }
        Insert: {
          case: string
          group: string
        }
        Update: {
          case?: string
          group?: string
        }
        Relationships: [
          {
            foreignKeyName: "grouped_cases_case_fkey"
            columns: ["case"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grouped_cases_group_fkey"
            columns: ["group"]
            isOneToOne: false
            referencedRelation: "test_case_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      test_case_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          title?: string
        }
        Relationships: []
      }
      test_cases: {
        Row: {
          case_id: number
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["priority_string"] | null
          text: string | null
          title: string
        }
        Insert: {
          case_id?: number
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_string"] | null
          text?: string | null
          title: string
        }
        Update: {
          case_id?: number
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_string"] | null
          text?: string | null
          title?: string
        }
        Relationships: []
      }
      test_plan_case_links: {
        Row: {
          case: string
          plan: string
        }
        Insert: {
          case: string
          plan: string
        }
        Update: {
          case?: string
          plan?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_cases_case_fkey"
            columns: ["case"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plan_case_links_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          title?: string | null
        }
        Relationships: []
      }
      test_run_case_links: {
        Row: {
          case: string
          comment: string | null
          result: Database["public"]["Enums"]["test_run_result"]
          run: string
        }
        Insert: {
          case: string
          comment?: string | null
          result?: Database["public"]["Enums"]["test_run_result"]
          run: string
        }
        Update: {
          case?: string
          comment?: string | null
          result?: Database["public"]["Enums"]["test_run_result"]
          run?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_run_case_links_case_id_fkey"
            columns: ["case"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_run_case_links_run_id_fkey"
            columns: ["run"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_run_group_links: {
        Row: {
          group: string
          run: string
        }
        Insert: {
          group: string
          run: string
        }
        Update: {
          group?: string
          run?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_run_group_links_group_fkey"
            columns: ["group"]
            isOneToOne: false
            referencedRelation: "test_run_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_run_group_links_run_fkey"
            columns: ["run"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_run_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          title?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          title?: string
        }
        Relationships: []
      }
      test_runs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          plan: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          plan?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          plan?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_metadata: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          role: string | null
          username: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id: string
          role?: string | null
          username?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          role?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      priority_string: "low" | "medium" | "high"
      test_run_result: "not_run" | "passed" | "failed" | "blocked" | "skipped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      priority_string: ["low", "medium", "high"],
      test_run_result: ["not_run", "passed", "failed", "blocked", "skipped"],
    },
  },
} as const
