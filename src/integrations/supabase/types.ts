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
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      brand_aliases: {
        Row: {
          canonical_brand_id: string
          created_at: string
          created_by: string | null
          external_name: string
          id: string
          source: string
        }
        Insert: {
          canonical_brand_id: string
          created_at?: string
          created_by?: string | null
          external_name: string
          id?: string
          source: string
        }
        Update: {
          canonical_brand_id?: string
          created_at?: string
          created_by?: string | null
          external_name?: string
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_aliases_canonical_brand_id_fkey"
            columns: ["canonical_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_events: {
        Row: {
          brand_id: string
          category: Database["public"]["Enums"]["event_category"]
          company_response_date: string | null
          company_response_summary: string | null
          company_response_url: string | null
          created_at: string
          description: string
          event_date: string | null
          event_id: string
          impact_environment: number | null
          impact_labor: number | null
          impact_politics: number | null
          impact_social: number | null
          jurisdiction: string | null
          occurred_at: string | null
          orientation: Database["public"]["Enums"]["event_orientation"] | null
          raw_data: Json | null
          resolved: boolean | null
          severity: string | null
          source_url: string | null
          source_url_sha256: string | null
          title: string | null
          updated_at: string
          verification: Database["public"]["Enums"]["verification_level"] | null
          verified: boolean | null
        }
        Insert: {
          brand_id: string
          category?: Database["public"]["Enums"]["event_category"]
          company_response_date?: string | null
          company_response_summary?: string | null
          company_response_url?: string | null
          created_at?: string
          description: string
          event_date?: string | null
          event_id?: string
          impact_environment?: number | null
          impact_labor?: number | null
          impact_politics?: number | null
          impact_social?: number | null
          jurisdiction?: string | null
          occurred_at?: string | null
          orientation?: Database["public"]["Enums"]["event_orientation"] | null
          raw_data?: Json | null
          resolved?: boolean | null
          severity?: string | null
          source_url?: string | null
          source_url_sha256?: string | null
          title?: string | null
          updated_at?: string
          verification?:
            | Database["public"]["Enums"]["verification_level"]
            | null
          verified?: boolean | null
        }
        Update: {
          brand_id?: string
          category?: Database["public"]["Enums"]["event_category"]
          company_response_date?: string | null
          company_response_summary?: string | null
          company_response_url?: string | null
          created_at?: string
          description?: string
          event_date?: string | null
          event_id?: string
          impact_environment?: number | null
          impact_labor?: number | null
          impact_politics?: number | null
          impact_social?: number | null
          jurisdiction?: string | null
          occurred_at?: string | null
          orientation?: Database["public"]["Enums"]["event_orientation"] | null
          raw_data?: Json | null
          resolved?: boolean | null
          severity?: string | null
          source_url?: string | null
          source_url_sha256?: string | null
          title?: string | null
          updated_at?: string
          verification?:
            | Database["public"]["Enums"]["verification_level"]
            | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_ownerships: {
        Row: {
          brand_id: string
          confidence: number | null
          created_at: string
          effective_date: string | null
          id: string
          parent_brand_id: string
          relationship_type: string
          source: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          confidence?: number | null
          created_at?: string
          effective_date?: string | null
          id?: string
          parent_brand_id: string
          relationship_type: string
          source: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          confidence?: number | null
          created_at?: string
          effective_date?: string | null
          id?: string
          parent_brand_id?: string
          relationship_type?: string
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_ownerships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ownerships_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_scores: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          last_updated: string
          score_environment: number
          score_labor: number
          score_politics: number
          score_social: number
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          last_updated?: string
          score_environment?: number
          score_labor?: number
          score_politics?: number
          score_social?: number
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          last_updated?: string
          score_environment?: number
          score_labor?: number
          score_politics?: number
          score_social?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_company: string | null
          push_paused: boolean
          updated_at: string
          website: string | null
          wikidata_qid: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_company?: string | null
          push_paused?: boolean
          updated_at?: string
          website?: string | null
          wikidata_qid?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_company?: string | null
          push_paused?: boolean
          updated_at?: string
          website?: string | null
          wikidata_qid?: string | null
        }
        Relationships: []
      }
      event_sources: {
        Row: {
          created_at: string
          event_id: string
          id: string
          quote: string | null
          source_date: string | null
          source_name: string
          source_url: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          quote?: string | null
          source_date?: string | null
          source_name: string
          source_url?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          quote?: string | null
          source_date?: string | null
          source_name?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          coalesce_key: string | null
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          not_before: string
          payload: Json
          stage: string
        }
        Insert: {
          attempts?: number
          coalesce_key?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          not_before?: string
          payload?: Json
          stage: string
        }
        Update: {
          attempts?: number
          coalesce_key?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          not_before?: string
          payload?: Json
          stage?: string
        }
        Relationships: []
      }
      jobs_dead: {
        Row: {
          attempts: number
          id: string
          last_error: string | null
          moved_to_dead_at: string
          original_created_at: string | null
          payload: Json
          stage: string
        }
        Insert: {
          attempts: number
          id: string
          last_error?: string | null
          moved_to_dead_at?: string
          original_created_at?: string | null
          payload: Json
          stage: string
        }
        Update: {
          attempts?: number
          id?: string
          last_error?: string | null
          moved_to_dead_at?: string
          original_created_at?: string | null
          payload?: Json
          stage?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          brand_id: string
          category: string
          delta: number | null
          error: string | null
          id: string
          sent_at: string | null
          sent_day: string | null
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          brand_id: string
          category: string
          delta?: number | null
          error?: string | null
          id?: string
          sent_at?: string | null
          sent_day?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          brand_id?: string
          category?: string
          delta?: number | null
          error?: string | null
          id?: string
          sent_at?: string | null
          sent_day?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      pilot_brands: {
        Row: {
          brand_id: string
        }
        Insert: {
          brand_id: string
        }
        Update: {
          brand_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string
          brand_id: string | null
          category: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          barcode: string
          brand_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          barcode?: string
          brand_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      source_credibility: {
        Row: {
          base_credibility: number
          created_at: string
          dynamic_adjustment: number | null
          id: string
          notes: string | null
          source_name: string
          updated_at: string
        }
        Insert: {
          base_credibility: number
          created_at?: string
          dynamic_adjustment?: number | null
          id?: string
          notes?: string | null
          source_name: string
          updated_at?: string
        }
        Update: {
          base_credibility?: number
          created_at?: string
          dynamic_adjustment?: number | null
          id?: string
          notes?: string | null
          source_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          brand_id: string
          created_at: string | null
          notifications_enabled: boolean
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          notifications_enabled?: boolean
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          notifications_enabled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          digest_time: string | null
          id: string
          muted_categories: string[]
          notification_mode: string | null
          political_alignment: string | null
          updated_at: string
          user_id: string
          value_weights: Json | null
        }
        Insert: {
          created_at?: string
          digest_time?: string | null
          id?: string
          muted_categories?: string[]
          notification_mode?: string | null
          political_alignment?: string | null
          updated_at?: string
          user_id: string
          value_weights?: Json | null
        }
        Update: {
          created_at?: string
          digest_time?: string | null
          id?: string
          muted_categories?: string[]
          notification_mode?: string | null
          political_alignment?: string | null
          updated_at?: string
          user_id?: string
          value_weights?: Json | null
        }
        Relationships: []
      }
      user_push_subs: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          ua: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          ua?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          ua?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_coalescing_effectiveness: {
        Row: {
          coalesced: number | null
          coalesced_pct: number | null
          hour: string | null
          non_coalesced: number | null
        }
        Relationships: []
      }
      v_notification_metrics_hourly: {
        Row: {
          avg_delta: number | null
          brands_notified: number | null
          hour: string | null
          sent_fail: number | null
          sent_ok: number | null
          users_notified: number | null
        }
        Relationships: []
      }
      v_notification_usage_today: {
        Row: {
          brand_id: string | null
          sent_today: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_rate_limit_pressure: {
        Row: {
          avg_per_user: number | null
          brand_id: string | null
          total_sent_today: number | null
          users_following: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      allow_push_send: {
        Args: { p_brand: string; p_category: string; p_user_id: string }
        Returns: boolean
      }
      brand_events_last_24h: {
        Args: { brand_id_param: string }
        Returns: number
      }
      get_source_credibility: {
        Args: { source_name_param: string }
        Returns: number
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      unlock_stale_jobs: {
        Args: { timeout_seconds: number }
        Returns: number
      }
      upsert_coalesced_job: {
        Args: {
          p_key: string
          p_not_before: string
          p_payload: Json
          p_stage: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      event_category:
        | "labor"
        | "environment"
        | "politics"
        | "social"
        | "cultural-values"
        | "general"
      event_orientation: "positive" | "negative" | "mixed"
      verification_level: "unverified" | "corroborated" | "official"
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
      app_role: ["admin", "user"],
      event_category: [
        "labor",
        "environment",
        "politics",
        "social",
        "cultural-values",
        "general",
      ],
      event_orientation: ["positive", "negative", "mixed"],
      verification_level: ["unverified", "corroborated", "official"],
    },
  },
} as const
