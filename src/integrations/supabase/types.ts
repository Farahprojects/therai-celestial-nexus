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
    PostgrestVersion: "12.2.3 (519615d)"
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
          content: string
          cover_image_url: string | null
          created_at: string | null
          id: string
          like_count: number | null
          published: boolean | null
          share_count: number | null
          slug: string
          tags: string[] | null
          title: string
        }
        Insert: {
          author_name?: string | null
          content: string
          cover_image_url?: string | null
          created_at?: string | null
          id?: string
          like_count?: number | null
          published?: boolean | null
          share_count?: number | null
          slug: string
          tags?: string[] | null
          title: string
        }
        Update: {
          author_name?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          id?: string
          like_count?: number | null
          published?: boolean | null
          share_count?: number | null
          slug?: string
          tags?: string[] | null
          title?: string
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
      chat_folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          folder_id: string | null
          id: string
          is_public: boolean | null
          meta: Json | null
          mode: string | null
          owner_user_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          is_public?: boolean | null
          meta?: Json | null
          mode?: string | null
          owner_user_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          is_public?: boolean | null
          meta?: Json | null
          mode?: string | null
          owner_user_id?: string | null
          title?: string | null
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
          id?: string
          is_ready?: boolean | null
          metadata?: Json | null
          report_type?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          coach_id: string
          created_at: string
          entry_text: string
          id: string
          linked_report_id: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          entry_text: string
          id?: string
          linked_report_id?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          entry_text?: string
          id?: string
          linked_report_id?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
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
          created_at: string
          display_name: string | null
          email: string | null
          email_verified: boolean | null
          features: Json | null
          has_profile_setup: boolean
          id: string
          last_invoice_id: string | null
          last_payment_status: string | null
          last_seen_at: string | null
          metadata: Json | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_active: boolean | null
          subscription_next_charge: string | null
          subscription_plan: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          updated_at: string | null
          verification_token: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified?: boolean | null
          features?: Json | null
          has_profile_setup?: boolean
          id: string
          last_invoice_id?: string | null
          last_payment_status?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_active?: boolean | null
          subscription_next_charge?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          verification_token?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified?: boolean | null
          features?: Json | null
          has_profile_setup?: boolean
          id?: string
          last_invoice_id?: string | null
          last_payment_status?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_active?: boolean | null
          subscription_next_charge?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
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
          is_auto_topup: boolean
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
          is_auto_topup?: boolean
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
          is_auto_topup?: boolean
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
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          type: string
          credits: number
          amount_usd: number | null
          description: string | null
          reference_id: string | null
          endpoint: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          credits: number
          amount_usd?: number | null
          description?: string | null
          reference_id?: string | null
          endpoint?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          credits?: number
          amount_usd?: number | null
          description?: string | null
          reference_id?: string | null
          endpoint?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          user_id: string
          credits: number
          auto_topup_enabled: boolean
          auto_topup_threshold: number
          auto_topup_amount: number
          last_updated: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          credits?: number
          auto_topup_enabled?: boolean
          auto_topup_threshold?: number
          auto_topup_amount?: number
          last_updated?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          credits?: number
          auto_topup_enabled?: boolean
          auto_topup_threshold?: number
          auto_topup_amount?: number
          last_updated?: string | null
          created_at?: string
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
      [_ in never]: never
    }
    Functions: {
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      add_credits: {
        Args: {
          _user_id: string
          _credits: number
          _amount_usd: number
          _type?: string
          _reference_id?: string
          _description?: string
        }
        Returns: boolean
      }
      deduct_credits: {
        Args: {
          _user_id: string
          _credits: number
          _endpoint: string
          _reference_id?: string
          _description?: string
        }
        Returns: boolean
      }
      update_auto_topup_settings: {
        Args: {
          _user_id: string
          _enabled: boolean
          _threshold: number
          _amount: number
        }
        Returns: boolean
      }
      check_orphaned_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          orphaned_count: number
          table_name: string
          total_size_estimate: string
        }[]
      }
      check_report_logs_constraints: {
        Args: Record<PropertyKey, never>
        Returns: {
          column_default: string
          column_name: string
          constraint_definition: string
          constraint_name: string
          constraint_type: string
          data_type: string
          is_nullable: string
          udt_name: string
        }[]
      }
      check_user_admin_role: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      clean_completed_topups: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_user_after_payment: {
        Args: { plan_type?: string; user_id: string }
        Returns: undefined
      }
      delete_user_account: {
        Args: { user_id_to_delete: string }
        Returns: undefined
      }
      ensure_profile_for_current_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      gen_random_bytes: {
        Args: { "": number }
        Returns: string
      }
      generate_api_key: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_all_users_admin: {
        Args: Record<PropertyKey, never>
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
      get_flow_status: {
        Args: { user_email: string }
        Returns: {
          created_at: string
          flow_state: string
          session_id: string
          updated_at: string
        }[]
      }
      get_next_engine_sequence: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_stripe_customer_id_for_user: {
        Args: { user_id_param: string }
        Returns: {
          stripe_customer_id: string
          stripe_payment_method_id: string
        }[]
      }
      get_user_email_by_id: {
        Args: { user_id_param: string }
        Returns: string
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { data: Json; uri: string } | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      is_user_verified: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      mark_profile_verified: {
        Args: { user_id?: string }
        Returns: boolean
      }
      rpc_notify_orchestrator: {
        Args: { guest_report_id: string }
        Returns: undefined
      }
      send_notification_email: {
        Args: {
          recipient_email: string
          template_type: string
          variables?: Json
        }
        Returns: boolean
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      toggle_addon: {
        Args: { addon_name: string; enabled: boolean; user_id_param: string }
        Returns: undefined
      }
      upgrade_plan: {
        Args: { new_plan: string; user_id_param: string }
        Returns: undefined
      }
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
      user_owns_insight: {
        Args: { report_id: string }
        Returns: boolean
      }
    }
    Enums: {
      queue_status: "pending" | "processing" | "completed" | "failed"
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
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
      queue_status: ["pending", "processing", "completed", "failed"],
      user_role: ["admin", "user"],
    },
  },
} as const
