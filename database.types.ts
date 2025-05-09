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
          case_id: string
          notes: string | null
          result: string | null
          run_id: string
        }
        Insert: {
          case_id: string
          notes?: string | null
          result?: string | null
          run_id: string
        }
        Update: {
          case_id?: string
          notes?: string | null
          result?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_run_case_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_run_case_links_run_id_fkey"
            columns: ["run_id"]
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
      test_runs: {
        Row: {
          created_at: string
          created_by: string | null
          group: string | null
          id: string
          plan: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group?: string | null
          id?: string
          plan?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group?: string | null
          id?: string
          plan?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_group_fkey"
            columns: ["group"]
            isOneToOne: false
            referencedRelation: "test_run_groups"
            referencedColumns: ["id"]
          },
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
          created_at: string
          id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
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
    Enums: {
      priority_string: ["low", "medium", "high"],
    },
  },
} as const
