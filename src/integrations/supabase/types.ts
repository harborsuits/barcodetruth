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
      _secrets_internal: {
        Row: {
          key: string
          val: string
        }
        Insert: {
          key: string
          val: string
        }
        Update: {
          key?: string
          val?: string
        }
        Relationships: []
      }
      api_error_log: {
        Row: {
          id: number
          message: string | null
          occurred_at: string
          source: string
          status: number | null
        }
        Insert: {
          id?: number
          message?: string | null
          occurred_at?: string
          source: string
          status?: number | null
        }
        Update: {
          id?: number
          message?: string | null
          occurred_at?: string
          source?: string
          status?: number | null
        }
        Relationships: []
      }
      api_rate_config: {
        Row: {
          limit_per_window: number
          source: string
          window_kind: string
        }
        Insert: {
          limit_per_window: number
          source: string
          window_kind: string
        }
        Update: {
          limit_per_window?: number
          source?: string
          window_kind?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          call_count: number
          source: string
          updated_at: string
          window_start: string
        }
        Insert: {
          call_count?: number
          source: string
          updated_at?: string
          window_start: string
        }
        Update: {
          call_count?: number
          source?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
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
      article_brand_matches: {
        Row: {
          brand_id: string
          confidence: number
          decided: boolean
          decided_at: string | null
          id: string
          item_id: string
          method: string
        }
        Insert: {
          brand_id: string
          confidence: number
          decided?: boolean
          decided_at?: string | null
          id?: string
          item_id: string
          method: string
        }
        Update: {
          brand_id?: string
          confidence?: number
          decided?: boolean
          decided_at?: string | null
          id?: string
          item_id?: string
          method?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_brand_matches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "article_brand_matches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_brand_matches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "article_brand_matches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_brand_matches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "article_brand_matches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "article_brand_matches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_brand_matches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "rss_items"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_aliases_canonical_brand_id_fkey"
            columns: ["canonical_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_aliases_canonical_brand_id_fkey"
            columns: ["canonical_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_aliases_canonical_brand_id_fkey"
            columns: ["canonical_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_aliases_canonical_brand_id_fkey"
            columns: ["canonical_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_aliases_canonical_brand_id_fkey"
            columns: ["canonical_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_aliases_canonical_brand_id_fkey"
            columns: ["canonical_brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_api_usage: {
        Row: {
          brand_id: string
          calls_today: number
          last_call_at: string | null
          updated_at: string
          window_start: string
        }
        Insert: {
          brand_id: string
          calls_today?: number
          last_call_at?: string | null
          updated_at?: string
          window_start?: string
        }
        Update: {
          brand_id?: string
          calls_today?: number
          last_call_at?: string | null
          updated_at?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_api_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_api_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_api_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_api_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_api_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_api_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_api_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_baselines: {
        Row: {
          articles_analyzed: number
          articles_per_week: number
          avg_sources_per_article: number
          baseline_complete: boolean
          baseline_environment: number
          baseline_labor: number
          baseline_politics: number
          baseline_social: number
          brand_id: string
          common_categories: Json
          created_at: string
          environment_frequency: number
          labor_frequency: number
          median_sentiment: number
          politics_frequency: number
          scan_completed_at: string | null
          scan_started_at: string | null
          social_frequency: number
          unique_domains: number
          updated_at: string
        }
        Insert: {
          articles_analyzed?: number
          articles_per_week?: number
          avg_sources_per_article?: number
          baseline_complete?: boolean
          baseline_environment?: number
          baseline_labor?: number
          baseline_politics?: number
          baseline_social?: number
          brand_id: string
          common_categories?: Json
          created_at?: string
          environment_frequency?: number
          labor_frequency?: number
          median_sentiment?: number
          politics_frequency?: number
          scan_completed_at?: string | null
          scan_started_at?: string | null
          social_frequency?: number
          unique_domains?: number
          updated_at?: string
        }
        Update: {
          articles_analyzed?: number
          articles_per_week?: number
          avg_sources_per_article?: number
          baseline_complete?: boolean
          baseline_environment?: number
          baseline_labor?: number
          baseline_politics?: number
          baseline_social?: number
          brand_id?: string
          common_categories?: Json
          created_at?: string
          environment_frequency?: number
          labor_frequency?: number
          median_sentiment?: number
          politics_frequency?: number
          scan_completed_at?: string | null
          scan_started_at?: string | null
          social_frequency?: number
          unique_domains?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_baselines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_baselines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_baselines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_baselines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_baselines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_baselines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_baselines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_data_mappings: {
        Row: {
          brand_id: string
          created_at: string
          external_id: string | null
          id: string
          label: string | null
          query: string | null
          source: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          label?: string | null
          query?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          label?: string | null
          query?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_data_mappings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_data_mappings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_data_mappings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_data_mappings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_data_mappings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_data_mappings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_data_mappings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_events: {
        Row: {
          ai_model_version: string | null
          ai_summary: string | null
          article_text: string | null
          brand_id: string
          category: Database["public"]["Enums"]["event_category"]
          category_code: string | null
          category_confidence: number | null
          category_score: number | null
          company_response_date: string | null
          company_response_summary: string | null
          company_response_url: string | null
          created_at: string
          description: string
          disambiguation_reason: string | null
          event_date: string | null
          event_id: string
          impact_confidence: number | null
          impact_environment: number | null
          impact_labor: number | null
          impact_politics: number | null
          impact_social: number | null
          is_irrelevant: boolean | null
          is_press_release: boolean | null
          is_test: boolean
          jurisdiction: string | null
          noise_reason: string | null
          occurred_at: string | null
          orientation: Database["public"]["Enums"]["event_orientation"] | null
          raw_data: Json | null
          relevance_reason: string | null
          relevance_score_norm: number | null
          relevance_score_raw: number
          resolved: boolean | null
          secondary_categories: string[] | null
          severity: string | null
          source_url: string | null
          source_url_sha256: string | null
          title: string | null
          updated_at: string
          verification: Database["public"]["Enums"]["verification_level"] | null
          verified: boolean | null
        }
        Insert: {
          ai_model_version?: string | null
          ai_summary?: string | null
          article_text?: string | null
          brand_id: string
          category?: Database["public"]["Enums"]["event_category"]
          category_code?: string | null
          category_confidence?: number | null
          category_score?: number | null
          company_response_date?: string | null
          company_response_summary?: string | null
          company_response_url?: string | null
          created_at?: string
          description: string
          disambiguation_reason?: string | null
          event_date?: string | null
          event_id?: string
          impact_confidence?: number | null
          impact_environment?: number | null
          impact_labor?: number | null
          impact_politics?: number | null
          impact_social?: number | null
          is_irrelevant?: boolean | null
          is_press_release?: boolean | null
          is_test?: boolean
          jurisdiction?: string | null
          noise_reason?: string | null
          occurred_at?: string | null
          orientation?: Database["public"]["Enums"]["event_orientation"] | null
          raw_data?: Json | null
          relevance_reason?: string | null
          relevance_score_norm?: number | null
          relevance_score_raw?: number
          resolved?: boolean | null
          secondary_categories?: string[] | null
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
          ai_model_version?: string | null
          ai_summary?: string | null
          article_text?: string | null
          brand_id?: string
          category?: Database["public"]["Enums"]["event_category"]
          category_code?: string | null
          category_confidence?: number | null
          category_score?: number | null
          company_response_date?: string | null
          company_response_summary?: string | null
          company_response_url?: string | null
          created_at?: string
          description?: string
          disambiguation_reason?: string | null
          event_date?: string | null
          event_id?: string
          impact_confidence?: number | null
          impact_environment?: number | null
          impact_labor?: number | null
          impact_politics?: number | null
          impact_social?: number | null
          is_irrelevant?: boolean | null
          is_press_release?: boolean | null
          is_test?: boolean
          jurisdiction?: string | null
          noise_reason?: string | null
          occurred_at?: string | null
          orientation?: Database["public"]["Enums"]["event_orientation"] | null
          raw_data?: Json | null
          relevance_reason?: string | null
          relevance_score_norm?: number | null
          relevance_score_raw?: number
          resolved?: boolean | null
          secondary_categories?: string[] | null
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
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_feature_flags: {
        Row: {
          brand_id: string
          enabled: boolean
          key: string
        }
        Insert: {
          brand_id: string
          enabled?: boolean
          key: string
        }
        Update: {
          brand_id?: string
          enabled?: boolean
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_feature_flags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_feature_flags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_feature_flags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_feature_flags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_feature_flags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_feature_flags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_feature_flags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
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
          relationship_type: Database["public"]["Enums"]["ownership_relation"]
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
          relationship_type: Database["public"]["Enums"]["ownership_relation"]
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
          relationship_type?: Database["public"]["Enums"]["ownership_relation"]
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_ownerships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_ownerships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ownerships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_ownerships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ownerships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_ownerships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_ownerships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ownerships_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_ownerships_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ownerships_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_ownerships_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ownerships_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_ownerships_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_ownerships_parent_brand_id_fkey"
            columns: ["parent_brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_scores: {
        Row: {
          brand_id: string
          breakdown: Json | null
          created_at: string
          id: string
          last_updated: string
          reason_json: Json | null
          recomputed_at: string | null
          score: number | null
          score_environment: number
          score_labor: number
          score_politics: number
          score_social: number
          updated_at: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          brand_id: string
          breakdown?: Json | null
          created_at?: string
          id?: string
          last_updated?: string
          reason_json?: Json | null
          recomputed_at?: string | null
          score?: number | null
          score_environment?: number
          score_labor?: number
          score_politics?: number
          score_social?: number
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          brand_id?: string
          breakdown?: Json | null
          created_at?: string
          id?: string
          last_updated?: string
          reason_json?: Json | null
          recomputed_at?: string | null
          score?: number | null
          score_environment?: number
          score_labor?: number
          score_politics?: number
          score_social?: number
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_scores_history: {
        Row: {
          brand_id: string
          recorded_at: string
          score_environment: number
          score_labor: number
          score_politics: number
          score_social: number
        }
        Insert: {
          brand_id: string
          recorded_at?: string
          score_environment: number
          score_labor: number
          score_politics: number
          score_social: number
        }
        Update: {
          brand_id?: string
          recorded_at?: string
          score_environment?: number
          score_labor?: number
          score_politics?: number
          score_social?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_scores_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scores_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scores_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_social_baseline: {
        Row: {
          brand_id: string
          brand_name: string
          doc_count: number
          fetched_at: string
          id: string
          median_tone: number
        }
        Insert: {
          brand_id: string
          brand_name: string
          doc_count: number
          fetched_at?: string
          id?: string
          median_tone: number
        }
        Update: {
          brand_id?: string
          brand_name?: string
          doc_count?: number
          fetched_at?: string
          id?: string
          median_tone?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_social_baseline_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_social_baseline_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_social_baseline_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_social_baseline_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_social_baseline_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_social_baseline_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_social_baseline_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          aliases: string[] | null
          company_size: string | null
          created_at: string
          description: string | null
          description_lang: string | null
          description_source: string | null
          id: string
          ingestion_frequency: string | null
          is_active: boolean | null
          is_test: boolean
          last_ingestion_status: string | null
          last_news_ingestion: string | null
          logo_attribution: string | null
          logo_etag: string | null
          logo_last_checked: string | null
          logo_source: string | null
          logo_url: string | null
          monitoring_config: Json | null
          name: string
          newsroom_domains: string[] | null
          parent_company: string | null
          push_paused: boolean
          ticker: string | null
          updated_at: string
          website: string | null
          wikidata_qid: string | null
        }
        Insert: {
          aliases?: string[] | null
          company_size?: string | null
          created_at?: string
          description?: string | null
          description_lang?: string | null
          description_source?: string | null
          id?: string
          ingestion_frequency?: string | null
          is_active?: boolean | null
          is_test?: boolean
          last_ingestion_status?: string | null
          last_news_ingestion?: string | null
          logo_attribution?: string | null
          logo_etag?: string | null
          logo_last_checked?: string | null
          logo_source?: string | null
          logo_url?: string | null
          monitoring_config?: Json | null
          name: string
          newsroom_domains?: string[] | null
          parent_company?: string | null
          push_paused?: boolean
          ticker?: string | null
          updated_at?: string
          website?: string | null
          wikidata_qid?: string | null
        }
        Update: {
          aliases?: string[] | null
          company_size?: string | null
          created_at?: string
          description?: string | null
          description_lang?: string | null
          description_source?: string | null
          id?: string
          ingestion_frequency?: string | null
          is_active?: boolean | null
          is_test?: boolean
          last_ingestion_status?: string | null
          last_news_ingestion?: string | null
          logo_attribution?: string | null
          logo_etag?: string | null
          logo_last_checked?: string | null
          logo_source?: string | null
          logo_url?: string | null
          monitoring_config?: Json | null
          name?: string
          newsroom_domains?: string[] | null
          parent_company?: string | null
          push_paused?: boolean
          ticker?: string | null
          updated_at?: string
          website?: string | null
          wikidata_qid?: string | null
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          fn: string
          last_run: string
        }
        Insert: {
          fn: string
          last_run?: string
        }
        Update: {
          fn?: string
          last_run?: string
        }
        Relationships: []
      }
      event_rules: {
        Row: {
          category_code: string
          created_at: string
          enabled: boolean
          id: string
          match_type: string
          notes: string | null
          pattern: string
          priority: number
          updated_at: string
        }
        Insert: {
          category_code: string
          created_at?: string
          enabled?: boolean
          id?: string
          match_type: string
          notes?: string | null
          pattern: string
          priority?: number
          updated_at?: string
        }
        Update: {
          category_code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          match_type?: string
          notes?: string | null
          pattern?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_sources: {
        Row: {
          ai_model_version: string | null
          ai_summary: string | null
          ai_summary_updated_at: string | null
          archive_url: string | null
          article_snippet: string | null
          canonical_url: string | null
          canonical_url_hash: string | null
          created_at: string
          credibility_tier: string | null
          day_bucket: string | null
          domain_kind: string | null
          domain_owner: string | null
          event_id: string
          evidence_status: string | null
          id: string
          is_generic: boolean | null
          is_primary: boolean | null
          link_kind: Database["public"]["Enums"]["link_kind"] | null
          owner_domain: string | null
          quote: string | null
          registrable_domain: string | null
          source_date: string | null
          source_name: string
          source_url: string | null
          title: string | null
          title_fp: string | null
        }
        Insert: {
          ai_model_version?: string | null
          ai_summary?: string | null
          ai_summary_updated_at?: string | null
          archive_url?: string | null
          article_snippet?: string | null
          canonical_url?: string | null
          canonical_url_hash?: string | null
          created_at?: string
          credibility_tier?: string | null
          day_bucket?: string | null
          domain_kind?: string | null
          domain_owner?: string | null
          event_id: string
          evidence_status?: string | null
          id?: string
          is_generic?: boolean | null
          is_primary?: boolean | null
          link_kind?: Database["public"]["Enums"]["link_kind"] | null
          owner_domain?: string | null
          quote?: string | null
          registrable_domain?: string | null
          source_date?: string | null
          source_name: string
          source_url?: string | null
          title?: string | null
          title_fp?: string | null
        }
        Update: {
          ai_model_version?: string | null
          ai_summary?: string | null
          ai_summary_updated_at?: string | null
          archive_url?: string | null
          article_snippet?: string | null
          canonical_url?: string | null
          canonical_url_hash?: string | null
          created_at?: string
          credibility_tier?: string | null
          day_bucket?: string | null
          domain_kind?: string | null
          domain_owner?: string | null
          event_id?: string
          evidence_status?: string | null
          id?: string
          is_generic?: boolean | null
          is_primary?: boolean | null
          link_kind?: Database["public"]["Enums"]["link_kind"] | null
          owner_domain?: string | null
          quote?: string | null
          registrable_domain?: string | null
          source_date?: string | null
          source_name?: string
          source_url?: string | null
          title?: string | null
          title_fp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_evidence_view_base"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_latest_verified_event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_feed_grouped"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_profile_feed"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_brand_sources_inline"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_summaries: {
        Row: {
          created_at: string
          event_id: string
          id: string
          summary: Json
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          summary: Json
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          summary?: Json
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_evidence_view_base"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_latest_verified_event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_feed_grouped"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_profile_feed"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_brand_sources_inline"
            referencedColumns: ["event_id"]
          },
        ]
      }
      evidence_resolution_runs: {
        Row: {
          failed: number
          finished_at: string | null
          id: number
          mode: string
          notes: Json | null
          processed: number
          resolved: number
          skipped: number
          started_at: string
        }
        Insert: {
          failed?: number
          finished_at?: string | null
          id?: number
          mode: string
          notes?: Json | null
          processed?: number
          resolved?: number
          skipped?: number
          started_at?: string
        }
        Update: {
          failed?: number
          finished_at?: string | null
          id?: number
          mode?: string
          notes?: Json | null
          processed?: number
          resolved?: number
          skipped?: number
          started_at?: string
        }
        Relationships: []
      }
      fn_call_log: {
        Row: {
          created_at: string
          fn: string
          id: string
          requester_ip: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          fn: string
          id?: string
          requester_ip?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          fn?: string
          id?: string
          requester_ip?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      gs1_prefix_registry: {
        Row: {
          company_name: string
          country: string | null
          created_at: string
          prefix: string
          source: string | null
        }
        Insert: {
          company_name: string
          country?: string | null
          created_at?: string
          prefix: string
          source?: string | null
        }
        Update: {
          company_name?: string
          country?: string | null
          created_at?: string
          prefix?: string
          source?: string | null
        }
        Relationships: []
      }
      job_anomalies: {
        Row: {
          brand_id: string
          category: string
          created_at: string
          delta: number
          id: string
          job_run_id: string
        }
        Insert: {
          brand_id: string
          category: string
          created_at?: string
          delta: number
          id?: string
          job_run_id: string
        }
        Update: {
          brand_id?: string
          category?: string
          created_at?: string
          delta?: number
          id?: string
          job_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_anomalies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "job_anomalies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_anomalies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "job_anomalies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_anomalies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "job_anomalies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "job_anomalies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_anomalies_job_run_id_fkey"
            columns: ["job_run_id"]
            isOneToOne: false
            referencedRelation: "job_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          anomalies_count: number
          details: Json | null
          duration_ms: number | null
          error_count: number
          finished_at: string | null
          id: string
          job_name: string
          mode: string
          started_at: string
          status: string
          success_count: number
          user_id: string | null
        }
        Insert: {
          anomalies_count?: number
          details?: Json | null
          duration_ms?: number | null
          error_count?: number
          finished_at?: string | null
          id?: string
          job_name: string
          mode: string
          started_at?: string
          status?: string
          success_count?: number
          user_id?: string | null
        }
        Update: {
          anomalies_count?: number
          details?: Json | null
          duration_ms?: number | null
          error_count?: number
          finished_at?: string | null
          id?: string
          job_name?: string
          mode?: string
          started_at?: string
          status?: string
          success_count?: number
          user_id?: string | null
        }
        Relationships: []
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
      moderation_config: {
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
      news_orgs: {
        Row: {
          domain: string
          kind: string
          owner: string
          updated_at: string
        }
        Insert: {
          domain: string
          kind?: string
          owner: string
          updated_at?: string
        }
        Update: {
          domain?: string
          kind?: string
          owner?: string
          updated_at?: string
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
          user_id: string
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
          user_id: string
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
          user_id?: string
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
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "pilot_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "pilot_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "pilot_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "pilot_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_queue: {
        Row: {
          brand_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: number
          priority: number
          process_type: string
          scheduled_for: string
          started_at: string | null
          status: string
        }
        Insert: {
          brand_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          priority?: number
          process_type?: string
          scheduled_for?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          brand_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          priority?: number
          process_type?: string
          scheduled_for?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "processing_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "processing_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "processing_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "processing_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      product_claim_votes: {
        Row: {
          claim_id: string
          created_at: string
          user_id: string
          vote: number
        }
        Insert: {
          claim_id: string
          created_at?: string
          user_id: string
          vote: number
        }
        Update: {
          claim_id?: string
          created_at?: string
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_claim_votes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "product_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_claim_votes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "product_claims_moderator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_claim_votes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "product_claims_moderator_base"
            referencedColumns: ["id"]
          },
        ]
      }
      product_claims: {
        Row: {
          barcode_ean13: string
          claimed_brand_id: string
          confidence: number
          created_at: string
          created_by: string | null
          id: string
          moderated_at: string | null
          moderated_by: string | null
          product_name: string | null
          rejection_reason: string | null
          source_hint: string | null
          status: Database["public"]["Enums"]["submission_status"]
        }
        Insert: {
          barcode_ean13: string
          claimed_brand_id: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          product_name?: string | null
          rejection_reason?: string | null
          source_hint?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
        }
        Update: {
          barcode_ean13?: string
          claimed_brand_id?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          product_name?: string | null
          rejection_reason?: string | null
          source_hint?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
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
          upc_type: string | null
          updated_at: string
          valid_checksum: boolean | null
        }
        Insert: {
          barcode: string
          brand_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name: string
          upc_type?: string | null
          updated_at?: string
          valid_checksum?: boolean | null
        }
        Update: {
          barcode?: string
          brand_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          upc_type?: string | null
          updated_at?: string
          valid_checksum?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      push_key_versions: {
        Row: {
          active: boolean
          created_at: string
          enc_key: string
          id: string
          key_alias: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          enc_key: string
          id?: string
          key_alias: string
        }
        Update: {
          active?: boolean
          created_at?: string
          enc_key?: string
          id?: string
          key_alias?: string
        }
        Relationships: []
      }
      rss_feeds: {
        Row: {
          category_hint: string | null
          country: string | null
          created_at: string
          credibility_tier: string
          enabled: boolean
          etag: string | null
          id: string
          language: string | null
          last_fetched_at: string | null
          last_modified: string | null
          parser: string | null
          source_name: string
          updated_at: string
          url: string
        }
        Insert: {
          category_hint?: string | null
          country?: string | null
          created_at?: string
          credibility_tier?: string
          enabled?: boolean
          etag?: string | null
          id?: string
          language?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          parser?: string | null
          source_name: string
          updated_at?: string
          url: string
        }
        Update: {
          category_hint?: string | null
          country?: string | null
          created_at?: string
          credibility_tier?: string
          enabled?: boolean
          etag?: string | null
          id?: string
          language?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          parser?: string | null
          source_name?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      rss_items: {
        Row: {
          created_at: string
          feed_id: string
          id: string
          published_at: string | null
          raw_text: string | null
          status: string
          summary: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          feed_id: string
          id?: string
          published_at?: string | null
          raw_text?: string | null
          status?: string
          summary?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          feed_id?: string
          id?: string
          published_at?: string | null
          raw_text?: string | null
          status?: string
          summary?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rss_items_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "rss_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      score_runs: {
        Row: {
          brands_updated: number
          details: Json | null
          events_count: number
          finished_at: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          brands_updated?: number
          details?: Json | null
          events_count?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          brands_updated?: number
          details?: Json | null
          events_count?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      scoring_caps: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: number
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: number
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      scoring_switches: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      scoring_weights: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: number
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: number
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          accessed_at: string
          accessor_id: string | null
          accessor_role: string
          action: string
          details: Json | null
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          accessed_at?: string
          accessor_id?: string | null
          accessor_role: string
          action: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          accessed_at?: string
          accessor_id?: string | null
          accessor_role?: string
          action?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
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
      stripe_customers: {
        Row: {
          created_at: string
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          received_at: string
        }
        Insert: {
          id: string
          received_at?: string
        }
        Update: {
          id?: string
          received_at?: string
        }
        Relationships: []
      }
      user_billing: {
        Row: {
          current_period_end: string | null
          product_id: string | null
          status: string | null
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          product_id?: string | null
          status?: string | null
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          product_id?: string | null
          status?: string | null
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
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
          exclude_same_parent: boolean
          id: string
          muted_categories: string[]
          notification_mode: string | null
          political_alignment: string | null
          updated_at: string
          user_id: string
          value_weights: Json | null
          w_environment: number | null
          w_labor: number | null
          w_politics: number | null
          w_social: number | null
          w_verified: number | null
        }
        Insert: {
          created_at?: string
          digest_time?: string | null
          exclude_same_parent?: boolean
          id?: string
          muted_categories?: string[]
          notification_mode?: string | null
          political_alignment?: string | null
          updated_at?: string
          user_id: string
          value_weights?: Json | null
          w_environment?: number | null
          w_labor?: number | null
          w_politics?: number | null
          w_social?: number | null
          w_verified?: number | null
        }
        Update: {
          created_at?: string
          digest_time?: string | null
          exclude_same_parent?: boolean
          id?: string
          muted_categories?: string[]
          notification_mode?: string | null
          political_alignment?: string | null
          updated_at?: string
          user_id?: string
          value_weights?: Json | null
          w_environment?: number | null
          w_labor?: number | null
          w_politics?: number | null
          w_social?: number | null
          w_verified?: number | null
        }
        Relationships: []
      }
      user_push_subs: {
        Row: {
          auth_enc: string | null
          auth_enc_b64: string
          created_at: string | null
          endpoint: string
          id: string
          key_alias: string | null
          p256dh_enc: string | null
          p256dh_enc_b64: string
          ua: string | null
          user_id: string
        }
        Insert: {
          auth_enc?: string | null
          auth_enc_b64: string
          created_at?: string | null
          endpoint: string
          id?: string
          key_alias?: string | null
          p256dh_enc?: string | null
          p256dh_enc_b64: string
          ua?: string | null
          user_id: string
        }
        Update: {
          auth_enc?: string | null
          auth_enc_b64?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          key_alias?: string | null
          p256dh_enc?: string | null
          p256dh_enc_b64?: string
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
      user_scans: {
        Row: {
          barcode: string | null
          brand_id: string | null
          created_at: string
          id: string
          scanned_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          scanned_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          scanned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_scans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "user_scans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "user_scans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "user_scans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "user_scans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_audit: {
        Row: {
          created_at: string | null
          event_id: string | null
          from_status: string | null
          id: string
          reason: string | null
          to_status: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "verification_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_evidence_view_base"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "verification_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_latest_verified_event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "verification_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_feed_grouped"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "verification_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_profile_feed"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "verification_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_brand_sources_inline"
            referencedColumns: ["event_id"]
          },
        ]
      }
    }
    Views: {
      brand_data_coverage: {
        Row: {
          brand_id: string | null
          events_30d: number | null
          events_365d: number | null
          events_7d: number | null
          independent_sources: number | null
          last_event_at: string | null
          name: string | null
          parent_company: string | null
          verified_rate: number | null
        }
        Relationships: []
      }
      brand_evidence_independent: {
        Row: {
          archive_url: string | null
          brand_id: string | null
          category: Database["public"]["Enums"]["event_category"] | null
          domain_kind: string | null
          domain_owner: string | null
          event_id: string | null
          id: string | null
          occurred_at: string | null
          registrable_domain: string | null
          snippet: string | null
          source_date: string | null
          source_name: string | null
          source_url: string | null
          title: string | null
          verification: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_evidence_view_base"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_latest_verified_event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_feed_grouped"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_profile_feed"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_brand_sources_inline"
            referencedColumns: ["event_id"]
          },
        ]
      }
      brand_evidence_view: {
        Row: {
          archive_url: string | null
          brand_id: string | null
          category: Database["public"]["Enums"]["event_category"] | null
          domain_kind: string | null
          domain_owner: string | null
          event_id: string | null
          id: string | null
          occurred_at: string | null
          registrable_domain: string | null
          snippet: string | null
          source_date: string | null
          source_name: string | null
          source_url: string | null
          title: string | null
          verification: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_evidence_view_base"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_latest_verified_event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_feed_grouped"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_profile_feed"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_brand_sources_inline"
            referencedColumns: ["event_id"]
          },
        ]
      }
      brand_evidence_view_base: {
        Row: {
          archive_url: string | null
          brand_id: string | null
          category: Database["public"]["Enums"]["event_category"] | null
          event_id: string | null
          evidence_id: string | null
          snippet: string | null
          source_date: string | null
          source_name: string | null
          source_url: string | null
          verification: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_latest_evidence: {
        Row: {
          brand_id: string | null
          event_id: string | null
          source_name: string | null
          title: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_evidence_view_base"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_latest_verified_event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_feed_grouped"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_profile_feed"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_brand_sources_inline"
            referencedColumns: ["event_id"]
          },
        ]
      }
      brand_latest_verified_event: {
        Row: {
          ai_summary_md: string | null
          brand_id: string | null
          event_date: string | null
          event_id: string | null
          verification: Database["public"]["Enums"]["verification_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_score_effective: {
        Row: {
          brand_id: string | null
          events_90d: number | null
          independent_sources: number | null
          last_updated: string | null
          score: number | null
          score_environment: number | null
          score_labor: number | null
          score_politics: number | null
          score_social: number | null
          verified_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_score_movers_24h: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          delta_24h: number | null
          last_updated: string | null
          logo_url: string | null
          score_24h_ago: number | null
          score_now: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_standings: {
        Row: {
          events_30d: number | null
          id: string | null
          last_updated: string | null
          logo_url: string | null
          name: string | null
          parent_company: string | null
          score: number | null
          score_environment: number | null
          score_labor: number | null
          score_politics: number | null
          score_social: number | null
        }
        Relationships: []
      }
      brand_trending: {
        Row: {
          avg_score: number | null
          brand_id: string | null
          event_count_24h: number | null
          events_30d: number | null
          events_7d: number | null
          independent_sources: number | null
          last_event_at: string | null
          logo_url: string | null
          name: string | null
          score: number | null
          trend_score: number | null
          verified_rate: number | null
        }
        Relationships: []
      }
      company_feed_grouped: {
        Row: {
          brand_id: string | null
          category: Database["public"]["Enums"]["event_category"] | null
          category_code: string | null
          created_at: string | null
          description: string | null
          event_date: string | null
          event_id: string | null
          group_name: string | null
          group_order: number | null
          occurred_at: string | null
          orientation: Database["public"]["Enums"]["event_orientation"] | null
          relevance_score_raw: number | null
          severity: string | null
          source_url: string | null
          title: string | null
          updated_at: string | null
          verification: Database["public"]["Enums"]["verification_level"] | null
          verification_rank: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profile_feed: {
        Row: {
          brand_id: string | null
          category: Database["public"]["Enums"]["event_category"] | null
          category_code: string | null
          created_at: string | null
          description: string | null
          event_date: string | null
          event_id: string | null
          occurred_at: string | null
          orientation: Database["public"]["Enums"]["event_orientation"] | null
          relevance_score_raw: number | null
          severity: string | null
          source_url: string | null
          title: string | null
          updated_at: string | null
          verification: Database["public"]["Enums"]["verification_level"] | null
        }
        Insert: {
          brand_id?: string | null
          category?: Database["public"]["Enums"]["event_category"] | null
          category_code?: string | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_id?: string | null
          occurred_at?: string | null
          orientation?: Database["public"]["Enums"]["event_orientation"] | null
          relevance_score_raw?: number | null
          severity?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string | null
          verification?:
            | Database["public"]["Enums"]["verification_level"]
            | null
        }
        Update: {
          brand_id?: string | null
          category?: Database["public"]["Enums"]["event_category"] | null
          category_code?: string | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_id?: string | null
          occurred_at?: string | null
          orientation?: Database["public"]["Enums"]["event_orientation"] | null
          relevance_score_raw?: number | null
          severity?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string | null
          verification?:
            | Database["public"]["Enums"]["verification_level"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_health_24h: {
        Row: {
          bad_verification: number | null
          below_gate: number | null
          category_breakdown: Json | null
          null_category: number | null
          total_24h: number | null
          verification_breakdown: Json | null
        }
        Relationships: []
      }
      product_claims_moderator: {
        Row: {
          barcode_ean13: string | null
          claimed_brand_id: string | null
          confidence: number | null
          created_at: string | null
          created_by: string | null
          downvotes: number | null
          id: string | null
          moderated_at: string | null
          moderated_by: string | null
          product_name: string | null
          rejection_reason: string | null
          score: number | null
          source_hint: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          upvotes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      product_claims_moderator_base: {
        Row: {
          barcode_ean13: string | null
          claimed_brand_id: string | null
          confidence: number | null
          created_at: string | null
          created_by: string | null
          downvotes: number | null
          id: string | null
          moderated_at: string | null
          moderated_by: string | null
          product_name: string | null
          rejection_reason: string | null
          score: number | null
          source_hint: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          upvotes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_claims_claimed_brand_id_fkey"
            columns: ["claimed_brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_baseline_inputs_24m: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          calculated_at: string | null
          distinct_sources_24m: number | null
          env_actions_24m: number | null
          env_certifications: number | null
          env_emissions_percentile: number | null
          env_superfund_active: number | null
          events_last_12m: number | null
          labor_fatalities_24m: number | null
          labor_fines_24m: number | null
          labor_sentiment_24m: number | null
          labor_violations_24m: number | null
          pol_dem_donations_24m: number | null
          pol_donations_24m: number | null
          pol_lobbying_24m: number | null
          pol_rep_donations_24m: number | null
          social_lawsuits_24m: number | null
          social_recalls_class1_24m: number | null
          social_recalls_class2_24m: number | null
          social_recalls_class3_24m: number | null
          social_sentiment_avg: number | null
          total_events_24m: number | null
        }
        Relationships: []
      }
      v_baseline_inputs_90d: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          calculated_at: string | null
          env_actions_90d: number | null
          env_mixed_90d: number | null
          labor_fatalities_90d: number | null
          labor_fines_90d: number | null
          labor_mixed_90d: number | null
          labor_sentiment_90d: number | null
          labor_violations_90d: number | null
          pol_dem_donations_90d: number | null
          pol_donations_90d: number | null
          pol_mixed_90d: number | null
          pol_rep_donations_90d: number | null
          social_lawsuits_90d: number | null
          social_mixed_90d: number | null
          social_recalls_class1_90d: number | null
          social_recalls_class2_90d: number | null
          social_recalls_class3_90d: number | null
          total_events_90d: number | null
        }
        Relationships: []
      }
      v_brand_sources_inline: {
        Row: {
          amount: number | null
          brand_id: string | null
          category: Database["public"]["Enums"]["event_category"] | null
          event_id: string | null
          occurred_at: string | null
          severity: string | null
          source: string | null
          title: string | null
          url: string | null
          verification: Database["public"]["Enums"]["verification_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_data_coverage"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_trending"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_24m"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_baseline_inputs_90d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v_brands_needing_logos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_brands_needing_logos: {
        Row: {
          id: string | null
          name: string | null
          website: string | null
          wikidata_qid: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
          website?: string | null
          wikidata_qid?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          website?: string | null
          wikidata_qid?: string | null
        }
        Relationships: []
      }
      v_category_groups: {
        Row: {
          group_name: string | null
          group_order: number | null
        }
        Relationships: []
      }
      v_category_map: {
        Row: {
          code: string | null
          group_name: string | null
        }
        Relationships: []
      }
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
      v_parent_rollups: {
        Row: {
          child_brands: string[] | null
          child_count: number | null
          parent_conf_env: number | null
          parent_conf_labor: number | null
          parent_conf_pol: number | null
          parent_conf_soc: number | null
          parent_environment: number | null
          parent_id: string | null
          parent_labor: number | null
          parent_politics: number | null
          parent_social: number | null
        }
        Relationships: []
      }
      v_rate_limit_pressure: {
        Row: {
          call_count: number | null
          limit_per_window: number | null
          source: string | null
          usage_percent: number | null
          window_kind: string | null
        }
        Relationships: []
      }
      v_user_preferences_safe: {
        Row: {
          created_at: string | null
          digest_time: string | null
          exclude_same_parent: boolean | null
          muted_categories: string[] | null
          notification_mode: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          digest_time?: string | null
          exclude_same_parent?: boolean | null
          muted_categories?: string[] | null
          notification_mode?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          digest_time?: string | null
          exclude_same_parent?: boolean | null
          muted_categories?: string[] | null
          notification_mode?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_add_evidence: {
        Args:
          | {
              p_brand_id: string
              p_category: string
              p_event_date: string
              p_notes?: string
              p_source_url: string
              p_title: string
              p_verification: string
            }
          | {
              p_brand_id: string
              p_category?: string
              p_notes?: string
              p_occurred_at?: string
              p_title: string
              p_url: string
              p_verification?: string
            }
        Returns: {
          event_id: string
          source_id: string
        }[]
      }
      admin_refresh_coverage: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      allow_push_send: {
        Args: { p_brand: string; p_category: string; p_user_id: string }
        Returns: boolean
      }
      app_brand_alias_candidates: {
        Args: { p_summary: string; p_title: string }
        Returns: {
          brand_id: string
          confidence: number
          method: string
        }[]
      }
      app_brand_trigram_candidates: {
        Args: { p_title: string }
        Returns: {
          brand_id: string
          confidence: number
          method: string
        }[]
      }
      assign_credibility_tier: {
        Args: { domain: string }
        Returns: string
      }
      brand_events_last_24h: {
        Args: { brand_id_param: string }
        Returns: number
      }
      brand_profile_view: {
        Args: { p_brand_id: string }
        Returns: Json
      }
      can_user_scan: {
        Args: { p_user_id: string }
        Returns: Json
      }
      canonicalize_source_url: {
        Args: { p_url: string }
        Returns: {
          canonical_url: string
          domain_owner: string
          source_name: string
        }[]
      }
      check_push_encryption_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          encrypted_count: number
          encryption_complete: boolean
          plaintext_count: number
          total_subs: number
        }[]
      }
      cleanup_old_notification_logs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      compute_brand_score: {
        Args: { p_brand: string }
        Returns: {
          brand_id: string
          score: number
          score_environment: number
          score_labor: number
          score_politics: number
          score_social: number
        }[]
      }
      current_window_start: {
        Args: { p_kind: string }
        Returns: string
      }
      get_brand_data_confidence: {
        Args: { p_brand_id: string }
        Returns: {
          categories_covered: number
          completeness_percent: number
          confidence_level: Database["public"]["Enums"]["data_confidence"]
          has_significant_events: boolean
        }[]
      }
      get_brand_feed_with_subsidiaries: {
        Args: {
          p_brand_id: string
          p_include_subsidiaries?: boolean
          p_limit?: number
        }
        Returns: {
          brand_id: string
          brand_name: string
          category: Database["public"]["Enums"]["event_category"]
          category_code: string
          description: string
          event_date: string
          event_id: string
          is_parent_entity: boolean
          orientation: string
          severity: string
          source_url: string
          title: string
          verification: Database["public"]["Enums"]["verification_level"]
        }[]
      }
      get_brand_rollup_scores: {
        Args: { p_brand_id: string }
        Returns: Json
      }
      get_brands_needing_scores: {
        Args: Record<PropertyKey, never>
        Returns: {
          event_count: number
          id: string
          name: string
        }[]
      }
      get_corroboration_clusters: {
        Args: {
          min_credibility?: number
          min_domains?: number
          window_days?: number
        }
        Returns: {
          avg_cred: number
          brand_id: string
          category: Database["public"]["Enums"]["event_category"]
          day: string
          domain_count: number
          domains: string[]
          event_ids: string[]
          title_fp: string
        }[]
      }
      get_next_brands_fair_rotation: {
        Args: { p_limit?: number }
        Returns: {
          brand_id: string
          brand_name: string
          company_size: string
        }[]
      }
      get_ownership_graph: {
        Args: { p_brand_id: string }
        Returns: Json
      }
      get_source_credibility: {
        Args: { source_name_param: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_brand_api_usage: {
        Args: { p_brand_id: string; p_calls?: number }
        Returns: undefined
      }
      increment_rate_limit: {
        Args: { p_source: string; p_window_start: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_mod_or_admin: {
        Args: { uid: string }
        Returns: boolean
      }
      log_notification: {
        Args: {
          p_brand_id: string
          p_category: string
          p_delta?: number
          p_error?: string
          p_success?: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      log_sensitive_access: {
        Args: {
          p_action: string
          p_details?: Json
          p_record_id?: string
          p_table_name: string
        }
        Returns: undefined
      }
      personalized_brand_score: {
        Args: { p_brand_id: string; p_user_id: string }
        Returns: Json
      }
      reclassify_all_events: {
        Args: Record<PropertyKey, never>
        Returns: {
          financial_count: number
          legal_count: number
          recall_count: number
          regulatory_count: number
          updated_count: number
        }[]
      }
      refresh_brand_coverage: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_coverage_materialized_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      scan_product_lookup: {
        Args: { p_upc: string }
        Returns: {
          brand_id: string
          brand_name: string
          category: string
          events_90d: number
          independent_sources: number
          product_id: string
          product_name: string
          score: number
          score_updated: string
          size: string
          upc: string
          verified_rate: number
        }[]
      }
      search_brands_fuzzy: {
        Args: { min_similarity?: number; search_term: string }
        Returns: {
          id: string
          name: string
          parent_company: string
          similarity: number
        }[]
      }
      search_catalog: {
        Args: { p_limit?: number; p_q: string }
        Returns: Json
      }
      test_article_categorization: {
        Args: {
          p_body: string
          p_domain: string
          p_path: string
          p_title: string
        }
        Returns: {
          category_code: string
          match_type: string
          matched_rule_id: string
          pattern: string
          priority: number
          rule_notes: string
        }[]
      }
      try_spend: {
        Args: { p_cost?: number; p_source: string }
        Returns: boolean
      }
      unlock_stale_jobs: {
        Args: { timeout_seconds: number }
        Returns: number
      }
      upc_check_digit: {
        Args: { barcode: string }
        Returns: string
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
      verification_rank: {
        Args: { v: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
      data_confidence: "none" | "low" | "medium" | "high"
      event_category:
        | "labor"
        | "environment"
        | "politics"
        | "social"
        | "cultural-values"
        | "general"
      event_orientation: "positive" | "negative" | "mixed"
      evidence_status: "pending" | "resolved" | "no_evidence" | "failed"
      link_kind: "article" | "database" | "homepage"
      ownership_relation:
        | "brand_of"
        | "division_of"
        | "subsidiary_of"
        | "acquired_by"
      submission_status: "pending" | "verified" | "rejected"
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
      app_role: ["admin", "user", "moderator"],
      data_confidence: ["none", "low", "medium", "high"],
      event_category: [
        "labor",
        "environment",
        "politics",
        "social",
        "cultural-values",
        "general",
      ],
      event_orientation: ["positive", "negative", "mixed"],
      evidence_status: ["pending", "resolved", "no_evidence", "failed"],
      link_kind: ["article", "database", "homepage"],
      ownership_relation: [
        "brand_of",
        "division_of",
        "subsidiary_of",
        "acquired_by",
      ],
      submission_status: ["pending", "verified", "rejected"],
      verification_level: ["unverified", "corroborated", "official"],
    },
  },
} as const
