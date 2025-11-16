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
      admin_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          logs: string | null
          meta: Json | null
          page: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          logs?: string | null
          meta?: Json | null
          page: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          logs?: string | null
          meta?: Json | null
          page?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          created_at: string | null
          endpoint: string
          geo_price_usd: number | null
          id: string
          report_price_usd: number | null
          report_tier: string | null
          request_params: Json | null
          total_cost_usd: number
          translator_log_id: string
          unit_price_usd: number
          used_geo_lookup: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          geo_price_usd?: number | null
          id?: string
          report_price_usd?: number | null
          report_tier?: string | null
          request_params?: Json | null
          total_cost_usd: number
          translator_log_id: string
          unit_price_usd: number
          used_geo_lookup?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          geo_price_usd?: number | null
          id?: string
          report_price_usd?: number | null
          report_tier?: string | null
          request_params?: Json | null
          total_cost_usd?: number
          translator_log_id?: string
          unit_price_usd?: number
          used_geo_lookup?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_translator_log_id_fkey"
            columns: ["translator_log_id"]
            isOneToOne: false
            referencedRelation: "translator_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string | null
          avg_read_time_minutes: number | null
          content: string
          content_type: string | null
          conversion_count: number | null
          cover_image_url: string | null
          created_at: string | null
          cta_link: string | null
          cta_text: string | null
          cta_type: string | null
          featured: boolean | null
          id: string
          like_count: number | null
          meta_description: string | null
          meta_keywords: string[] | null
          published: boolean | null
          related_posts: string[] | null
          share_count: number | null
          slug: string
          tags: string[] | null
          title: string
          view_count: number | null
        }
        Insert: {
          author_name?: string | null
          avg_read_time_minutes?: number | null
          content: string
          content_type?: string | null
          conversion_count?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          cta_type?: string | null
          featured?: boolean | null
          id?: string
          like_count?: number | null
          meta_description?: string | null
          meta_keywords?: string[] | null
          published?: boolean | null
          related_posts?: string[] | null
          share_count?: number | null
          slug: string
          tags?: string[] | null
          title: string
          view_count?: number | null
        }
        Update: {
          author_name?: string | null
          avg_read_time_minutes?: number | null
          content?: string
          content_type?: string | null
          conversion_count?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          cta_type?: string | null
          featured?: boolean | null
          id?: string
          like_count?: number | null
          meta_description?: string | null
          meta_keywords?: string[] | null
          published?: boolean | null
          related_posts?: string[] | null
          share_count?: number | null
          slug?: string
          tags?: string[] | null
          title?: string
          view_count?: number | null
        }
        Relationships: []
      }
      calendar_sessions: {
        Row: {
          client_id: string | null
          coach_id: string
          color_tag: string | null
          created_at: string | null
          description: string | null
          end_time: string
          event_type: string | null
          id: string
          start_time: string
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          coach_id: string
          color_tag?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          event_type?: string | null
          id?: string
          start_time: string
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          coach_id?: string
          color_tag?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_type?: string | null
          id?: string
          start_time?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cascade_deletion_log: {
        Row: {
          deleted_at: string | null
          id: string
          parent_id: string
          parent_table: string
          record_id: string
          table_name: string
        }
        Insert: {
          deleted_at?: string | null
          id?: string
          parent_id: string
          parent_table: string
          record_id: string
          table_name: string
        }
        Update: {
          deleted_at?: string | null
          id?: string
          parent_id?: string
          parent_table?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      chat_folder_participants: {
        Row: {
          folder_id: string
          invited_by: string | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          folder_id: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          folder_id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_folder_participants_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "chat_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_folders: {
        Row: {
          created_at: string | null
          has_profile_setup: boolean | null
          id: string
          is_public: boolean | null
          name: string
          profile_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          has_profile_setup?: boolean | null
          id?: string
          is_public?: boolean | null
          name: string
          profile_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          has_profile_setup?: boolean | null
          id?: string
          is_public?: boolean | null
          name?: string
          profile_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_folders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profile_list"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_activity: {
        Row: {
          buffer_processing_scheduled: boolean | null
          conversation_id: string
          created_at: string | null
          inactivity_threshold_minutes: number | null
          last_activity_at: string | null
          last_assistant_message_at: string | null
          last_buffer_processed_at: string | null
          last_user_message_at: string | null
          pending_buffer_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          buffer_processing_scheduled?: boolean | null
          conversation_id: string
          created_at?: string | null
          inactivity_threshold_minutes?: number | null
          last_activity_at?: string | null
          last_assistant_message_at?: string | null
          last_buffer_processed_at?: string | null
          last_user_message_at?: string | null
          pending_buffer_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          buffer_processing_scheduled?: boolean | null
          conversation_id?: string
          created_at?: string | null
          inactivity_threshold_minutes?: number | null
          last_activity_at?: string | null
          last_assistant_message_at?: string | null
          last_buffer_processed_at?: string | null
          last_user_message_at?: string | null
          pending_buffer_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_activity_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_caches: {
        Row: {
          cache_name: string
          chat_id: string
          created_at: string | null
          expires_at: string
          system_data_hash: string
        }
        Insert: {
          cache_name: string
          chat_id: string
          created_at?: string | null
          expires_at: string
          system_data_hash: string
        }
        Update: {
          cache_name?: string
          chat_id?: string
          created_at?: string | null
          expires_at?: string
          system_data_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_caches_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          message_count: number
          summary_text: string
          turn_range: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          message_count: number
          summary_text: string
          turn_range: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          message_count?: number
          summary_text?: string
          turn_range?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          folder_id: string | null
          id: string
          is_public: boolean | null
          last_summary_at_turn: number | null
          meta: Json | null
          mode: string | null
          owner_user_id: string | null
          profile_id: string | null
          title: string | null
          turn_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          is_public?: boolean | null
          last_summary_at_turn?: number | null
          meta?: Json | null
          mode?: string | null
          owner_user_id?: string | null
          profile_id?: string | null
          title?: string | null
          turn_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          is_public?: boolean | null
          last_summary_at_turn?: number | null
          meta?: Json | null
          mode?: string | null
          owner_user_id?: string | null
          profile_id?: string | null
          title?: string | null
          turn_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "chat_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profile_list"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations_participants: {
        Row: {
          conversation_id: string
          invited_by: string | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount_usd: number | null
          created_at: string | null
          credits: number
          description: string | null
          endpoint: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_usd?: number | null
          created_at?: string | null
          credits: number
          description?: string | null
          endpoint?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_usd?: number | null
          created_at?: string | null
          credits?: number
          description?: string | null
          endpoint?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      debug_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          inserted_at: string | null
          label: string | null
          message: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          inserted_at?: string | null
          label?: string | null
          message?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          inserted_at?: string | null
          label?: string | null
          message?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      domain_slugs: {
        Row: {
          admin: boolean | null
          billing: boolean | null
          contact: boolean | null
          created_at: string | null
          dev: boolean | null
          domain: string
          hello: boolean | null
          help: boolean | null
          hr: boolean | null
          id: string
          info: boolean | null
          legal: boolean | null
          marketing: boolean | null
          media: boolean | null
          noreply: boolean | null
          support: boolean | null
        }
        Insert: {
          admin?: boolean | null
          billing?: boolean | null
          contact?: boolean | null
          created_at?: string | null
          dev?: boolean | null
          domain: string
          hello?: boolean | null
          help?: boolean | null
          hr?: boolean | null
          id?: string
          info?: boolean | null
          legal?: boolean | null
          marketing?: boolean | null
          media?: boolean | null
          noreply?: boolean | null
          support?: boolean | null
        }
        Update: {
          admin?: boolean | null
          billing?: boolean | null
          contact?: boolean | null
          created_at?: string | null
          dev?: boolean | null
          domain?: string
          hello?: boolean | null
          help?: boolean | null
          hr?: boolean | null
          id?: string
          info?: boolean | null
          legal?: boolean | null
          marketing?: boolean | null
          media?: boolean | null
          noreply?: boolean | null
          support?: boolean | null
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          attachment_count: number | null
          attachments: Json | null
          body: string | null
          created_at: string | null
          direction: string
          from_address: string
          has_attachments: boolean | null
          id: string
          is_archived: boolean
          is_read: boolean
          is_starred: boolean
          raw_headers: string | null
          sent_via: string | null
          subject: string | null
          to_address: string
        }
        Insert: {
          attachment_count?: number | null
          attachments?: Json | null
          body?: string | null
          created_at?: string | null
          direction: string
          from_address: string
          has_attachments?: boolean | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          is_starred?: boolean
          raw_headers?: string | null
          sent_via?: string | null
          subject?: string | null
          to_address: string
        }
        Update: {
          attachment_count?: number | null
          attachments?: Json | null
          body?: string | null
          created_at?: string | null
          direction?: string
          from_address?: string
          has_attachments?: boolean | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          is_starred?: boolean
          raw_headers?: string | null
          sent_via?: string | null
          subject?: string | null
          to_address?: string
        }
        Relationships: []
      }
      email_notification_templates: {
        Row: {
          body_html: string
          body_text: string
          created_at: string
          id: string
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text: string
          created_at?: string
          id?: string
          subject: string
          template_type: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string
          created_at?: string
          id?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      feature_usage: {
        Row: {
          chat_messages: number | null
          created_at: string | null
          id: string
          images_generated: number | null
          insights_count: number
          last_reset_date: string
          therai_calls: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_messages?: number | null
          created_at?: string | null
          id?: string
          images_generated?: number | null
          insights_count?: number
          last_reset_date?: string
          therai_calls?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_messages?: number | null
          created_at?: string | null
          id?: string
          images_generated?: number | null
          insights_count?: number
          last_reset_date?: string
          therai_calls?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      folder_documents: {
        Row: {
          content_text: string | null
          created_at: string
          error_message: string | null
          file_extension: string
          file_name: string
          file_path: string | null
          file_size: number
          file_type: string
          folder_id: string
          id: string
          metadata: Json | null
          updated_at: string
          upload_status: string
          user_id: string
        }
        Insert: {
          content_text?: string | null
          created_at?: string
          error_message?: string | null
          file_extension: string
          file_name: string
          file_path?: string | null
          file_size: number
          file_type: string
          folder_id: string
          id?: string
          metadata?: Json | null
          updated_at?: string
          upload_status?: string
          user_id: string
        }
        Update: {
          content_text?: string | null
          created_at?: string
          error_message?: string | null
          file_extension?: string
          file_name?: string
          file_path?: string | null
          file_size?: number
          file_type?: string
          folder_id?: string
          id?: string
          metadata?: Json | null
          updated_at?: string
          upload_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "chat_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_cache: {
        Row: {
          lat: number
          lon: number
          place: string | null
          place_id: string
          updated_at: string | null
        }
        Insert: {
          lat: number
          lon: number
          place?: string | null
          place_id: string
          updated_at?: string | null
        }
        Update: {
          lat?: number
          lon?: number
          place?: string | null
          place_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      insights: {
        Row: {
          completed_at: string | null
          created_at: string | null
          folder_id: string | null
          id: string
          is_ready: boolean | null
          metadata: Json | null
          report_type: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          folder_id?: string | null
          id?: string
          is_ready?: boolean | null
          metadata?: Json | null
          report_type: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          folder_id?: string | null
          id?: string
          is_ready?: boolean | null
          metadata?: Json | null
          report_type?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "chat_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_allowlist: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          ip_address: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          client_id: string
          created_at: string
          entry_text: string
          folder_id: string | null
          id: string
          linked_report_id: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          entry_text: string
          folder_id?: string | null
          id?: string
          linked_report_id?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          entry_text?: string
          folder_id?: string | null
          id?: string
          linked_report_id?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "chat_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_config: {
        Row: {
          created_at: string
          feature_images: Json
          features_images: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_images?: Json
          features_images?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_images?: Json
          features_images?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          content: string
          document_type: string
          id: string
          is_current: boolean
          published_date: string
          title: string
          version: string
        }
        Insert: {
          content: string
          document_type: string
          id?: string
          is_current?: boolean
          published_date?: string
          title: string
          version: string
        }
        Update: {
          content?: string
          document_type?: string
          id?: string
          is_current?: boolean
          published_date?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          archived_at: string | null
          chat_id: string
          client_msg_id: string | null
          context_injected: boolean | null
          created_at: string
          id: string
          message_number: number
          meta: Json
          mode: string | null
          role: string
          status: string | null
          text: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          archived_at?: string | null
          chat_id: string
          client_msg_id?: string | null
          context_injected?: boolean | null
          created_at?: string
          id?: string
          message_number?: number
          meta?: Json
          mode?: string | null
          role: string
          status?: string | null
          text?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          archived_at?: string | null
          chat_id?: string
          client_msg_id?: string | null
          context_injected?: boolean | null
          created_at?: string
          id?: string
          message_number?: number
          meta?: Json
          mode?: string | null
          role?: string
          status?: string | null
          text?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: []
      }
      payment_method: {
        Row: {
          active: boolean | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_name: string | null
          card_brand: string | null
          card_last4: string | null
          city: string | null
          country: string | null
          email: string | null
          exp_month: number | null
          exp_year: number | null
          fingerprint: string | null
          id: number
          invoice_history: Json
          last_charge_at: string | null
          last_charge_status: string | null
          last_invoice_amount_cents: number | null
          last_invoice_currency: string | null
          last_invoice_id: string | null
          last_invoice_number: string | null
          last_receipt_url: string | null
          next_billing_at: string | null
          payment_method_type: string | null
          payment_status: string | null
          postal_code: string | null
          state: string | null
          status_changed_at: string | null
          status_reason: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_pid: string | null
          ts: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_name?: string | null
          card_brand?: string | null
          card_last4?: string | null
          city?: string | null
          country?: string | null
          email?: string | null
          exp_month?: number | null
          exp_year?: number | null
          fingerprint?: string | null
          id?: number
          invoice_history?: Json
          last_charge_at?: string | null
          last_charge_status?: string | null
          last_invoice_amount_cents?: number | null
          last_invoice_currency?: string | null
          last_invoice_id?: string | null
          last_invoice_number?: string | null
          last_receipt_url?: string | null
          next_billing_at?: string | null
          payment_method_type?: string | null
          payment_status?: string | null
          postal_code?: string | null
          state?: string | null
          status_changed_at?: string | null
          status_reason?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_pid?: string | null
          ts?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_name?: string | null
          card_brand?: string | null
          card_last4?: string | null
          city?: string | null
          country?: string | null
          email?: string | null
          exp_month?: number | null
          exp_year?: number | null
          fingerprint?: string | null
          id?: number
          invoice_history?: Json
          last_charge_at?: string | null
          last_charge_status?: string | null
          last_invoice_amount_cents?: number | null
          last_invoice_currency?: string | null
          last_invoice_id?: string | null
          last_invoice_number?: string | null
          last_receipt_url?: string | null
          next_billing_at?: string | null
          payment_method_type?: string | null
          payment_status?: string | null
          postal_code?: string | null
          state?: string | null
          status_changed_at?: string | null
          status_reason?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_pid?: string | null
          ts?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          chat_messages_daily_limit: number | null
          created_at: string | null
          display_order: number | null
          has_early_access: boolean | null
          has_image_generation: boolean | null
          has_priority_support: boolean | null
          has_together_mode: boolean | null
          has_voice_mode: boolean | null
          id: string
          image_generation_daily_limit: number | null
          insights_limit: number | null
          is_active: boolean | null
          plan_id: string
          plan_name: string
          therai_calls_limit: number | null
          updated_at: string | null
          voice_seconds_limit: number | null
        }
        Insert: {
          chat_messages_daily_limit?: number | null
          created_at?: string | null
          display_order?: number | null
          has_early_access?: boolean | null
          has_image_generation?: boolean | null
          has_priority_support?: boolean | null
          has_together_mode?: boolean | null
          has_voice_mode?: boolean | null
          id?: string
          image_generation_daily_limit?: number | null
          insights_limit?: number | null
          is_active?: boolean | null
          plan_id: string
          plan_name: string
          therai_calls_limit?: number | null
          updated_at?: string | null
          voice_seconds_limit?: number | null
        }
        Update: {
          chat_messages_daily_limit?: number | null
          created_at?: string | null
          display_order?: number | null
          has_early_access?: boolean | null
          has_image_generation?: boolean | null
          has_priority_support?: boolean | null
          has_together_mode?: boolean | null
          has_voice_mode?: boolean | null
          id?: string
          image_generation_daily_limit?: number | null
          insights_limit?: number | null
          is_active?: boolean | null
          plan_id?: string
          plan_name?: string
          therai_calls_limit?: number | null
          updated_at?: string | null
          voice_seconds_limit?: number | null
        }
        Relationships: []
      }
      price_list: {
        Row: {
          created_at: string | null
          description: string | null
          endpoint: string | null
          id: string
          is_ai: string | null
          name: string
          product_code: string | null
          report_type: string | null
          stripe_price_id: string | null
          unit_price_usd: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          endpoint?: string | null
          id: string
          is_ai?: string | null
          name: string
          product_code?: string | null
          report_type?: string | null
          stripe_price_id?: string | null
          unit_price_usd: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          endpoint?: string | null
          id?: string
          is_ai?: string | null
          name?: string
          product_code?: string | null
          report_type?: string | null
          stripe_price_id?: string | null
          unit_price_usd?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ab_test_group: string | null
          created_at: string
          display_name: string | null
          email: string | null
          email_verified: boolean | null
          features: Json | null
          has_profile_setup: boolean
          has_seen_subscription_page: boolean
          id: string
          last_invoice_id: string | null
          last_payment_status: string | null
          last_seen_at: string | null
          last_share_reward_date: string | null
          metadata: Json | null
          onboarding_modal_closed: boolean | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_active: boolean | null
          subscription_end_date: string | null
          subscription_next_charge: string | null
          subscription_plan: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          trial_end_date: string | null
          updated_at: string | null
          verification_token: string | null
        }
        Insert: {
          ab_test_group?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified?: boolean | null
          features?: Json | null
          has_profile_setup?: boolean
          has_seen_subscription_page?: boolean
          id: string
          last_invoice_id?: string | null
          last_payment_status?: string | null
          last_seen_at?: string | null
          last_share_reward_date?: string | null
          metadata?: Json | null
          onboarding_modal_closed?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_active?: boolean | null
          subscription_end_date?: string | null
          subscription_next_charge?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          updated_at?: string | null
          verification_token?: string | null
        }
        Update: {
          ab_test_group?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified?: boolean | null
          features?: Json | null
          has_profile_setup?: boolean
          has_seen_subscription_page?: boolean
          id?: string
          last_invoice_id?: string | null
          last_payment_status?: string | null
          last_seen_at?: string | null
          last_share_reward_date?: string | null
          metadata?: Json | null
          onboarding_modal_closed?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_active?: boolean | null
          subscription_end_date?: string | null
          subscription_next_charge?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          updated_at?: string | null
          verification_token?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          discount_percent: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          times_used: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          discount_percent: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          times_used?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          times_used?: number | null
        }
        Relationships: []
      }
      report_logs: {
        Row: {
          chat_id: string | null
          created_at: string | null
          duration_ms: number | null
          endpoint: string | null
          engine_used: string | null
          error_message: string | null
          has_error: boolean
          id: string
          is_guest: boolean | null
          metadata: Json | null
          report_text: string | null
          report_type: string | null
          status: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          engine_used?: string | null
          error_message?: string | null
          has_error?: boolean
          id?: string
          is_guest?: boolean | null
          metadata?: Json | null
          report_text?: string | null
          report_type?: string | null
          status?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          engine_used?: string | null
          error_message?: string | null
          has_error?: boolean
          id?: string
          is_guest?: boolean | null
          metadata?: Json | null
          report_text?: string | null
          report_type?: string | null
          status?: string | null
        }
        Relationships: []
      }
      report_prompts: {
        Row: {
          created_at: string | null
          id: string
          name: string
          system_prompt: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          system_prompt: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          system_prompt?: string
        }
        Relationships: []
      }
      stripe_products: {
        Row: {
          active: boolean | null
          amount_usd: number
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          name: string
          price_id: string
          product_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          amount_usd: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          name: string
          price_id: string
          product_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          amount_usd?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          name?: string
          price_id?: string
          product_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          stripe_customer_id: string | null
          stripe_event_id: string
          stripe_event_type: string
          stripe_kind: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          stripe_customer_id?: string | null
          stripe_event_id: string
          stripe_event_type: string
          stripe_kind: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          stripe_customer_id?: string | null
          stripe_event_id?: string
          stripe_event_type?: string
          stripe_kind?: string
        }
        Relationships: []
      }
      swissdebuglogs: {
        Row: {
          api_key: string | null
          balance_usd: number | null
          id: number
          request_payload: Json | null
          request_type: string | null
          response_status: number | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          api_key?: string | null
          balance_usd?: number | null
          id?: number
          request_payload?: Json | null
          request_type?: string | null
          response_status?: number | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          api_key?: string | null
          balance_usd?: number | null
          id?: number
          request_payload?: Json | null
          request_type?: string | null
          response_status?: number | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          category: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          prompt_text: string
          subcategory: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          prompt_text: string
          subcategory: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          prompt_text?: string
          subcategory?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      temp_audio: {
        Row: {
          audio_data: string
          chat_id: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          audio_data: string
          chat_id: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_data?: string
          chat_id?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      temp_report_data: {
        Row: {
          chat_hash: string | null
          created_at: string | null
          expires_at: string | null
          guest_report_id: string | null
          id: string
          last_save_attempt_at: string | null
          metadata: Json | null
          plain_token: string | null
          report_content: string | null
          swiss_data: Json | null
          swiss_data_save_attempts: number | null
          swiss_data_save_pending: boolean | null
          swiss_data_saved: boolean | null
          token_hash: string | null
        }
        Insert: {
          chat_hash?: string | null
          created_at?: string | null
          expires_at?: string | null
          guest_report_id?: string | null
          id?: string
          last_save_attempt_at?: string | null
          metadata?: Json | null
          plain_token?: string | null
          report_content?: string | null
          swiss_data?: Json | null
          swiss_data_save_attempts?: number | null
          swiss_data_save_pending?: boolean | null
          swiss_data_saved?: boolean | null
          token_hash?: string | null
        }
        Update: {
          chat_hash?: string | null
          created_at?: string | null
          expires_at?: string | null
          guest_report_id?: string | null
          id?: string
          last_save_attempt_at?: string | null
          metadata?: Json | null
          plain_token?: string | null
          report_content?: string | null
          swiss_data?: Json | null
          swiss_data_save_attempts?: number | null
          swiss_data_save_pending?: boolean | null
          swiss_data_saved?: boolean | null
          token_hash?: string | null
        }
        Relationships: []
      }
      token_emails: {
        Row: {
          body_html: string
          body_text: string
          created_at: string | null
          id: string
          subject: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          body_html: string
          body_text: string
          created_at?: string | null
          id?: string
          subject: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string
          body_text?: string
          created_at?: string | null
          id?: string
          subject?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      topup_logs: {
        Row: {
          amount_cents: number
          created_at: string | null
          credited: boolean | null
          credits: number | null
          id: string
          is_auto_topup: boolean | null
          receipt_url: string | null
          status: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          credited?: boolean | null
          credits?: number | null
          id?: string
          is_auto_topup?: boolean | null
          receipt_url?: string | null
          status: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          credited?: boolean | null
          credits?: number | null
          id?: string
          is_auto_topup?: boolean | null
          receipt_url?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      topup_queue: {
        Row: {
          amount_usd: number
          id: string
          message: string | null
          processed_at: string | null
          requested_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount_usd: number
          id?: string
          message?: string | null
          processed_at?: string | null
          requested_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount_usd?: number
          id?: string
          message?: string | null
          processed_at?: string | null
          requested_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      translator_logs: {
        Row: {
          chat_id: string | null
          created_at: string | null
          error_message: string | null
          google_geo: boolean | null
          id: string
          is_archived: boolean
          is_guest: boolean
          processing_time_ms: number | null
          report_tier: string | null
          request_payload: Json | null
          request_type: string | null
          response_status: number | null
          swiss_data: Json | null
          swiss_error: boolean | null
          translator_payload: Json | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          error_message?: string | null
          google_geo?: boolean | null
          id?: string
          is_archived?: boolean
          is_guest?: boolean
          processing_time_ms?: number | null
          report_tier?: string | null
          request_payload?: Json | null
          request_type?: string | null
          response_status?: number | null
          swiss_data?: Json | null
          swiss_error?: boolean | null
          translator_payload?: Json | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          error_message?: string | null
          google_geo?: boolean | null
          id?: string
          is_archived?: boolean
          is_guest?: boolean
          processing_time_ms?: number | null
          report_tier?: string | null
          request_payload?: Json | null
          request_type?: string | null
          response_status?: number | null
          swiss_data?: Json | null
          swiss_error?: boolean | null
          translator_payload?: Json | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          auto_topup_amount: number | null
          auto_topup_enabled: boolean | null
          auto_topup_threshold: number | null
          created_at: string | null
          credits: number
          last_updated: string | null
          user_id: string
        }
        Insert: {
          auto_topup_amount?: number | null
          auto_topup_enabled?: boolean | null
          auto_topup_threshold?: number | null
          created_at?: string | null
          credits?: number
          last_updated?: string | null
          user_id: string
        }
        Update: {
          auto_topup_amount?: number | null
          auto_topup_enabled?: boolean | null
          auto_topup_threshold?: number | null
          created_at?: string | null
          credits?: number
          last_updated?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_errors: {
        Row: {
          case_number: string
          created_at: string
          email: string
          error_message: string | null
          error_type: string
          guest_report_id: string | null
          id: string
          metadata: Json | null
          price_paid: number | null
          resolved: boolean
          resolved_at: string | null
        }
        Insert: {
          case_number?: string
          created_at?: string
          email: string
          error_message?: string | null
          error_type?: string
          guest_report_id?: string | null
          id?: string
          metadata?: Json | null
          price_paid?: number | null
          resolved?: boolean
          resolved_at?: string | null
        }
        Update: {
          case_number?: string
          created_at?: string
          email?: string
          error_message?: string | null
          error_type?: string
          guest_report_id?: string | null
          id?: string
          metadata?: Json | null
          price_paid?: number | null
          resolved?: boolean
          resolved_at?: string | null
        }
        Relationships: []
      }
      user_images: {
        Row: {
          chat_id: string | null
          created_at: string
          id: string
          image_path: string | null
          image_url: string
          message_id: string | null
          model: string | null
          prompt: string | null
          size: string | null
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          image_url: string
          message_id?: string | null
          model?: string | null
          prompt?: string | null
          size?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          image_url?: string
          message_id?: string | null
          model?: string | null
          prompt?: string | null
          size?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_images_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_images_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory: {
        Row: {
          astrological_context: Json | null
          canonical_hash: string | null
          confidence_score: number | null
          conversation_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          last_referenced_at: string | null
          memory_metadata: Json | null
          memory_text: string
          memory_tier: string | null
          memory_type: Database["public"]["Enums"]["memory_type"]
          origin_mode: string | null
          profile_id: string
          promoted_from_buffer_id: string | null
          reference_count: number | null
          source_message_id: string | null
          turn_index: number | null
          user_id: string
        }
        Insert: {
          astrological_context?: Json | null
          canonical_hash?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          last_referenced_at?: string | null
          memory_metadata?: Json | null
          memory_text: string
          memory_tier?: string | null
          memory_type: Database["public"]["Enums"]["memory_type"]
          origin_mode?: string | null
          profile_id: string
          promoted_from_buffer_id?: string | null
          reference_count?: number | null
          source_message_id?: string | null
          turn_index?: number | null
          user_id: string
        }
        Update: {
          astrological_context?: Json | null
          canonical_hash?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          last_referenced_at?: string | null
          memory_metadata?: Json | null
          memory_text?: string
          memory_tier?: string | null
          memory_type?: Database["public"]["Enums"]["memory_type"]
          origin_mode?: string | null
          profile_id?: string
          promoted_from_buffer_id?: string | null
          reference_count?: number | null
          source_message_id?: string | null
          turn_index?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memory_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profile_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memory_promoted_from_buffer_id_fkey"
            columns: ["promoted_from_buffer_id"]
            isOneToOne: false
            referencedRelation: "user_memory_buffer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memory_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory_buffer: {
        Row: {
          confidence_score: number | null
          conversation_id: string
          created_at: string | null
          extraction_metadata: Json | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          observation_text: string
          observation_type: string
          profile_id: string
          related_buffer_ids: string[] | null
          source_message_id: string
          status: string | null
          time_horizon: string | null
          turns_observed: number | null
          updated_at: string | null
          user_id: string
          value_score: number | null
        }
        Insert: {
          confidence_score?: number | null
          conversation_id: string
          created_at?: string | null
          extraction_metadata?: Json | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          observation_text: string
          observation_type: string
          profile_id: string
          related_buffer_ids?: string[] | null
          source_message_id: string
          status?: string | null
          time_horizon?: string | null
          turns_observed?: number | null
          updated_at?: string | null
          user_id: string
          value_score?: number | null
        }
        Update: {
          confidence_score?: number | null
          conversation_id?: string
          created_at?: string | null
          extraction_metadata?: Json | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          observation_text?: string
          observation_type?: string
          profile_id?: string
          related_buffer_ids?: string[] | null
          source_message_id?: string
          status?: string | null
          time_horizon?: string | null
          turns_observed?: number | null
          updated_at?: string | null
          user_id?: string
          value_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_buffer_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memory_buffer_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profile_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memory_buffer_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory_monthly_summaries: {
        Row: {
          cognitive_summary: string | null
          conversation_count: number | null
          created_at: string | null
          dominant_transits: Json | null
          emotional_summary: string
          id: string
          key_themes: string[] | null
          month: number
          planetary_influences: Json | null
          profile_id: string
          user_id: string
          weekly_summaries_used: number | null
          year: number
        }
        Insert: {
          cognitive_summary?: string | null
          conversation_count?: number | null
          created_at?: string | null
          dominant_transits?: Json | null
          emotional_summary: string
          id?: string
          key_themes?: string[] | null
          month: number
          planetary_influences?: Json | null
          profile_id: string
          user_id: string
          weekly_summaries_used?: number | null
          year: number
        }
        Update: {
          cognitive_summary?: string | null
          conversation_count?: number | null
          created_at?: string | null
          dominant_transits?: Json | null
          emotional_summary?: string
          id?: string
          key_themes?: string[] | null
          month?: number
          planetary_influences?: Json | null
          profile_id?: string
          user_id?: string
          weekly_summaries_used?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_monthly_summaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profile_list"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory_weekly_summaries: {
        Row: {
          conversation_count: number | null
          created_at: string | null
          dominant_patterns: string[] | null
          emotional_summary: string
          id: string
          key_themes: string[] | null
          profile_id: string
          user_id: string
          week_end_date: string
          week_number: number
          week_start_date: string
          year: number
        }
        Insert: {
          conversation_count?: number | null
          created_at?: string | null
          dominant_patterns?: string[] | null
          emotional_summary: string
          id?: string
          key_themes?: string[] | null
          profile_id: string
          user_id: string
          week_end_date: string
          week_number: number
          week_start_date: string
          year: number
        }
        Update: {
          conversation_count?: number | null
          created_at?: string | null
          dominant_patterns?: string[] | null
          emotional_summary?: string
          id?: string
          key_themes?: string[] | null
          profile_id?: string
          user_id?: string
          week_end_date?: string
          week_number?: number
          week_start_date?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_weekly_summaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profile_list"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          client_view_mode: string | null
          created_at: string
          email_notifications_enabled: boolean | null
          id: string
          tts_voice: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_view_mode?: string | null
          created_at?: string
          email_notifications_enabled?: boolean | null
          id?: string
          tts_voice?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_view_mode?: string | null
          created_at?: string
          email_notifications_enabled?: boolean | null
          id?: string
          tts_voice?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profile_list: {
        Row: {
          birth_date: string
          birth_latitude: number | null
          birth_location: string
          birth_longitude: number | null
          birth_place_id: string | null
          birth_time: string
          created_at: string
          house_system: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          profile_name: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date: string
          birth_latitude?: number | null
          birth_location: string
          birth_longitude?: number | null
          birth_place_id?: string | null
          birth_time: string
          created_at?: string
          house_system?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          profile_name: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string
          birth_latitude?: number | null
          birth_location?: string
          birth_longitude?: number | null
          birth_place_id?: string | null
          birth_time?: string
          created_at?: string
          house_system?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          profile_name?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_usage: {
        Row: {
          billing_cycle_end: string
          billing_cycle_start: string
          created_at: string | null
          seconds_used: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_cycle_end: string
          billing_cycle_start: string
          created_at?: string | null
          seconds_used?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string | null
          seconds_used?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      web_leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          lead_type: string
          message: string | null
          name: string | null
          newsletter_opt_in: boolean | null
          page_path: string | null
          phone: string | null
          role: string | null
          source: string | null
          status: string | null
          utm_campaign: string | null
          utm_medium: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          lead_type: string
          message?: string | null
          name?: string | null
          newsletter_opt_in?: boolean | null
          page_path?: string | null
          phone?: string | null
          role?: string | null
          source?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          lead_type?: string
          message?: string | null
          name?: string | null
          newsletter_opt_in?: boolean | null
          page_path?: string | null
          phone?: string | null
          role?: string | null
          source?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
        }
        Relationships: []
      }
      website_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          preview_image_url: string | null
          template_data: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          preview_image_url?: string | null
          template_data: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          preview_image_url?: string | null
          template_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      message_archival_stats: {
        Row: {
          active_messages: number | null
          archived_messages: number | null
          conversations_with_archived: number | null
          latest_archive_date: string | null
          oldest_archive_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_credits: {
        Args: {
          _amount_usd: number
          _credits: number
          _description?: string
          _reference_id?: string
          _type?: string
          _user_id: string
        }
        Returns: boolean
      }
      archive_old_messages: {
        Args: never
        Returns: {
          archived_count: number
          conversation_count: number
        }[]
      }
      assign_ab_test_group: { Args: never; Returns: string }
      bytea_to_text: { Args: { data: string }; Returns: string }
      check_and_increment_insights_count: {
        Args: {
          p_count: number
          p_limit: number
          p_period: string
          p_user_id: string
        }
        Returns: Json
      }
      check_and_increment_therai_calls: {
        Args: {
          p_calls: number
          p_limit: number
          p_period: string
          p_user_id: string
        }
        Returns: Json
      }
      check_and_increment_voice_seconds: {
        Args: {
          p_limit: number
          p_period: string
          p_seconds: number
          p_user_id: string
        }
        Returns: Json
      }
      check_feature_limit: {
        Args: {
          p_feature_type: string
          p_period?: string
          p_requested_amount?: number
          p_user_id: string
        }
        Returns: Json
      }
      check_orphaned_data: {
        Args: never
        Returns: {
          orphaned_count: number
          table_name: string
          total_size_estimate: string
        }[]
      }
      check_user_admin_role: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      check_voice_limit: {
        Args: { p_requested_seconds?: number; p_user_id: string }
        Returns: Json
      }
      clean_completed_topups: { Args: never; Returns: undefined }
      clean_edge_function_logs: { Args: never; Returns: undefined }
      clean_old_webhook_events: { Args: never; Returns: undefined }
      create_user_after_payment: {
        Args: { plan_type?: string; user_id: string }
        Returns: undefined
      }
      deduct_credits: {
        Args: {
          _credits: number
          _description?: string
          _endpoint: string
          _reference_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      delete_user_account: {
        Args: { user_id_to_delete: string }
        Returns: undefined
      }
      ensure_profile_for_current_user: { Args: never; Returns: undefined }
      generate_api_key: { Args: never; Returns: string }
      get_all_users_admin: {
        Args: never
        Returns: {
          balance_usd: number
          created_at: string
          email: string
          email_confirmed_at: string
          last_sign_in_at: string
          role: string
          user_id: string
        }[]
      }
      get_config: { Args: { config_key: string }; Returns: string }
      get_conversations_needing_buffer_processing: {
        Args: { inactivity_minutes?: number }
        Returns: {
          conversation_id: string
          minutes_since_activity: number
          pending_count: number
          user_id: string
        }[]
      }
      get_current_billing_cycle: {
        Args: { p_user_id: string }
        Returns: {
          cycle_end: string
          cycle_start: string
        }[]
      }
      get_flow_status: {
        Args: { user_email: string }
        Returns: {
          created_at: string
          flow_state: string
          session_id: string
          updated_at: string
        }[]
      }
      get_next_engine_sequence: { Args: never; Returns: number }
      get_stripe_customer_id_for_user: {
        Args: { user_id_param: string }
        Returns: {
          stripe_customer_id: string
          stripe_payment_method_id: string
        }[]
      }
      get_user_email_by_id: { Args: { user_id_param: string }; Returns: string }
      get_user_limits: { Args: { p_user_id: string }; Returns: Json }
      hard_delete_archived_messages: {
        Args: { months_old?: number }
        Returns: number
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      increment_chat_messages:
        | {
            Args: { p_count: number; p_period: string; p_user_id: string }
            Returns: undefined
          }
        | { Args: { p_count: number; p_user_id: string }; Returns: undefined }
      increment_feature_usage: {
        Args: {
          p_amount: number
          p_feature_type: string
          p_period: string
          p_user_id: string
        }
        Returns: undefined
      }
      increment_images_generated:
        | {
            Args: { p_count: number; p_period: string; p_user_id: string }
            Returns: undefined
          }
        | { Args: { p_count: number; p_user_id: string }; Returns: undefined }
      increment_insights_count:
        | { Args: { p_count: number; p_user_id: string }; Returns: undefined }
        | {
            Args: { p_count: number; p_period: string; p_user_id: string }
            Returns: undefined
          }
      increment_therai_calls:
        | { Args: { p_calls: number; p_user_id: string }; Returns: undefined }
        | {
            Args: { p_calls: number; p_period: string; p_user_id: string }
            Returns: undefined
          }
      increment_voice_seconds: {
        Args: { p_period: string; p_seconds: number; p_user_id: string }
        Returns: undefined
      }
      increment_voice_usage: {
        Args: { p_seconds: number; p_user_id: string }
        Returns: undefined
      }
      is_user_in_trial: { Args: { p_user_id: string }; Returns: boolean }
      is_user_verified: { Args: { _user_id?: string }; Returns: boolean }
      list_folder_journals: {
        Args: { p_folder_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          client_id: string
          created_at: string
          entry_text: string
          folder_id: string
          folder_name: string
          id: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      mark_profile_verified: { Args: { user_id?: string }; Returns: boolean }
      recent_user_documents: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          file_extension: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          folder_id: string
          folder_name: string
          id: string
          upload_status: string
          user_id: string
        }[]
      }
      rpc_notify_orchestrator: {
        Args: { guest_report_id: string }
        Returns: undefined
      }
      search_folder_documents: {
        Args: {
          p_folder_id: string
          p_limit?: number
          p_offset?: number
          p_q?: string
        }
        Returns: {
          created_at: string
          error_message: string
          file_extension: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          folder_id: string
          folder_name: string
          id: string
          metadata: Json
          updated_at: string
          upload_status: string
          user_id: string
        }[]
      }
      send_notification_email: {
        Args: {
          recipient_email: string
          template_type: string
          variables?: Json
        }
        Returns: boolean
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      toggle_addon: {
        Args: { addon_name: string; enabled: boolean; user_id_param: string }
        Returns: undefined
      }
      update_auto_topup_settings: {
        Args: {
          _amount: number
          _enabled: boolean
          _threshold: number
          _user_id: string
        }
        Returns: boolean
      }
      upgrade_plan: {
        Args: { new_plan: string; user_id_param: string }
        Returns: undefined
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      user_owns_insight: { Args: { report_id: string }; Returns: boolean }
    }
    Enums: {
      memory_type: "fact" | "emotion" | "goal" | "pattern" | "relationship"
      queue_status: "pending" | "processing" | "completed" | "failed"
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
      memory_type: ["fact", "emotion", "goal", "pattern", "relationship"],
      queue_status: ["pending", "processing", "completed", "failed"],
      user_role: ["admin", "user"],
    },
  },
} as const
