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
        ]
      }
      brand_events: {
        Row: {
          article_text: string | null
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
          article_text?: string | null
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
          article_text?: string | null
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
        ]
      }
      brand_scores: {
        Row: {
          brand_id: string
          breakdown: Json | null
          created_at: string
          id: string
          last_updated: string
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
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          is_test: boolean
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
          is_test?: boolean
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
          is_test?: boolean
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
          archive_url: string | null
          canonical_url: string | null
          created_at: string
          day_bucket: string | null
          domain_kind: string | null
          domain_owner: string | null
          event_id: string
          id: string
          quote: string | null
          registrable_domain: string | null
          source_date: string | null
          source_name: string
          source_url: string | null
          title_fp: string | null
        }
        Insert: {
          archive_url?: string | null
          canonical_url?: string | null
          created_at?: string
          day_bucket?: string | null
          domain_kind?: string | null
          domain_owner?: string | null
          event_id: string
          id?: string
          quote?: string | null
          registrable_domain?: string | null
          source_date?: string | null
          source_name: string
          source_url?: string | null
          title_fp?: string | null
        }
        Update: {
          archive_url?: string | null
          canonical_url?: string | null
          created_at?: string
          day_bucket?: string | null
          domain_kind?: string | null
          domain_owner?: string | null
          event_id?: string
          id?: string
          quote?: string | null
          registrable_domain?: string | null
          source_date?: string | null
          source_name?: string
          source_url?: string | null
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
            referencedRelation: "brand_evidence_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_evidence_view"
            referencedColumns: ["evidence_id"]
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
        ]
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
          exclude_same_parent: boolean
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
          exclude_same_parent?: boolean
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
          exclude_same_parent?: boolean
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
      brand_evidence_independent: {
        Row: {
          archive_url: string | null
          brand_id: string | null
          category: Database["public"]["Enums"]["event_category"] | null
          domain_kind: string | null
          domain_owner: string | null
          event_id: string | null
          id: string | null
          registrable_domain: string | null
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
            referencedRelation: "brand_evidence_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "brand_evidence_view"
            referencedColumns: ["evidence_id"]
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
          event_id: string | null
          evidence_id: string | null
          score_component: string | null
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
        ]
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
          labor_fatalities_90d: number | null
          labor_fines_90d: number | null
          labor_sentiment_90d: number | null
          labor_violations_90d: number | null
          pol_dem_donations_90d: number | null
          pol_donations_90d: number | null
          pol_rep_donations_90d: number | null
          social_lawsuits_90d: number | null
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
        ]
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
          avg_per_user: number | null
          brand_id: string | null
          total_sent_today: number | null
          users_following: number | null
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
      search_brands_fuzzy: {
        Args: { min_similarity?: number; search_term: string }
        Returns: {
          id: string
          name: string
          parent_company: string
          similarity: number
        }[]
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
      verification_rank: {
        Args: { v: string }
        Returns: number
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
