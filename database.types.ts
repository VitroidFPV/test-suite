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
          text: string | null
          title: string
        }
        Insert: {
          case_id?: number
          created_at?: string
          id?: string
          text?: string | null
          title: string
        }
        Update: {
          case_id?: number
          created_at?: string
          id?: string
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
