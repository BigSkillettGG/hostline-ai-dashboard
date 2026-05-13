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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_configs: {
        Row: {
          after_hours_behavior: string
          answer_after_rings: number
          answer_faqs_enabled: boolean
          call_handling_mode: Database["public"]["Enums"]["call_handling_mode"]
          disclosure_enabled: boolean
          escalation_phone_number: string | null
          greeting_template: string
          host_name: string
          id: string
          location_id: string
          order_destinations: Json
          orders_enabled: boolean
          payment_mode: string
          reservation_mode: string
          reservation_provider: string
          reservations_enabled: boolean
          sms_confirmations_enabled: boolean
          staff_escalation_enabled: boolean
          tone: string
          updated_at: string
        }
        Insert: {
          after_hours_behavior?: string
          answer_after_rings?: number
          answer_faqs_enabled?: boolean
          call_handling_mode?: Database["public"]["Enums"]["call_handling_mode"]
          disclosure_enabled?: boolean
          escalation_phone_number?: string | null
          greeting_template: string
          host_name: string
          id?: string
          location_id: string
          order_destinations?: Json
          orders_enabled?: boolean
          payment_mode?: string
          reservation_mode?: string
          reservation_provider?: string
          reservations_enabled?: boolean
          sms_confirmations_enabled?: boolean
          staff_escalation_enabled?: boolean
          tone?: string
          updated_at?: string
        }
        Update: {
          after_hours_behavior?: string
          answer_after_rings?: number
          answer_faqs_enabled?: boolean
          call_handling_mode?: Database["public"]["Enums"]["call_handling_mode"]
          disclosure_enabled?: boolean
          escalation_phone_number?: string | null
          greeting_template?: string
          host_name?: string
          id?: string
          location_id?: string
          order_destinations?: Json
          orders_enabled?: boolean
          payment_mode?: string
          reservation_mode?: string
          reservation_provider?: string
          reservations_enabled?: boolean
          sms_confirmations_enabled?: boolean
          staff_escalation_enabled?: boolean
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_configs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_routing_configs: {
        Row: {
          config: Json
          id: string
          location_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          location_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_routing_configs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_live_settings: {
        Row: {
          active_mode: string
          location_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_mode?: string
          location_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_mode?: string
          location_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_live_settings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_live_updates: {
        Row: {
          body: string
          cleared_at: string | null
          created_at: string
          created_by: string | null
          expiration: string
          expires_at: string | null
          id: string
          location_id: string
          mode: string | null
          source: string
          title: string
          update_type: string
        }
        Insert: {
          body: string
          cleared_at?: string | null
          created_at?: string
          created_by?: string | null
          expiration?: string
          expires_at?: string | null
          id?: string
          location_id: string
          mode?: string | null
          source?: string
          title: string
          update_type: string
        }
        Update: {
          body?: string
          cleared_at?: string | null
          created_at?: string
          created_by?: string | null
          expiration?: string
          expires_at?: string | null
          id?: string
          location_id?: string
          mode?: string | null
          source?: string
          title?: string
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_live_updates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_contacts: {
        Row: {
          can_receive_alerts: boolean
          can_use_owner_assistant: boolean
          contact_type: string
          created_at: string
          email: string | null
          id: string
          location_id: string
          name: string
          phone: string | null
          preferred_channel: string
          updated_at: string
        }
        Insert: {
          can_receive_alerts?: boolean
          can_use_owner_assistant?: boolean
          contact_type?: string
          created_at?: string
          email?: string | null
          id?: string
          location_id: string
          name: string
          phone?: string | null
          preferred_channel?: string
          updated_at?: string
        }
        Update: {
          can_receive_alerts?: boolean
          can_use_owner_assistant?: boolean
          contact_type?: string
          created_at?: string
          email?: string | null
          id?: string
          location_id?: string
          name?: string
          phone?: string | null
          preferred_channel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_contacts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_reports: {
        Row: {
          copy_text: string
          created_at: string
          delivery_channels: Json
          error_message: string | null
          follow_ups: Json
          generated_at: string
          id: string
          location_id: string
          metrics: Json
          owner_message: string
          period_end: string
          period_start: string
          report_type: string
          sent_at: string | null
          status: string
          suggested_updates: Json
          title: string
          totals: Json
        }
        Insert: {
          copy_text: string
          created_at?: string
          delivery_channels?: Json
          error_message?: string | null
          follow_ups?: Json
          generated_at?: string
          id?: string
          location_id: string
          metrics?: Json
          owner_message: string
          period_end: string
          period_start: string
          report_type?: string
          sent_at?: string | null
          status?: string
          suggested_updates?: Json
          title: string
          totals?: Json
        }
        Update: {
          copy_text?: string
          created_at?: string
          delivery_channels?: Json
          error_message?: string | null
          follow_ups?: Json
          generated_at?: string
          id?: string
          location_id?: string
          metrics?: Json
          owner_message?: string
          period_end?: string
          period_start?: string
          report_type?: string
          sent_at?: string | null
          status?: string
          suggested_updates?: Json
          title?: string
          totals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "owner_reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_feedback: {
        Row: {
          add_to_knowledge: boolean
          call_id: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          note: string | null
          suggested_answer: string | null
        }
        Insert: {
          add_to_knowledge?: boolean
          call_id: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          note?: string | null
          suggested_answer?: string | null
        }
        Update: {
          add_to_knowledge?: boolean
          call_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          note?: string | null
          suggested_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_feedback_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_feedback_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          caller_name: string | null
          caller_phone: string | null
          confidence: number
          created_at: string
          duration_seconds: number
          external_call_sid: string | null
          external_session_id: string | null
          id: string
          intent: Database["public"]["Enums"]["call_intent"]
          location_id: string
          outcome: string
          recording_url: string | null
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          summary: string | null
          twilio_payload: Json
        }
        Insert: {
          caller_name?: string | null
          caller_phone?: string | null
          confidence?: number
          created_at?: string
          duration_seconds?: number
          external_call_sid?: string | null
          external_session_id?: string | null
          id?: string
          intent?: Database["public"]["Enums"]["call_intent"]
          location_id: string
          outcome?: string
          recording_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          summary?: string | null
          twilio_payload?: Json
        }
        Update: {
          caller_name?: string | null
          caller_phone?: string | null
          confidence?: number
          created_at?: string
          duration_seconds?: number
          external_call_sid?: string | null
          external_session_id?: string | null
          id?: string
          intent?: Database["public"]["Enums"]["call_intent"]
          location_id?: string
          outcome?: string
          recording_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          summary?: string | null
          twilio_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "calls_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requests: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          details: Json
          id: string
          knowledge_suggestion_id: string | null
          location_id: string
          priority: string
          request_type: string
          responded_at: string | null
          response_channel: string | null
          response_status: string
          response_text: string | null
          source: string
          source_call_id: string | null
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          details?: Json
          id?: string
          knowledge_suggestion_id?: string | null
          location_id: string
          priority?: string
          request_type?: string
          responded_at?: string | null
          response_channel?: string | null
          response_status?: string
          response_text?: string | null
          source?: string
          source_call_id?: string | null
          status?: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          details?: Json
          id?: string
          knowledge_suggestion_id?: string | null
          location_id?: string
          priority?: string
          request_type?: string
          responded_at?: string | null
          response_channel?: string | null
          response_status?: string
          response_text?: string | null
          source?: string
          source_call_id?: string | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requests_knowledge_suggestion_id_fkey"
            columns: ["knowledge_suggestion_id"]
            isOneToOne: false
            referencedRelation: "knowledge_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requests_source_call_id_fkey"
            columns: ["source_call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          id: string
          is_active: boolean
          location_id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          id?: string
          is_active?: boolean
          location_id: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          id?: string
          is_active?: boolean
          location_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faqs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json
          job_type: string
          location_id: string
          result: Json
          source_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          job_type?: string
          location_id: string
          result?: Json
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          job_type?: string
          location_id?: string
          result?: Json
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "menu_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          category: string
          id: string
          location_id: string
          metadata: Json
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          category: string
          id?: string
          location_id: string
          metadata?: Json
          provider: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          category?: string
          id?: string
          location_id?: string
          metadata?: Json
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sections: {
        Row: {
          body: string
          id: string
          is_active: boolean
          location_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          is_active?: boolean
          location_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          is_active?: boolean
          location_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_suggestions: {
        Row: {
          applied_knowledge_section_id: string | null
          body: string
          call_id: string | null
          created_at: string
          created_by: string | null
          feedback_id: string | null
          id: string
          location_id: string
          priority: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          source_question: string | null
          status: string
          suggested_answer: string | null
          title: string
        }
        Insert: {
          applied_knowledge_section_id?: string | null
          body: string
          call_id?: string | null
          created_at?: string
          created_by?: string | null
          feedback_id?: string | null
          id?: string
          location_id: string
          priority?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_question?: string | null
          status?: string
          suggested_answer?: string | null
          title: string
        }
        Update: {
          applied_knowledge_section_id?: string | null
          body?: string
          call_id?: string | null
          created_at?: string
          created_by?: string | null
          feedback_id?: string | null
          id?: string
          location_id?: string
          priority?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_question?: string | null
          status?: string
          suggested_answer?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_suggestions_applied_knowledge_section_id_fkey"
            columns: ["applied_knowledge_section_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_suggestions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_suggestions_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "call_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_suggestions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          ai_host_phone: string | null
          created_at: string
          cuisine: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          timezone: string
        }
        Insert: {
          address?: string | null
          ai_host_phone?: string | null
          created_at?: string
          cuisine?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          timezone?: string
        }
        Update: {
          address?: string | null
          ai_host_phone?: string | null
          created_at?: string
          cuisine?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          id: string
          location_id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          location_id: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          location_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available: boolean
          category_id: string
          description: string | null
          id: string
          modifiers: Json
          name: string
          prep_minutes: number
          price_cents: number
          updated_at: string
          upsell_suggestions: Json
        }
        Insert: {
          available?: boolean
          category_id: string
          description?: string | null
          id?: string
          modifiers?: Json
          name: string
          prep_minutes?: number
          price_cents: number
          updated_at?: string
          upsell_suggestions?: Json
        }
        Update: {
          available?: boolean
          category_id?: string
          description?: string | null
          id?: string
          modifiers?: Json
          name?: string
          prep_minutes?: number
          price_cents?: number
          updated_at?: string
          upsell_suggestions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_sources: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          label: string | null
          last_error: string | null
          last_synced_at: string | null
          location_id: string
          metadata: Json
          source_type: string
          status: string
          sync_frequency: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          location_id: string
          metadata?: Json
          source_type?: string
          status?: string
          sync_frequency?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          location_id?: string
          metadata?: Json
          source_type?: string
          status?: string
          sync_frequency?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_sources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_profiles: {
        Row: {
          completed_required: number
          draft: Json
          id: string
          location_id: string
          progress_percent: number
          status: string
          total_required: number
          updated_at: string
        }
        Insert: {
          completed_required?: number
          draft?: Json
          id?: string
          location_id: string
          progress_percent?: number
          status?: string
          total_required?: number
          updated_at?: string
        }
        Update: {
          completed_required?: number
          draft?: Json
          id?: string
          location_id?: string
          progress_percent?: number
          status?: string
          total_required?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery_attempts: {
        Row: {
          created_at: string
          delivered_at: string | null
          destination: string
          error_message: string | null
          id: string
          order_id: string
          payload: Json
          status: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          destination: string
          error_message?: string | null
          id?: string
          order_id: string
          payload?: Json
          status?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          destination?: string
          error_message?: string | null
          id?: string
          order_id?: string
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          menu_item_id: string | null
          modifiers: Json
          name: string
          notes: string | null
          order_id: string
          price_cents: number
          quantity: number
        }
        Insert: {
          id?: string
          menu_item_id?: string | null
          modifiers?: Json
          name: string
          notes?: string | null
          order_id: string
          price_cents: number
          quantity?: number
        }
        Update: {
          id?: string
          menu_item_id?: string | null
          modifiers?: Json
          name?: string
          notes?: string | null
          order_id?: string
          price_cents?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string | null
          destination: string
          eta_minutes: number
          id: string
          location_id: string
          notes: string | null
          payment_mode: string
          source_call_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          destination?: string
          eta_minutes?: number
          id?: string
          location_id: string
          notes?: string | null
          payment_mode?: string
          source_call_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          destination?: string
          eta_minutes?: number
          id?: string
          location_id?: string
          notes?: string | null
          payment_mode?: string
          source_call_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_source_call_id_fkey"
            columns: ["source_call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      phone_numbers: {
        Row: {
          capabilities: Json
          created_at: string
          forwarding_mode: string
          forwarding_status: string
          id: string
          last_verified_at: string | null
          location_id: string
          phone_number: string
          provider: string
          provider_sid: string | null
          restaurant_main_line: string | null
          status: string
          updated_at: string
          verification_results: Json
          voice_webhook_url: string | null
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          forwarding_mode?: string
          forwarding_status?: string
          id?: string
          last_verified_at?: string | null
          location_id: string
          phone_number: string
          provider?: string
          provider_sid?: string | null
          restaurant_main_line?: string | null
          status?: string
          updated_at?: string
          verification_results?: Json
          voice_webhook_url?: string | null
        }
        Update: {
          capabilities?: Json
          created_at?: string
          forwarding_mode?: string
          forwarding_status?: string
          id?: string
          last_verified_at?: string | null
          location_id?: string
          phone_number?: string
          provider?: string
          provider_sid?: string | null
          restaurant_main_line?: string | null
          status?: string
          updated_at?: string
          verification_results?: Json
          voice_webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          guest_name: string
          guest_phone: string | null
          id: string
          location_id: string
          manual_request: boolean
          notes: string | null
          party_size: number
          provider: string | null
          provider_reservation_id: string | null
          reservation_date: string
          reservation_time: string
          source: string
          source_call_id: string | null
          status: Database["public"]["Enums"]["reservation_status"]
        }
        Insert: {
          created_at?: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          location_id: string
          manual_request?: boolean
          notes?: string | null
          party_size: number
          provider?: string | null
          provider_reservation_id?: string | null
          reservation_date: string
          reservation_time: string
          source?: string
          source_call_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
        }
        Update: {
          created_at?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          location_id?: string
          manual_request?: boolean
          notes?: string | null
          party_size?: number
          provider?: string | null
          provider_reservation_id?: string | null
          reservation_date?: string
          reservation_time?: string
          source?: string
          source_call_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_source_call_id_fkey"
            columns: ["source_call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_alert_events: {
        Row: {
          call_id: string | null
          caller_phone: string | null
          channels: Json
          created_at: string
          error_message: string | null
          id: string
          kind: string
          location_id: string
          message: string
          recipients: Json
          route_snapshot: Json
          sent_at: string | null
          severity: string
          status: string
          summary: string
        }
        Insert: {
          call_id?: string | null
          caller_phone?: string | null
          channels?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          kind: string
          location_id: string
          message: string
          recipients?: Json
          route_snapshot?: Json
          sent_at?: string | null
          severity?: string
          status?: string
          summary: string
        }
        Update: {
          call_id?: string | null
          caller_phone?: string | null
          channels?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          location_id?: string
          message?: string
          recipients?: Json
          route_snapshot?: Json
          sent_at?: string | null
          severity?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_alert_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_alert_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_tasks: {
        Row: {
          assigned_to: string | null
          body: string | null
          call_id: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          location_id: string
          order_id: string | null
          priority: string
          reservation_id: string | null
          status: string
          task_type: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          body?: string | null
          call_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          location_id: string
          order_id?: string | null
          priority?: string
          reservation_id?: string | null
          status?: string
          task_type?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          body?: string | null
          call_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          location_id?: string
          order_id?: string | null
          priority?: string
          reservation_id?: string | null
          status?: string
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_tasks_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          status: string
          token_hash: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role: string
          status?: string
          token_hash?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          status?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_turns: {
        Row: {
          call_id: string
          created_at: string
          id: string
          offset_seconds: number
          speaker: string
          text: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          offset_seconds?: number
          speaker: string
          text: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          offset_seconds?: number
          speaker?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_turns_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memberships: {
        Row: {
          created_at: string
          id: string
          member_email: string | null
          member_name: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_email?: string | null
          member_name?: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_email?: string | null
          member_name?: string | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      call_location_id: { Args: { target_call_id: string }; Returns: string }
      can_access_location: {
        Args: { target_location_id: string }
        Returns: boolean
      }
      can_access_organization: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      can_manage_location: {
        Args: { target_location_id: string }
        Returns: boolean
      }
      can_manage_organization: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      can_operate_location: {
        Args: { target_location_id: string }
        Returns: boolean
      }
      can_operate_organization: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      location_organization_id: {
        Args: { target_location_id: string }
        Returns: string
      }
      menu_category_location_id: {
        Args: { target_category_id: string }
        Returns: string
      }
      order_location_id: { Args: { target_order_id: string }; Returns: string }
      organization_role: {
        Args: { target_organization_id: string }
        Returns: string
      }
    }
    Enums: {
      call_handling_mode:
        | "answer_immediately"
        | "answer_after_rings"
        | "after_hours_only"
        | "manually_enabled"
      call_intent: "order" | "reservation" | "faq" | "hours" | "other"
      call_status: "new" | "reviewed" | "needs_review" | "resolved"
      integration_status: "not_connected" | "connected" | "needs_attention"
      order_status:
        | "new"
        | "accepted"
        | "in_progress"
        | "completed"
        | "canceled"
      reservation_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "seated"
        | "canceled"
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
      call_handling_mode: [
        "answer_immediately",
        "answer_after_rings",
        "after_hours_only",
        "manually_enabled",
      ],
      call_intent: ["order", "reservation", "faq", "hours", "other"],
      call_status: ["new", "reviewed", "needs_review", "resolved"],
      integration_status: ["not_connected", "connected", "needs_attention"],
      order_status: ["new", "accepted", "in_progress", "completed", "canceled"],
      reservation_status: [
        "pending",
        "confirmed",
        "declined",
        "seated",
        "canceled",
      ],
    },
  },
} as const
