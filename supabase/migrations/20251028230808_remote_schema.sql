create extension if not exists "pg_cron" with schema "pg_catalog";
drop extension if exists "pg_net";
drop extension if exists "pgjwt";
create extension if not exists "http" with schema "public";
create extension if not exists "pg_net" with schema "public";
create type "public"."queue_status" as enum ('pending', 'processing', 'completed', 'failed');
create type "public"."user_role" as enum ('admin', 'user');
create sequence "public"."credit_transactions_id_seq";
create sequence "public"."engine_selector_seq";
create sequence "public"."swissdebuglogs_id_seq";
create table "public"."admin_logs" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "page" text not null,
    "event_type" text not null,
    "logs" text,
    "meta" jsonb,
    "user_id" uuid
      );
alter table "public"."admin_logs" enable row level security;
create table "public"."api_usage" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "translator_log_id" uuid not null,
    "endpoint" text not null,
    "report_tier" text,
    "used_geo_lookup" boolean default false,
    "unit_price_usd" numeric(6,2) not null,
    "total_cost_usd" numeric(6,2) not null,
    "created_at" timestamp with time zone default now(),
    "report_price_usd" numeric(10,2) default 0,
    "geo_price_usd" numeric(10,2) default 0,
    "request_params" jsonb
      );
alter table "public"."api_usage" enable row level security;
create table "public"."blog_posts" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "slug" text not null,
    "content" text not null,
    "cover_image_url" text,
    "author_name" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "tags" text[] default '{}'::text[],
    "published" boolean default true,
    "like_count" integer default 0,
    "share_count" integer default 0
      );
alter table "public"."blog_posts" enable row level security;
create table "public"."calendar_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "coach_id" uuid not null,
    "client_id" uuid,
    "title" text not null,
    "description" text,
    "start_time" timestamp with time zone not null,
    "end_time" timestamp with time zone not null,
    "event_type" text default 'session'::text,
    "color_tag" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );
alter table "public"."calendar_sessions" enable row level security;
create table "public"."cascade_deletion_log" (
    "id" uuid not null default gen_random_uuid(),
    "table_name" text not null,
    "record_id" uuid not null,
    "parent_table" text not null,
    "parent_id" uuid not null,
    "deleted_at" timestamp with time zone default now()
      );
alter table "public"."cascade_deletion_log" enable row level security;
create table "public"."chat_folders" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "name" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );
alter table "public"."chat_folders" enable row level security;
create table "public"."conversation_caches" (
    "chat_id" uuid not null,
    "cache_name" text not null,
    "system_data_hash" text not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "expires_at" timestamp with time zone not null
      );
alter table "public"."conversation_caches" enable row level security;
create table "public"."conversation_summaries" (
    "id" uuid not null default gen_random_uuid(),
    "chat_id" uuid not null,
    "summary_text" text not null,
    "turn_range" text not null,
    "message_count" integer not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP
      );
alter table "public"."conversation_summaries" enable row level security;
create table "public"."conversations" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "meta" jsonb default '{}'::jsonb,
    "is_public" boolean default false,
    "owner_user_id" uuid,
    "mode" text,
    "folder_id" uuid,
    "turn_count" integer default 0,
    "last_summary_at_turn" integer default 0
      );
alter table "public"."conversations" enable row level security;
create table "public"."conversations_participants" (
    "conversation_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null default 'member'::text,
    "joined_at" timestamp with time zone not null default now(),
    "invited_by" uuid
      );
alter table "public"."conversations_participants" enable row level security;
create table "public"."credit_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "type" text not null,
    "credits" integer not null,
    "amount_usd" numeric(10,2),
    "description" text,
    "reference_id" uuid,
    "endpoint" text,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."credit_transactions" enable row level security;
create table "public"."debug_logs" (
    "id" uuid not null default gen_random_uuid(),
    "source" text,
    "message" text,
    "user_id" text,
    "inserted_at" timestamp with time zone default now(),
    "label" text,
    "details" jsonb,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."debug_logs" enable row level security;
create table "public"."domain_slugs" (
    "id" uuid not null default gen_random_uuid(),
    "domain" text not null,
    "info" boolean default false,
    "media" boolean default false,
    "billing" boolean default false,
    "support" boolean default false,
    "created_at" timestamp with time zone default now(),
    "noreply" boolean default false,
    "hello" boolean default false,
    "contact" boolean default false,
    "help" boolean default false,
    "marketing" boolean default false,
    "admin" boolean default false,
    "legal" boolean default false,
    "hr" boolean default false,
    "dev" boolean default false
      );
alter table "public"."domain_slugs" enable row level security;
create table "public"."email_messages" (
    "id" uuid not null default gen_random_uuid(),
    "from_address" text not null,
    "to_address" text not null,
    "direction" text not null,
    "subject" text,
    "body" text,
    "sent_via" text default 'email'::text,
    "created_at" timestamp with time zone default now(),
    "raw_headers" text,
    "is_starred" boolean not null default false,
    "is_archived" boolean not null default false,
    "is_read" boolean not null default false,
    "attachments" jsonb default '[]'::jsonb,
    "attachment_count" integer default 0,
    "has_attachments" boolean default false
      );
alter table "public"."email_messages" enable row level security;
create table "public"."email_notification_templates" (
    "id" uuid not null default gen_random_uuid(),
    "template_type" text not null,
    "subject" text not null,
    "body_html" text not null,
    "body_text" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "public"."email_notification_templates" enable row level security;
create table "public"."geo_cache" (
    "lat" double precision not null,
    "lon" double precision not null,
    "updated_at" timestamp with time zone default now(),
    "place_id" text not null,
    "place" text
      );
alter table "public"."geo_cache" enable row level security;
create table "public"."insights" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "report_type" text not null,
    "status" text default 'pending'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "completed_at" timestamp with time zone,
    "metadata" jsonb default '{}'::jsonb,
    "is_ready" boolean default false
      );
alter table "public"."insights" enable row level security;
create table "public"."ip_allowlist" (
    "id" uuid not null default gen_random_uuid(),
    "ip_address" text not null,
    "description" text,
    "created_by" text,
    "created_at" timestamp with time zone default now(),
    "expires_at" timestamp with time zone
      );
alter table "public"."ip_allowlist" enable row level security;
create table "public"."journal_entries" (
    "id" uuid not null default gen_random_uuid(),
    "client_id" uuid not null,
    "coach_id" uuid not null,
    "title" text,
    "entry_text" text not null,
    "tags" text[],
    "linked_report_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "public"."journal_entries" enable row level security;
create table "public"."landing_page_config" (
    "id" uuid not null default gen_random_uuid(),
    "feature_images" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "features_images" jsonb not null default '{}'::jsonb
      );
alter table "public"."landing_page_config" enable row level security;
create table "public"."legal_documents" (
    "id" uuid not null default gen_random_uuid(),
    "document_type" text not null,
    "title" text not null,
    "content" text not null,
    "version" text not null,
    "published_date" timestamp with time zone not null default now(),
    "is_current" boolean not null default true
      );
alter table "public"."legal_documents" enable row level security;
create table "public"."messages" (
    "id" uuid not null default gen_random_uuid(),
    "chat_id" uuid not null,
    "role" text not null,
    "text" text,
    "created_at" timestamp with time zone not null default now(),
    "meta" jsonb not null default '{}'::jsonb,
    "client_msg_id" uuid,
    "status" text default 'complete'::text,
    "context_injected" boolean default false,
    "message_number" integer not null default 1,
    "mode" text default 'chat'::text,
    "user_id" uuid,
    "user_name" text
      );
alter table "public"."messages" enable row level security;
create table "public"."password_reset_tokens" (
    "id" uuid not null default gen_random_uuid(),
    "token_hash" text not null,
    "email" text not null,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."password_reset_tokens" enable row level security;
create table "public"."payment_method" (
    "id" bigint not null default nextval('public.credit_transactions_id_seq'::regclass),
    "user_id" uuid,
    "ts" timestamp with time zone default now(),
    "stripe_pid" text,
    "email" text,
    "country" text,
    "postal_code" text,
    "card_last4" text,
    "card_brand" text,
    "stripe_customer_id" text,
    "billing_name" text,
    "billing_address_line1" text,
    "billing_address_line2" text,
    "city" text,
    "state" text,
    "payment_method_type" text,
    "payment_status" text,
    "stripe_payment_method_id" text,
    "exp_month" smallint,
    "exp_year" smallint,
    "fingerprint" text,
    "active" boolean default true,
    "status_reason" text,
    "status_changed_at" timestamp with time zone,
    "last_charge_at" timestamp with time zone,
    "last_charge_status" text,
    "last_invoice_id" text,
    "last_invoice_number" text,
    "last_invoice_amount_cents" integer,
    "last_invoice_currency" text default 'usd'::text,
    "last_receipt_url" text,
    "next_billing_at" timestamp with time zone,
    "invoice_history" jsonb not null default '[]'::jsonb
      );
alter table "public"."payment_method" enable row level security;
create table "public"."price_list" (
    "id" text not null,
    "endpoint" text,
    "report_type" text,
    "name" text not null,
    "description" text,
    "unit_price_usd" numeric(6,2) not null,
    "created_at" timestamp with time zone,
    "product_code" text,
    "is_ai" text,
    "stripe_price_id" text
      );
alter table "public"."price_list" enable row level security;
create table "public"."profiles" (
    "id" uuid not null,
    "email" text,
    "email_verified" boolean default false,
    "subscription_plan" text default 'free'::text,
    "subscription_status" text default 'inactive'::text,
    "stripe_customer_id" text,
    "features" jsonb default '{}'::jsonb,
    "metadata" jsonb default '{}'::jsonb,
    "last_seen_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone default now(),
    "subscription_active" boolean default false,
    "subscription_start_date" timestamp with time zone,
    "subscription_next_charge" timestamp with time zone,
    "stripe_subscription_id" text,
    "last_payment_status" text,
    "last_invoice_id" text,
    "verification_token" text,
    "has_profile_setup" boolean not null default false,
    "display_name" text
      );
alter table "public"."profiles" enable row level security;
create table "public"."promo_codes" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "discount_percent" integer not null,
    "is_active" boolean default true,
    "max_uses" integer,
    "times_used" integer default 0,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."promo_codes" enable row level security;
create table "public"."report_logs" (
    "id" uuid not null default gen_random_uuid(),
    "report_type" text,
    "endpoint" text,
    "report_text" text,
    "status" text default 'failed'::text,
    "duration_ms" integer,
    "error_message" text,
    "created_at" timestamp with time zone default now(),
    "engine_used" text,
    "has_error" boolean not null default false,
    "metadata" jsonb default '{}'::jsonb,
    "is_guest" boolean default false,
    "chat_id" uuid
      );
alter table "public"."report_logs" enable row level security;
create table "public"."report_prompts" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "system_prompt" text not null,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."report_prompts" enable row level security;
create table "public"."stripe_products" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "product_id" text not null,
    "price_id" text not null,
    "amount_usd" numeric(10,2) not null,
    "currency" text default 'usd'::text,
    "type" text default 'one_time'::text,
    "active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );
alter table "public"."stripe_products" enable row level security;
create table "public"."stripe_webhook_events" (
    "id" uuid not null default gen_random_uuid(),
    "stripe_event_id" text not null,
    "stripe_event_type" text not null,
    "stripe_kind" text not null,
    "stripe_customer_id" text,
    "payload" jsonb not null,
    "processed" boolean not null default false,
    "processing_error" text,
    "created_at" timestamp with time zone not null default now(),
    "processed_at" timestamp with time zone
      );
alter table "public"."stripe_webhook_events" enable row level security;
create table "public"."swissdebuglogs" (
    "id" integer not null default nextval('public.swissdebuglogs_id_seq'::regclass),
    "api_key" text,
    "user_id" uuid,
    "balance_usd" numeric,
    "request_type" text,
    "request_payload" jsonb,
    "response_status" integer,
    "timestamp" timestamp with time zone default CURRENT_TIMESTAMP
      );
alter table "public"."swissdebuglogs" enable row level security;
create table "public"."system_config" (
    "key" text not null,
    "value" jsonb not null,
    "description" text,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
      );
alter table "public"."system_config" enable row level security;
create table "public"."system_prompts" (
    "id" uuid not null default gen_random_uuid(),
    "category" text not null,
    "subcategory" text not null,
    "prompt_text" text not null,
    "display_order" integer default 0,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );
alter table "public"."system_prompts" enable row level security;
create table "public"."temp_audio" (
    "chat_id" text not null,
    "audio_data" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );
alter table "public"."temp_audio" enable row level security;
create table "public"."temp_report_data" (
    "id" uuid not null default gen_random_uuid(),
    "report_content" text,
    "swiss_data" jsonb,
    "metadata" jsonb,
    "created_at" timestamp without time zone default now(),
    "expires_at" timestamp without time zone default (now() + '72:00:00'::interval),
    "token_hash" text,
    "chat_hash" text,
    "guest_report_id" uuid,
    "plain_token" text,
    "swiss_data_saved" boolean default false,
    "swiss_data_save_pending" boolean default false,
    "swiss_data_save_attempts" integer default 0,
    "last_save_attempt_at" timestamp without time zone
      );
alter table "public"."temp_report_data" enable row level security;
create table "public"."token_emails" (
    "id" uuid not null default gen_random_uuid(),
    "template_type" text not null,
    "subject" text not null,
    "body_html" text not null,
    "body_text" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );
alter table "public"."token_emails" enable row level security;
create table "public"."topup_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "stripe_payment_intent_id" text,
    "amount_cents" integer not null,
    "status" text not null,
    "created_at" timestamp with time zone default now(),
    "credited" boolean default false,
    "receipt_url" text,
    "credits" integer,
    "is_auto_topup" boolean default false
      );
alter table "public"."topup_logs" enable row level security;
create table "public"."topup_queue" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "amount_usd" numeric(10,2) not null,
    "requested_at" timestamp with time zone default now(),
    "processed_at" timestamp with time zone,
    "status" text default 'pending'::text,
    "message" text
      );
alter table "public"."topup_queue" enable row level security;
create table "public"."translator_logs" (
    "id" uuid not null default gen_random_uuid(),
    "request_type" text,
    "request_payload" jsonb,
    "response_status" integer,
    "processing_time_ms" integer,
    "error_message" text,
    "created_at" timestamp with time zone default now(),
    "google_geo" boolean default false,
    "report_tier" text,
    "chat_id" uuid,
    "is_archived" boolean not null default false,
    "translator_payload" jsonb,
    "is_guest" boolean not null default false,
    "swiss_data" jsonb,
    "swiss_error" boolean default false
      );
alter table "public"."translator_logs" enable row level security;
create table "public"."user_credits" (
    "user_id" uuid not null,
    "credits" integer not null default 0,
    "auto_topup_enabled" boolean default false,
    "auto_topup_threshold" integer default 7,
    "auto_topup_amount" integer default 34,
    "last_updated" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
      );
alter table "public"."user_credits" enable row level security;
create table "public"."user_errors" (
    "id" uuid not null default gen_random_uuid(),
    "guest_report_id" uuid,
    "email" text not null,
    "error_type" text not null default 'report_not_found'::text,
    "price_paid" numeric,
    "error_message" text,
    "case_number" text not null default ('CASE_'::text || upper("substring"((gen_random_uuid())::text, 1, 8))),
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "resolved" boolean not null default false,
    "resolved_at" timestamp with time zone
      );
alter table "public"."user_errors" enable row level security;
create table "public"."user_preferences" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "email_notifications_enabled" boolean default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "client_view_mode" text default 'grid'::text,
    "tts_voice" text default 'Puck'::text
      );
alter table "public"."user_preferences" enable row level security;
create table "public"."user_profile_list" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "profile_name" text not null,
    "name" text not null,
    "birth_date" text not null,
    "birth_time" text not null,
    "birth_location" text not null,
    "birth_latitude" double precision,
    "birth_longitude" double precision,
    "birth_place_id" text,
    "timezone" text,
    "house_system" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "public"."user_profile_list" enable row level security;
create table "public"."user_roles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "role" public.user_role not null default 'user'::public.user_role,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "public"."user_roles" enable row level security;
create table "public"."website_templates" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "preview_image_url" text,
    "template_data" jsonb not null,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "public"."website_templates" enable row level security;
alter sequence "public"."credit_transactions_id_seq" owned by "public"."payment_method"."id";
alter sequence "public"."swissdebuglogs_id_seq" owned by "public"."swissdebuglogs"."id";
CREATE UNIQUE INDEX admin_logs_pkey ON public.admin_logs USING btree (id);
CREATE UNIQUE INDEX api_usage_pkey ON public.api_usage USING btree (id);
CREATE UNIQUE INDEX blog_posts_pkey ON public.blog_posts USING btree (id);
CREATE UNIQUE INDEX blog_posts_slug_key ON public.blog_posts USING btree (slug);
CREATE UNIQUE INDEX calendar_sessions_pkey ON public.calendar_sessions USING btree (id);
CREATE UNIQUE INDEX cascade_deletion_log_pkey ON public.cascade_deletion_log USING btree (id);
CREATE UNIQUE INDEX chat_folders_pkey ON public.chat_folders USING btree (id);
CREATE UNIQUE INDEX conversation_caches_pkey ON public.conversation_caches USING btree (chat_id);
CREATE UNIQUE INDEX conversation_summaries_pkey ON public.conversation_summaries USING btree (id);
CREATE UNIQUE INDEX conversations_participants_pkey ON public.conversations_participants USING btree (conversation_id, user_id);
CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);
CREATE INDEX credit_transactions_email_idx ON public.payment_method USING btree (email);
CREATE UNIQUE INDEX credit_transactions_pkey ON public.payment_method USING btree (id);
CREATE UNIQUE INDEX credit_transactions_pkey1 ON public.credit_transactions USING btree (id);
CREATE INDEX credit_transactions_stripe_customer_id_idx ON public.payment_method USING btree (stripe_customer_id);
CREATE INDEX credit_transactions_user_ts_idx ON public.payment_method USING btree (user_id, ts DESC);
CREATE UNIQUE INDEX debug_logs_pkey ON public.debug_logs USING btree (id);
CREATE UNIQUE INDEX domain_slugs_domain_key ON public.domain_slugs USING btree (domain);
CREATE UNIQUE INDEX domain_slugs_pkey ON public.domain_slugs USING btree (id);
CREATE UNIQUE INDEX email_messages_pkey ON public.email_messages USING btree (id);
CREATE UNIQUE INDEX email_notification_templates_pkey ON public.email_notification_templates USING btree (id);
CREATE UNIQUE INDEX email_notification_templates_template_type_key ON public.email_notification_templates USING btree (template_type);
CREATE UNIQUE INDEX geo_cache_pkey ON public.geo_cache USING btree (place_id);
CREATE INDEX idx_caches_expires ON public.conversation_caches USING btree (expires_at);
CREATE INDEX idx_chat_folders_user_id ON public.chat_folders USING btree (user_id);
CREATE INDEX idx_conv_id_user ON public.conversations USING btree (id, user_id);
CREATE INDEX idx_conversations_created_at ON public.conversations USING btree (created_at DESC);
CREATE INDEX idx_conversations_folder_id ON public.conversations USING btree (folder_id);
CREATE INDEX idx_conversations_id ON public.conversations USING btree (id);
CREATE INDEX idx_conversations_participants_conversation_id ON public.conversations_participants USING btree (conversation_id);
CREATE INDEX idx_conversations_participants_user_id ON public.conversations_participants USING btree (user_id);
CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);
CREATE INDEX idx_credit_transactions_user ON public.credit_transactions USING btree (user_id, created_at DESC);
CREATE INDEX idx_insights_created_at ON public.insights USING btree (created_at DESC);
CREATE INDEX idx_insights_is_ready ON public.insights USING btree (is_ready);
CREATE INDEX idx_insights_status ON public.insights USING btree (status);
CREATE INDEX idx_insights_user_id ON public.insights USING btree (user_id);
CREATE INDEX idx_ip_allowlist_expires_at ON public.ip_allowlist USING btree (expires_at);
CREATE INDEX idx_journal_entries_client_id ON public.journal_entries USING btree (client_id);
CREATE INDEX idx_journal_entries_coach_id ON public.journal_entries USING btree (coach_id);
CREATE INDEX idx_messages_chat_created_desc ON public.messages USING btree (chat_id, created_at DESC);
CREATE INDEX idx_messages_chat_created_desc_no_system ON public.messages USING btree (chat_id, created_at DESC) WHERE (role <> 'system'::text);
CREATE INDEX idx_messages_chat_id_created_at ON public.messages USING btree (chat_id, created_at);
CREATE INDEX idx_messages_chat_role_created_desc ON public.messages USING btree (chat_id, role, created_at DESC);
CREATE INDEX idx_messages_context_injected ON public.messages USING btree (chat_id, context_injected) WHERE (context_injected = true);
CREATE INDEX idx_messages_history_optimized ON public.messages USING btree (chat_id, created_at DESC) WHERE ((role <> 'system'::text) AND (status = 'complete'::text) AND (text IS NOT NULL) AND (text <> ''::text));
CREATE INDEX idx_messages_system_optimized ON public.messages USING btree (chat_id, created_at) WHERE ((role = 'system'::text) AND (status = 'complete'::text) AND (text IS NOT NULL) AND (text <> ''::text));
CREATE INDEX idx_part_conv_user ON public.conversations_participants USING btree (conversation_id, user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);
CREATE INDEX idx_password_reset_tokens_token_hash ON public.password_reset_tokens USING btree (token_hash);
CREATE INDEX idx_payment_method_user_active ON public.payment_method USING btree (user_id, active);
CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX idx_profiles_has_profile_setup ON public.profiles USING btree (has_profile_setup);
CREATE INDEX idx_profiles_stripe_customer_id ON public.profiles USING btree (stripe_customer_id);
CREATE INDEX idx_profiles_stripe_subscription_id ON public.profiles USING btree (stripe_subscription_id);
CREATE INDEX idx_profiles_subscription_next_charge ON public.profiles USING btree (subscription_next_charge);
CREATE INDEX idx_profiles_verification_token ON public.profiles USING btree (verification_token) WHERE (verification_token IS NOT NULL);
CREATE INDEX idx_report_logs_chat_id ON public.report_logs USING btree (chat_id);
CREATE INDEX idx_report_logs_created_at ON public.report_logs USING btree (created_at DESC);
CREATE INDEX idx_report_prompts_name ON public.report_prompts USING btree (name);
CREATE INDEX idx_stripe_webhook_events_created_at ON public.stripe_webhook_events USING btree (created_at DESC);
CREATE INDEX idx_stripe_webhook_events_processed ON public.stripe_webhook_events USING btree (processed, created_at DESC);
CREATE INDEX idx_summaries_chat_created ON public.conversation_summaries USING btree (chat_id, created_at DESC);
CREATE INDEX idx_swe_customer ON public.stripe_webhook_events USING btree (stripe_customer_id);
CREATE INDEX idx_swe_kind_date ON public.stripe_webhook_events USING btree (stripe_kind, created_at DESC);
CREATE INDEX idx_swe_processed ON public.stripe_webhook_events USING btree (processed) WHERE (processed = false);
CREATE INDEX idx_system_config_key ON public.system_config USING btree (key);
CREATE INDEX idx_system_prompts_category ON public.system_prompts USING btree (category, display_order);
CREATE INDEX idx_temp_audio_chat_id ON public.temp_audio USING btree (chat_id);
CREATE INDEX idx_temp_audio_chat_id_created_at ON public.temp_audio USING btree (chat_id, created_at DESC);
CREATE INDEX idx_temp_audio_created_at ON public.temp_audio USING btree (created_at DESC);
CREATE INDEX idx_translator_logs_chat_id ON public.translator_logs USING btree (chat_id);
CREATE INDEX idx_user_errors_case_number ON public.user_errors USING btree (case_number);
CREATE INDEX idx_user_errors_created_at ON public.user_errors USING btree (created_at DESC);
CREATE INDEX idx_user_errors_email ON public.user_errors USING btree (email);
CREATE INDEX idx_user_profile_list_user_id ON public.user_profile_list USING btree (user_id);
CREATE UNIQUE INDEX insights_pkey ON public.insights USING btree (id);
CREATE UNIQUE INDEX ip_allowlist_ip_address_key ON public.ip_allowlist USING btree (ip_address);
CREATE UNIQUE INDEX ip_allowlist_pkey ON public.ip_allowlist USING btree (id);
CREATE UNIQUE INDEX journal_entries_pkey ON public.journal_entries USING btree (id);
CREATE UNIQUE INDEX landing_page_config_pkey ON public.landing_page_config USING btree (id);
CREATE UNIQUE INDEX legal_documents_pkey ON public.legal_documents USING btree (id);
CREATE UNIQUE INDEX messages_client_msg_id_key ON public.messages USING btree (client_msg_id);
CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);
CREATE UNIQUE INDEX password_reset_tokens_pkey ON public.password_reset_tokens USING btree (id);
CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON public.password_reset_tokens USING btree (token_hash);
CREATE UNIQUE INDEX price_list_pkey ON public.price_list USING btree (id);
CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (email);
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX promo_codes_code_key ON public.promo_codes USING btree (code);
CREATE UNIQUE INDEX promo_codes_pkey ON public.promo_codes USING btree (id);
CREATE UNIQUE INDEX report_logs_pkey ON public.report_logs USING btree (id);
CREATE UNIQUE INDEX report_prompts_name_key ON public.report_prompts USING btree (name);
CREATE UNIQUE INDEX report_prompts_pkey ON public.report_prompts USING btree (id);
CREATE UNIQUE INDEX stripe_products_pkey ON public.stripe_products USING btree (id);
CREATE UNIQUE INDEX stripe_webhook_events_pkey ON public.stripe_webhook_events USING btree (id);
CREATE UNIQUE INDEX stripe_webhook_events_stripe_event_id_key ON public.stripe_webhook_events USING btree (stripe_event_id);
CREATE UNIQUE INDEX swissdebuglogs_pkey ON public.swissdebuglogs USING btree (id);
CREATE UNIQUE INDEX system_config_pkey ON public.system_config USING btree (key);
CREATE UNIQUE INDEX system_prompts_pkey ON public.system_prompts USING btree (id);
CREATE UNIQUE INDEX temp_audio_pkey ON public.temp_audio USING btree (chat_id);
CREATE UNIQUE INDEX temp_report_data_chat_hash_key ON public.temp_report_data USING btree (chat_hash);
CREATE UNIQUE INDEX temp_report_data_pkey ON public.temp_report_data USING btree (id);
CREATE UNIQUE INDEX token_emails_pkey ON public.token_emails USING btree (id);
CREATE UNIQUE INDEX token_emails_template_type_key ON public.token_emails USING btree (template_type);
CREATE UNIQUE INDEX topup_logs_pkey ON public.topup_logs USING btree (id);
CREATE UNIQUE INDEX topup_logs_stripe_payment_intent_id_unique ON public.topup_logs USING btree (stripe_payment_intent_id);
CREATE UNIQUE INDEX topup_queue_pkey ON public.topup_queue USING btree (id);
CREATE INDEX translator_logs_created_at_idx ON public.translator_logs USING btree (created_at);
CREATE UNIQUE INDEX translator_logs_pkey ON public.translator_logs USING btree (id);
CREATE INDEX translator_logs_request_type_idx ON public.translator_logs USING btree (request_type);
CREATE INDEX translator_logs_user_id_idx ON public.translator_logs USING btree (chat_id);
CREATE UNIQUE INDEX user_credits_pkey ON public.user_credits USING btree (user_id);
CREATE UNIQUE INDEX user_errors_guest_report_id_key ON public.user_errors USING btree (guest_report_id);
CREATE UNIQUE INDEX user_errors_pkey ON public.user_errors USING btree (id);
CREATE UNIQUE INDEX user_preferences_pkey ON public.user_preferences USING btree (id);
CREATE UNIQUE INDEX user_preferences_user_id_key ON public.user_preferences USING btree (user_id);
CREATE UNIQUE INDEX user_profile_list_pkey ON public.user_profile_list USING btree (id);
CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);
CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);
CREATE UNIQUE INDEX website_templates_pkey ON public.website_templates USING btree (id);
alter table "public"."admin_logs" add constraint "admin_logs_pkey" PRIMARY KEY using index "admin_logs_pkey";
alter table "public"."api_usage" add constraint "api_usage_pkey" PRIMARY KEY using index "api_usage_pkey";
alter table "public"."blog_posts" add constraint "blog_posts_pkey" PRIMARY KEY using index "blog_posts_pkey";
alter table "public"."calendar_sessions" add constraint "calendar_sessions_pkey" PRIMARY KEY using index "calendar_sessions_pkey";
alter table "public"."cascade_deletion_log" add constraint "cascade_deletion_log_pkey" PRIMARY KEY using index "cascade_deletion_log_pkey";
alter table "public"."chat_folders" add constraint "chat_folders_pkey" PRIMARY KEY using index "chat_folders_pkey";
alter table "public"."conversation_caches" add constraint "conversation_caches_pkey" PRIMARY KEY using index "conversation_caches_pkey";
alter table "public"."conversation_summaries" add constraint "conversation_summaries_pkey" PRIMARY KEY using index "conversation_summaries_pkey";
alter table "public"."conversations" add constraint "conversations_pkey" PRIMARY KEY using index "conversations_pkey";
alter table "public"."conversations_participants" add constraint "conversations_participants_pkey" PRIMARY KEY using index "conversations_participants_pkey";
alter table "public"."credit_transactions" add constraint "credit_transactions_pkey1" PRIMARY KEY using index "credit_transactions_pkey1";
alter table "public"."debug_logs" add constraint "debug_logs_pkey" PRIMARY KEY using index "debug_logs_pkey";
alter table "public"."domain_slugs" add constraint "domain_slugs_pkey" PRIMARY KEY using index "domain_slugs_pkey";
alter table "public"."email_messages" add constraint "email_messages_pkey" PRIMARY KEY using index "email_messages_pkey";
alter table "public"."email_notification_templates" add constraint "email_notification_templates_pkey" PRIMARY KEY using index "email_notification_templates_pkey";
alter table "public"."geo_cache" add constraint "geo_cache_pkey" PRIMARY KEY using index "geo_cache_pkey";
alter table "public"."insights" add constraint "insights_pkey" PRIMARY KEY using index "insights_pkey";
alter table "public"."ip_allowlist" add constraint "ip_allowlist_pkey" PRIMARY KEY using index "ip_allowlist_pkey";
alter table "public"."journal_entries" add constraint "journal_entries_pkey" PRIMARY KEY using index "journal_entries_pkey";
alter table "public"."landing_page_config" add constraint "landing_page_config_pkey" PRIMARY KEY using index "landing_page_config_pkey";
alter table "public"."legal_documents" add constraint "legal_documents_pkey" PRIMARY KEY using index "legal_documents_pkey";
alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";
alter table "public"."password_reset_tokens" add constraint "password_reset_tokens_pkey" PRIMARY KEY using index "password_reset_tokens_pkey";
alter table "public"."payment_method" add constraint "credit_transactions_pkey" PRIMARY KEY using index "credit_transactions_pkey";
alter table "public"."price_list" add constraint "price_list_pkey" PRIMARY KEY using index "price_list_pkey";
alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";
alter table "public"."promo_codes" add constraint "promo_codes_pkey" PRIMARY KEY using index "promo_codes_pkey";
alter table "public"."report_logs" add constraint "report_logs_pkey" PRIMARY KEY using index "report_logs_pkey";
alter table "public"."report_prompts" add constraint "report_prompts_pkey" PRIMARY KEY using index "report_prompts_pkey";
alter table "public"."stripe_products" add constraint "stripe_products_pkey" PRIMARY KEY using index "stripe_products_pkey";
alter table "public"."stripe_webhook_events" add constraint "stripe_webhook_events_pkey" PRIMARY KEY using index "stripe_webhook_events_pkey";
alter table "public"."swissdebuglogs" add constraint "swissdebuglogs_pkey" PRIMARY KEY using index "swissdebuglogs_pkey";
alter table "public"."system_config" add constraint "system_config_pkey" PRIMARY KEY using index "system_config_pkey";
alter table "public"."system_prompts" add constraint "system_prompts_pkey" PRIMARY KEY using index "system_prompts_pkey";
alter table "public"."temp_audio" add constraint "temp_audio_pkey" PRIMARY KEY using index "temp_audio_pkey";
alter table "public"."temp_report_data" add constraint "temp_report_data_pkey" PRIMARY KEY using index "temp_report_data_pkey";
alter table "public"."token_emails" add constraint "token_emails_pkey" PRIMARY KEY using index "token_emails_pkey";
alter table "public"."topup_logs" add constraint "topup_logs_pkey" PRIMARY KEY using index "topup_logs_pkey";
alter table "public"."topup_queue" add constraint "topup_queue_pkey" PRIMARY KEY using index "topup_queue_pkey";
alter table "public"."translator_logs" add constraint "translator_logs_pkey" PRIMARY KEY using index "translator_logs_pkey";
alter table "public"."user_credits" add constraint "user_credits_pkey" PRIMARY KEY using index "user_credits_pkey";
alter table "public"."user_errors" add constraint "user_errors_pkey" PRIMARY KEY using index "user_errors_pkey";
alter table "public"."user_preferences" add constraint "user_preferences_pkey" PRIMARY KEY using index "user_preferences_pkey";
alter table "public"."user_profile_list" add constraint "user_profile_list_pkey" PRIMARY KEY using index "user_profile_list_pkey";
alter table "public"."user_roles" add constraint "user_roles_pkey" PRIMARY KEY using index "user_roles_pkey";
alter table "public"."website_templates" add constraint "website_templates_pkey" PRIMARY KEY using index "website_templates_pkey";
alter table "public"."api_usage" add constraint "api_usage_translator_log_id_fkey" FOREIGN KEY (translator_log_id) REFERENCES public.translator_logs(id) not valid;
alter table "public"."api_usage" validate constraint "api_usage_translator_log_id_fkey";
alter table "public"."api_usage" add constraint "api_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;
alter table "public"."api_usage" validate constraint "api_usage_user_id_fkey";
alter table "public"."blog_posts" add constraint "blog_posts_slug_key" UNIQUE using index "blog_posts_slug_key";
alter table "public"."calendar_sessions" add constraint "fk_coach_id" FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."calendar_sessions" validate constraint "fk_coach_id";
alter table "public"."chat_folders" add constraint "chat_folders_name_length" CHECK (((char_length(name) > 0) AND (char_length(name) <= 100))) not valid;
alter table "public"."chat_folders" validate constraint "chat_folders_name_length";
alter table "public"."chat_folders" add constraint "chat_folders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."chat_folders" validate constraint "chat_folders_user_id_fkey";
alter table "public"."conversation_caches" add constraint "conversation_caches_chat_id_fkey" FOREIGN KEY (chat_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;
alter table "public"."conversation_caches" validate constraint "conversation_caches_chat_id_fkey";
alter table "public"."conversation_summaries" add constraint "conversation_summaries_chat_id_fkey" FOREIGN KEY (chat_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;
alter table "public"."conversation_summaries" validate constraint "conversation_summaries_chat_id_fkey";
alter table "public"."conversations" add constraint "conversations_folder_id_fkey" FOREIGN KEY (folder_id) REFERENCES public.chat_folders(id) ON DELETE SET NULL not valid;
alter table "public"."conversations" validate constraint "conversations_folder_id_fkey";
alter table "public"."conversations" add constraint "conversations_mode_check" CHECK ((mode = ANY (ARRAY['chat'::text, 'astro'::text, 'insight'::text, 'swiss'::text]))) not valid;
alter table "public"."conversations" validate constraint "conversations_mode_check";
alter table "public"."conversations" add constraint "conversations_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;
alter table "public"."conversations" validate constraint "conversations_owner_user_id_fkey";
alter table "public"."conversations" add constraint "conversations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."conversations" validate constraint "conversations_user_id_fkey";
alter table "public"."conversations_participants" add constraint "conversations_participants_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;
alter table "public"."conversations_participants" validate constraint "conversations_participants_conversation_id_fkey";
alter table "public"."conversations_participants" add constraint "conversations_participants_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;
alter table "public"."conversations_participants" validate constraint "conversations_participants_invited_by_fkey";
alter table "public"."conversations_participants" add constraint "conversations_participants_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text]))) not valid;
alter table "public"."conversations_participants" validate constraint "conversations_participants_role_check";
alter table "public"."conversations_participants" add constraint "conversations_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."conversations_participants" validate constraint "conversations_participants_user_id_fkey";
alter table "public"."credit_transactions" add constraint "credit_transactions_type_check" CHECK ((type = ANY (ARRAY['purchase'::text, 'deduct'::text, 'refund'::text, 'auto_topup'::text]))) not valid;
alter table "public"."credit_transactions" validate constraint "credit_transactions_type_check";
alter table "public"."credit_transactions" add constraint "credit_transactions_user_id_fkey1" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."credit_transactions" validate constraint "credit_transactions_user_id_fkey1";
alter table "public"."domain_slugs" add constraint "domain_slugs_domain_key" UNIQUE using index "domain_slugs_domain_key";
alter table "public"."email_messages" add constraint "email_messages_direction_check" CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))) not valid;
alter table "public"."email_messages" validate constraint "email_messages_direction_check";
alter table "public"."email_notification_templates" add constraint "email_notification_templates_template_type_key" UNIQUE using index "email_notification_templates_template_type_key";
alter table "public"."insights" add constraint "insights_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;
alter table "public"."insights" validate constraint "insights_status_check";
alter table "public"."insights" add constraint "insights_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."insights" validate constraint "insights_user_id_fkey";
alter table "public"."ip_allowlist" add constraint "ip_allowlist_ip_address_key" UNIQUE using index "ip_allowlist_ip_address_key";
alter table "public"."journal_entries" add constraint "journal_entries_coach_id_fkey" FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."journal_entries" validate constraint "journal_entries_coach_id_fkey";
alter table "public"."messages" add constraint "messages_chat_id_fkey" FOREIGN KEY (chat_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;
alter table "public"."messages" validate constraint "messages_chat_id_fkey";
alter table "public"."messages" add constraint "messages_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text]))) not valid;
alter table "public"."messages" validate constraint "messages_role_check";
alter table "public"."messages" add constraint "messages_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'streaming'::text, 'complete'::text, 'failed'::text]))) not valid;
alter table "public"."messages" validate constraint "messages_status_check";
alter table "public"."password_reset_tokens" add constraint "password_reset_tokens_token_hash_key" UNIQUE using index "password_reset_tokens_token_hash_key";
alter table "public"."payment_method" add constraint "credit_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."payment_method" validate constraint "credit_transactions_user_id_fkey";
alter table "public"."profiles" add constraint "profiles_email_unique" UNIQUE using index "profiles_email_unique";
alter table "public"."profiles" add constraint "profiles_id_fk_auth_users" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."profiles" validate constraint "profiles_id_fk_auth_users";
alter table "public"."promo_codes" add constraint "promo_codes_code_key" UNIQUE using index "promo_codes_code_key";
alter table "public"."promo_codes" add constraint "promo_codes_discount_percent_check" CHECK (((discount_percent >= 0) AND (discount_percent <= 100))) not valid;
alter table "public"."promo_codes" validate constraint "promo_codes_discount_percent_check";
alter table "public"."report_prompts" add constraint "report_prompts_name_key" UNIQUE using index "report_prompts_name_key";
alter table "public"."stripe_webhook_events" add constraint "stripe_webhook_events_stripe_event_id_key" UNIQUE using index "stripe_webhook_events_stripe_event_id_key";
alter table "public"."system_prompts" add constraint "system_prompts_category_check" CHECK ((category = ANY (ARRAY['mindset'::text, 'health'::text, 'wealth'::text, 'soul'::text, 'career'::text, 'compatibility'::text, 'chart_type'::text]))) not valid;
alter table "public"."system_prompts" validate constraint "system_prompts_category_check";
alter table "public"."temp_report_data" add constraint "temp_report_data_chat_hash_key" UNIQUE using index "temp_report_data_chat_hash_key";
alter table "public"."token_emails" add constraint "token_emails_template_type_key" UNIQUE using index "token_emails_template_type_key";
alter table "public"."topup_logs" add constraint "topup_logs_status_check" CHECK ((status = 'completed'::text)) not valid;
alter table "public"."topup_logs" validate constraint "topup_logs_status_check";
alter table "public"."topup_logs" add constraint "topup_logs_stripe_payment_intent_id_unique" UNIQUE using index "topup_logs_stripe_payment_intent_id_unique";
alter table "public"."topup_queue" add constraint "topup_queue_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'failed'::text, 'succeeded'::text, 'completed'::text]))) not valid;
alter table "public"."topup_queue" validate constraint "topup_queue_status_check";
alter table "public"."topup_queue" add constraint "topup_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."topup_queue" validate constraint "topup_queue_user_id_fkey";
alter table "public"."user_credits" add constraint "user_credits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."user_credits" validate constraint "user_credits_user_id_fkey";
alter table "public"."user_errors" add constraint "user_errors_guest_report_id_key" UNIQUE using index "user_errors_guest_report_id_key";
alter table "public"."user_preferences" add constraint "user_preferences_client_view_mode_check" CHECK ((client_view_mode = ANY (ARRAY['grid'::text, 'list'::text]))) not valid;
alter table "public"."user_preferences" validate constraint "user_preferences_client_view_mode_check";
alter table "public"."user_preferences" add constraint "user_preferences_user_id_key" UNIQUE using index "user_preferences_user_id_key";
alter table "public"."user_profile_list" add constraint "user_profile_list_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."user_profile_list" validate constraint "user_profile_list_user_id_fkey";
alter table "public"."user_roles" add constraint "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."user_roles" validate constraint "user_roles_user_id_fkey";
alter table "public"."user_roles" add constraint "user_roles_user_id_role_key" UNIQUE using index "user_roles_user_id_role_key";
set check_function_bodies = off;
CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _credits integer, _amount_usd numeric, _type text DEFAULT 'purchase'::text, _reference_id uuid DEFAULT NULL::uuid, _description text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _current_credits integer;
  _new_credits integer;
BEGIN
  -- Lock row and get current balance
  SELECT credits INTO _current_credits
  FROM user_credits
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF _current_credits IS NULL THEN
    INSERT INTO user_credits (user_id, credits)
    VALUES (_user_id, _credits)
    RETURNING credits INTO _new_credits;
  ELSE
    -- Add credits
    _new_credits := _current_credits + _credits;
    UPDATE user_credits
    SET credits = _new_credits, last_updated = now()
    WHERE user_id = _user_id;
  END IF;
  
  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, credits, amount_usd, reference_id, description)
  VALUES (_user_id, _type, _credits, _amount_usd, _reference_id, _description);
  
  RETURN true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.call_process_guest_report_pdf()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  response json;
  status int;
  error_msg text;
begin
  begin
    select net.http_post(
      'https://wrvqqvqvwqmfdqvqmaar.supabase.co/functions/v1/process-guest-report-pdf',
      jsonb_build_object('guest_report_id', NEW.id),
      '{}'::jsonb, -- empty params
      '{
        "Content-Type": "application/json",
        "Authorization": "Bearer [SERVICE_ROLE_KEY]"
      }'::jsonb
    ) into response;

    status := (response ->> 'status')::int;

    if status != 200 then
      error_msg := coalesce(response ->> 'body', 'Unknown error');
      update guest_reports
      set report_pdf_status = 'error',
          report_pdf_error = error_msg
      where id = NEW.id;
    else
      update guest_reports
      set report_pdf_status = 'sent',
          report_pdf_error = null
      where id = NEW.id;
    end if;

  exception when others then
    update guest_reports
    set report_pdf_status = 'trigger_failed',
        report_pdf_error = SQLERRM
    where id = NEW.id;
  end;

  return NEW;
end;
$function$;
CREATE OR REPLACE FUNCTION public.check_orphaned_data()
 RETURNS TABLE(table_name text, orphaned_count bigint, total_size_estimate text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    'messages'::text,
    COUNT(*)::bigint,
    pg_size_pretty(COUNT(*) * 1024)::text -- Rough estimate: 1KB per message
  FROM public.messages m
  WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.chat_id)
  
  UNION ALL
  
  SELECT 
    'message_block_summaries'::text,
    COUNT(*)::bigint,
    pg_size_pretty(COUNT(*) * 512)::text -- Rough estimate: 512 bytes per summary
  FROM public.message_block_summaries mbs
  WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = mbs.chat_id);
END;
$function$;
CREATE OR REPLACE FUNCTION public.check_report_logs_constraints()
 RETURNS TABLE(constraint_name text, constraint_type text, column_name text, data_type text, udt_name text, is_nullable text, column_default text, constraint_definition text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    con.conname::text as constraint_name,
    CASE con.contype
      WHEN 'p' THEN 'PRIMARY KEY'
      WHEN 'f' THEN 'FOREIGN KEY'
      WHEN 'u' THEN 'UNIQUE'
      WHEN 'c' THEN 'CHECK'
      ELSE 'OTHER'
    END::text as constraint_type,
    cols.column_name::text,
    cols.data_type::text,
    cols.udt_name::text,
    cols.is_nullable::text,
    cols.column_default::text,
    pg_get_constraintdef(con.oid) as constraint_definition
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = con.connamespace
  INNER JOIN information_schema.columns cols
    ON cols.table_name = rel.relname
    AND cols.column_name = ANY (con.conkey::int[]::text[])
    AND cols.table_schema = nsp.nspname
  WHERE rel.relname = 'report_logs'
    AND cols.column_name = 'user_id'
    AND nsp.nspname = 'public';
END;
$function$;
CREATE OR REPLACE FUNCTION public.check_user_admin_role(user_id_param uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = user_id_param AND role = 'admin'
  );
$function$;
CREATE OR REPLACE FUNCTION public.clean_completed_topups()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM topup_queue
  WHERE status = 'completed'
    AND EXISTS (
      SELECT 1
      FROM topup_logs
      WHERE topup_logs.stripe_payment_intent_id = 
        regexp_replace(topup_queue.message, '^PI\s+', '')
    );
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_user_after_payment(user_id uuid, plan_type text DEFAULT 'starter'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  new_api_key TEXT;
  user_email TEXT;
  stripe_customer TEXT;
  api_call_limit INTEGER;
BEGIN
  -- Get the user's email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'No user found with ID %', user_id;
  END IF;

  -- Get the stripe_customer_id for this email
  SELECT stripe_customer_id INTO stripe_customer
  FROM public.stripe_users
  WHERE email = user_email;

  IF stripe_customer IS NULL THEN
    RAISE EXCEPTION 'No stripe customer found for email %', user_email;
  END IF;

  -- Set API call limit based on plan
  api_call_limit := CASE 
    WHEN plan_type = 'starter' THEN 50000
    WHEN plan_type = 'growth' THEN 200000
    WHEN plan_type = 'professional' THEN 750000
    ELSE 50000
  END;

  -- Generate API key
  new_api_key := generate_api_key();

  -- Insert into users table
  INSERT INTO public.users (
    id, 
    email,
    plan_type, 
    calls_limit, 
    calls_made,
    stripe_customer_id,
    status
  ) VALUES (
    user_id,
    user_email,
    plan_type,
    api_call_limit,
    0,
    stripe_customer,
    'active'
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    plan_type = EXCLUDED.plan_type,
    calls_limit = EXCLUDED.calls_limit,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    status = EXCLUDED.status;
  
  -- Insert into app_users table
  INSERT INTO public.app_users (
    id, 
    stripe_customer_id,
    email,
    api_key,
    plan_name,
    api_calls_count,
    api_call_limit
  ) VALUES (
    user_id,
    stripe_customer,
    user_email,
    new_api_key,
    plan_type,
    0,
    api_call_limit
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    plan_name = EXCLUDED.plan_name,
    api_call_limit = EXCLUDED.api_call_limit;

  -- Log successful creation
  RAISE NOTICE 'Successfully created user records for ID: %, Email: %, Plan: %', user_id, user_email, plan_type;
END;
$function$;
CREATE OR REPLACE FUNCTION public.deactivate_old_payment_methods()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE payment_method
  SET active = FALSE,
      status_reason = 'replaced_by_user',
      status_changed_at = NOW()
  WHERE user_id = NEW.user_id
    AND active = TRUE
    AND id <> NEW.id;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.deduct_credits(_user_id uuid, _credits integer, _endpoint text, _reference_id uuid DEFAULT NULL::uuid, _description text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _current_credits integer;
  _new_credits integer;
  _auto_topup_enabled boolean;
  _auto_topup_threshold integer;
  _auto_topup_amount integer;
BEGIN
  -- Lock row and get current balance
  SELECT credits, auto_topup_enabled, auto_topup_threshold, auto_topup_amount 
  INTO _current_credits, _auto_topup_enabled, _auto_topup_threshold, _auto_topup_amount
  FROM user_credits
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF _current_credits IS NULL THEN
    INSERT INTO user_credits (user_id, credits)
    VALUES (_user_id, 0)
    RETURNING credits, auto_topup_enabled, auto_topup_threshold, auto_topup_amount 
    INTO _current_credits, _auto_topup_enabled, _auto_topup_threshold, _auto_topup_amount;
  END IF;
  
  -- Check sufficient balance
  IF _current_credits < _credits THEN
    RAISE EXCEPTION 'Insufficient credits: % < %', _current_credits, _credits;
  END IF;
  
  -- Deduct credits
  _new_credits := _current_credits - _credits;
  UPDATE user_credits
  SET credits = _new_credits, last_updated = now()
  WHERE user_id = _user_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, credits, endpoint, reference_id, description)
  VALUES (_user_id, 'deduct', _credits, _endpoint, _reference_id, _description);
  
  -- Check if auto top-up should trigger
  IF _auto_topup_enabled AND _new_credits <= _auto_topup_threshold THEN
    -- Insert into topup_queue for processing
    INSERT INTO topup_queue (user_id, amount_usd, status, message)
    VALUES (
      _user_id, 
      (_auto_topup_amount * 0.15), 
      'pending', 
      'Auto top-up triggered: balance dropped to ' || _new_credits || ' credits'
    );
  END IF;
  
  RETURN true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.delete_user_account(user_id_to_delete uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Log the start of deletion process
  INSERT INTO admin_logs (page, event_type, user_id, logs, meta, created_at)
  VALUES (
    'delete_account', 
    'deletion_started', 
    user_id_to_delete, 
    'Starting user account deletion',
    jsonb_build_object(
      'user_id', user_id_to_delete,
      'timestamp', now()
    ),
    now()
  );

  -- Delete from user_preferences table
  DELETE FROM user_preferences WHERE user_id = user_id_to_delete;
  
  -- Delete from payment_method table
  DELETE FROM payment_method WHERE user_id = user_id_to_delete;
  
  -- Delete from profiles table
  DELETE FROM profiles WHERE id = user_id_to_delete;
  
  -- Delete from conversations table (will cascade to messages)
  DELETE FROM conversations WHERE user_id = user_id_to_delete;
  
  -- Delete from folders table (will cascade to conversation_folders)
  DELETE FROM folders WHERE user_id = user_id_to_delete;
  
  -- Delete from calendar_sessions table
  DELETE FROM calendar_sessions WHERE coach_id = user_id_to_delete;

  -- Log successful database cleanup
  INSERT INTO admin_logs (page, event_type, user_id, logs, meta, created_at)
  VALUES (
    'delete_account', 
    'database_cleanup_completed', 
    user_id_to_delete, 
    'Successfully deleted user data',
    jsonb_build_object(
      'user_id', user_id_to_delete,
      'timestamp', now()
    ),
    now()
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log the database cleanup error
    INSERT INTO admin_logs (page, event_type, user_id, logs, meta, created_at)
    VALUES (
      'delete_account', 
      'database_cleanup_error', 
      user_id_to_delete, 
      'Error during database cleanup: ' || SQLERRM,
      jsonb_build_object(
        'user_id', user_id_to_delete,
        'error', SQLERRM,
        'timestamp', now()
      ),
      now()
    );
    
    -- Re-raise the exception
    RAISE;
END;
$function$;
CREATE OR REPLACE FUNCTION public.ensure_profile_for_current_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  uemail text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get email from auth.users via existing helper
  uemail := public.get_user_email_by_id(uid);

  -- Create if missing; if exists, hydrate email if empty
  INSERT INTO public.profiles (id, email)
  VALUES (uid, COALESCE(uemail, ''))
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.profiles.email);

END;
$function$;
CREATE OR REPLACE FUNCTION public.gen_random_bytes(integer)
 RETURNS bytea
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'extensions', 'pg_temp'
AS $function$
  SELECT extensions.gen_random_bytes($1);
$function$;
CREATE OR REPLACE FUNCTION public.generate_api_key()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN 'thp_' || encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
 RETURNS TABLE(user_id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, email_confirmed_at timestamp with time zone, role text, balance_usd numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    COALESCE(ur.role::text, 'user') as role,
    COALESCE(uc.balance_usd, 0) as balance_usd
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  LEFT JOIN public.user_credits uc ON u.id = uc.user_id
  ORDER BY u.created_at DESC;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_config(config_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  config_value TEXT;
BEGIN
  SELECT value INTO config_value
  FROM system_config
  WHERE key = config_key;
  
  RETURN config_value;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_flow_status(user_email text)
 RETURNS TABLE(session_id text, flow_state text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY 
    SELECT 
      f.session_id, 
      f.flow_state, 
      f.created_at,
      f.updated_at
    FROM public.stripe_flow_tracking f
    WHERE f.email = user_email
    ORDER BY f.created_at DESC
    LIMIT 1;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_next_engine_sequence()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT nextval('engine_selector_seq');
$function$;
CREATE OR REPLACE FUNCTION public.get_stripe_customer_id_for_user(user_id_param uuid)
 RETURNS TABLE(stripe_customer_id text, stripe_payment_method_id text)
 LANGUAGE sql
AS $function$
  SELECT stripe_customer_id, stripe_payment_method_id
  FROM public.credit_transactions
  WHERE user_id = user_id_param
    AND stripe_customer_id IS NOT NULL
    AND stripe_payment_method_id IS NOT NULL
  ORDER BY ts DESC
  LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.get_user_email_by_id(user_id_param uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    user_email TEXT;
BEGIN
    -- Get email from auth.users table
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_id_param;
    
    RETURN user_email;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Create profiles row with display_name
  INSERT INTO public.profiles (
    id,
    email,
    email_verified,
    display_name,
    created_at,
    updated_at,
    last_seen_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), -- Use display_name from meta or email prefix
    COALESCE(NEW.created_at, now()),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name), -- Keep existing display_name if set
    updated_at = now();

  -- Create user_preferences row
  INSERT INTO public.user_preferences (
    user_id,
    email_notifications_enabled,
    client_view_mode,
    tts_voice,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    true, -- Default to enabled
    'grid', -- Default view mode
    'Puck', -- Default voice
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Don't update if already exists
  
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_public_conversation_participant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When conversation becomes public, ensure owner is a participant
  IF NEW.is_public = true AND (OLD.is_public IS NULL OR OLD.is_public = false) THEN
    -- Insert owner as participant if not already there
    INSERT INTO conversations_participants (conversation_id, user_id, role, invited_by)
    VALUES (NEW.id, NEW.owner_user_id, 'owner', NEW.owner_user_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
create type "public"."http_header" as ("field" character varying, "value" character varying);
create type "public"."http_request" as ("method" public.http_method, "uri" character varying, "headers" public.http_header[], "content_type" character varying, "content" character varying);
create type "public"."http_response" as ("status" integer, "content_type" character varying, "headers" public.http_header[], "content" character varying);
CREATE OR REPLACE FUNCTION public.is_user_verified(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT email_verified FROM public.profiles WHERE id = _user_id),
    false
  );
$function$;
CREATE OR REPLACE FUNCTION public.log_message_cascade_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.cascade_deletion_log (table_name, record_id, parent_table, parent_id)
  VALUES ('messages', OLD.id, 'conversations', OLD.chat_id);
  RETURN OLD;
END;
$function$;
CREATE OR REPLACE FUNCTION public.log_modal_ready_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Log the modal_ready change for debugging
  INSERT INTO debug_logs(source, message, details)
  VALUES (
    'trg_notify', 
    'set modal_ready', 
    jsonb_build_object(
      'guest_report_id', NEW.id,
      'user_id', NEW.user_id,
      'old_modal_ready', OLD.modal_ready,
      'new_modal_ready', NEW.modal_ready,
      'timestamp', NOW()
    )
  );
  
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.log_summary_cascade_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.cascade_deletion_log (table_name, record_id, parent_table, parent_id)
  VALUES ('message_block_summaries', OLD.id, 'conversations', OLD.chat_id);
  RETURN OLD;
END;
$function$;
CREATE OR REPLACE FUNCTION public.mark_profile_verified(user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  confirmed_at timestamptz;
  effective_user uuid := user_id;
BEGIN
  IF effective_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Read from auth.users (allowed in SECURITY DEFINER)
  SELECT u.email_confirmed_at
  INTO confirmed_at
  FROM auth.users u
  WHERE u.id = effective_user;

  IF confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET email_verified = true,
        verification_status = 'verified',
        updated_at = now()
    WHERE id = effective_user;

    RETURN true;
  END IF;

  RETURN false;
END;
$function$;
CREATE OR REPLACE FUNCTION public.rpc_notify_orchestrator(guest_report_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  response json;
  status_code integer;
  error_msg text;
BEGIN
  BEGIN
    -- Send the HTTP POST and capture the response
    SELECT net.http_post(
      url := 'https://wrvqqvqvwqmfdqvqmaar.supabase.co/functions/v1/orchestrate-report-ready',
      body := jsonb_build_object('guest_report_id', guest_report_id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydnFxdnF2d3FtZmRxdnFtYWFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTU4MDQ2MiwiZXhwIjoyMDYxMTU2NDYyfQ.lmtvouakq3-TxFH7nmUCpw9Gl5dO1ejyg76S3DBd82E'
      )
    ) INTO response;

    -- Get the status code from the response
    status_code := (response ->> 'status')::int;

    -- Log success or failure
    IF status_code != 200 THEN
      error_msg := COALESCE(response ->> 'body', 'Unknown error');
      INSERT INTO debug_logs (source, message, label, details)
      VALUES ('rpc_notify_orchestrator', 'HTTP request failed', 'failure', jsonb_build_object(
        'guest_report_id', guest_report_id,
        'status_code', status_code,
        'error', error_msg
      ));
    ELSE
      INSERT INTO debug_logs (source, message, label, details)
      VALUES ('rpc_notify_orchestrator', 'HTTP request successful', 'success', jsonb_build_object(
        'guest_report_id', guest_report_id,
        'status_code', status_code
      ));
    END IF;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('rpc_notify_orchestrator', 'Unhandled exception', 'error', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'exception', SQLERRM
    ));
  END;
END;
$function$;
CREATE OR REPLACE FUNCTION public.send_notification_email(template_type text, recipient_email text, variables jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  template_record RECORD;
BEGIN
  -- Get the template
  SELECT * INTO template_record
  FROM public.email_notification_templates
  WHERE template_type = template_type;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email template % not found', template_type;
  END IF;
  
  -- In a real implementation, you would call an email sending service here
  -- For now, we'll just log the attempt
  INSERT INTO public.admin_logs 
    (page, event_type, logs, meta)
  VALUES 
    ('EmailSystem', 'send_notification', 
    'Email notification ' || template_type || ' queued for ' || recipient_email,
    jsonb_build_object(
      'template_type', template_type,
      'recipient', recipient_email,
      'variables', variables,
      'subject', template_record.subject
    ));
  
  -- In production, you would return true only if the email was actually sent
  RETURN true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_has_report_flag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.report_log_id IS NULL AND NEW.report_log_id IS NOT NULL THEN
    NEW.has_report = true;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_report_error_flag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Set has_error to true if error_message is not null and not empty
  IF NEW.error_message IS NOT NULL AND TRIM(NEW.error_message) != '' THEN
    NEW.has_error = true;
  ELSE
    NEW.has_error = false;
  END IF;
  
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.sync_active_payment_method()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.active_payment_method (
    id,
    user_id,
    ts,
    stripe_pid,
    email,
    country,
    postal_code,
    card_last4,
    card_brand,
    stripe_customer_id,
    billing_name,
    billing_address_line1,
    billing_address_line2,
    city,
    state,
    payment_method_type,
    payment_status,
    stripe_payment_method_id,
    exp_month,
    exp_year,
    fingerprint,
    is_default
  )
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.ts,
    NEW.stripe_pid,
    NEW.email,
    NEW.country,
    NEW.postal_code,
    NEW.card_last4,
    NEW.card_brand,
    NEW.stripe_customer_id,
    NEW.billing_name,
    NEW.billing_address_line1,
    NEW.billing_address_line2,
    NEW.city,
    NEW.state,
    NEW.payment_method_type,
    NEW.payment_status,
    NEW.stripe_payment_method_id,
    NEW.exp_month,
    NEW.exp_year,
    NEW.fingerprint,
    NEW.is_default
  )
  ON CONFLICT (user_id) DO UPDATE SET
    id                     = EXCLUDED.id,
    ts                     = EXCLUDED.ts,
    stripe_pid             = EXCLUDED.stripe_pid,
    email                  = EXCLUDED.email,
    country                = EXCLUDED.country,
    postal_code            = EXCLUDED.postal_code,
    card_last4             = EXCLUDED.card_last4,
    card_brand             = EXCLUDED.card_brand,
    stripe_customer_id     = EXCLUDED.stripe_customer_id,
    billing_name           = EXCLUDED.billing_name,
    billing_address_line1  = EXCLUDED.billing_address_line1,
    billing_address_line2  = EXCLUDED.billing_address_line2,
    city                   = EXCLUDED.city,
    state                  = EXCLUDED.state,
    payment_method_type    = EXCLUDED.payment_method_type,
    payment_status         = EXCLUDED.payment_status,
    stripe_payment_method_id = EXCLUDED.stripe_payment_method_id,
    exp_month              = EXCLUDED.exp_month,
    exp_year               = EXCLUDED.exp_year,
    fingerprint            = EXCLUDED.fingerprint,
    is_default             = EXCLUDED.is_default;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.sync_user_verification_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update if there are actual changes, don't auto-verify
  IF OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at THEN
    UPDATE public.profiles
    SET 
      updated_at = now()
      -- Remove automatic verification logic
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.debug_logs (source, message, details)
  VALUES (
    'sync_user_verification_status',
    'Failed to sync verification status',
    jsonb_build_object(
      'error', SQLERRM,
      'auth_user_id', NEW.id
    )
  );
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.toggle_addon(user_id_param uuid, addon_name text, enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF addon_name = 'transits' THEN
    UPDATE public.users SET addon_transits = enabled WHERE id = user_id_param;
  ELSIF addon_name = 'relationship' THEN
    UPDATE public.users SET addon_relationship = enabled WHERE id = user_id_param;
  ELSIF addon_name = 'yearly_cycle' THEN
    UPDATE public.users SET addon_yearly_cycle = enabled WHERE id = user_id_param;
  END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END $function$;
CREATE OR REPLACE FUNCTION public.update_api_keys_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_api_usage_costs()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  report_price NUMERIC(10,2);
  geo_price NUMERIC(10,2);
  core_price NUMERIC(10,2);
  report_tier_text TEXT;
  used_geo BOOLEAN;
BEGIN
  -- Fetch the full inserted row
  SELECT report_tier, used_geo_lookup, unit_price_usd
  INTO report_tier_text, used_geo, core_price
  FROM public.api_usage
  WHERE id = NEW.id;

  -- Look up report price (if report_tier is set)
  IF report_tier_text IS NOT NULL THEN
    SELECT unit_price_usd INTO report_price
    FROM public.price_list
    WHERE report_tier = report_tier_text;

    IF report_price IS NULL THEN
      report_price := 0;
    END IF;
  ELSE
    report_price := 0;
  END IF;

  -- Look up geo price if used_geo_lookup is true
  IF used_geo = TRUE THEN
    SELECT unit_price_usd INTO geo_price
    FROM public.price_list
    WHERE endpoint = 'geo_lookup';

    IF geo_price IS NULL THEN
      geo_price := 0;
    END IF;
  ELSE
    geo_price := 0;
  END IF;

  -- Update the inserted row
  UPDATE public.api_usage
  SET report_price_usd = report_price,
      geo_price_usd = geo_price,
      total_cost_usd = COALESCE(core_price, 0) + report_price + geo_price
  WHERE id = NEW.id;

  RETURN NULL;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_auto_topup_settings(_user_id uuid, _enabled boolean, _threshold integer, _amount integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Ensure user_credits record exists
  INSERT INTO user_credits (user_id, auto_topup_enabled, auto_topup_threshold, auto_topup_amount)
  VALUES (_user_id, _enabled, _threshold, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    auto_topup_enabled = _enabled,
    auto_topup_threshold = _threshold,
    auto_topup_amount = _amount,
    last_updated = now();
  
  RETURN true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_chat_folders_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_email_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_geo_cache_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_landing_page_config_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_service_purchases_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_stripe_flow_tracking_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_system_prompts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_token_emails_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_user_profile_list_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_voice_previews_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.upgrade_plan(user_id_param uuid, new_plan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.users 
  SET 
    plan_type = new_plan,
    calls_limit = CASE 
      WHEN new_plan = 'starter' THEN 50000
      WHEN new_plan = 'growth' THEN 200000
      WHEN new_plan = 'professional' THEN 750000
    END
  WHERE id = user_id_param;
END;
$function$;
CREATE OR REPLACE FUNCTION public.user_owns_insight(report_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.insights
        WHERE insights.id = report_id
        AND insights.user_id = auth.uid()
    );
END;
$function$;
grant delete on table "public"."admin_logs" to "anon";
grant insert on table "public"."admin_logs" to "anon";
grant references on table "public"."admin_logs" to "anon";
grant select on table "public"."admin_logs" to "anon";
grant trigger on table "public"."admin_logs" to "anon";
grant truncate on table "public"."admin_logs" to "anon";
grant update on table "public"."admin_logs" to "anon";
grant delete on table "public"."admin_logs" to "authenticated";
grant insert on table "public"."admin_logs" to "authenticated";
grant references on table "public"."admin_logs" to "authenticated";
grant select on table "public"."admin_logs" to "authenticated";
grant trigger on table "public"."admin_logs" to "authenticated";
grant truncate on table "public"."admin_logs" to "authenticated";
grant update on table "public"."admin_logs" to "authenticated";
grant delete on table "public"."admin_logs" to "service_role";
grant insert on table "public"."admin_logs" to "service_role";
grant references on table "public"."admin_logs" to "service_role";
grant select on table "public"."admin_logs" to "service_role";
grant trigger on table "public"."admin_logs" to "service_role";
grant truncate on table "public"."admin_logs" to "service_role";
grant update on table "public"."admin_logs" to "service_role";
grant delete on table "public"."api_usage" to "anon";
grant insert on table "public"."api_usage" to "anon";
grant references on table "public"."api_usage" to "anon";
grant select on table "public"."api_usage" to "anon";
grant trigger on table "public"."api_usage" to "anon";
grant truncate on table "public"."api_usage" to "anon";
grant update on table "public"."api_usage" to "anon";
grant delete on table "public"."api_usage" to "authenticated";
grant insert on table "public"."api_usage" to "authenticated";
grant references on table "public"."api_usage" to "authenticated";
grant select on table "public"."api_usage" to "authenticated";
grant trigger on table "public"."api_usage" to "authenticated";
grant truncate on table "public"."api_usage" to "authenticated";
grant update on table "public"."api_usage" to "authenticated";
grant delete on table "public"."api_usage" to "service_role";
grant insert on table "public"."api_usage" to "service_role";
grant references on table "public"."api_usage" to "service_role";
grant select on table "public"."api_usage" to "service_role";
grant trigger on table "public"."api_usage" to "service_role";
grant truncate on table "public"."api_usage" to "service_role";
grant update on table "public"."api_usage" to "service_role";
grant delete on table "public"."blog_posts" to "anon";
grant insert on table "public"."blog_posts" to "anon";
grant references on table "public"."blog_posts" to "anon";
grant select on table "public"."blog_posts" to "anon";
grant trigger on table "public"."blog_posts" to "anon";
grant truncate on table "public"."blog_posts" to "anon";
grant update on table "public"."blog_posts" to "anon";
grant delete on table "public"."blog_posts" to "authenticated";
grant insert on table "public"."blog_posts" to "authenticated";
grant references on table "public"."blog_posts" to "authenticated";
grant select on table "public"."blog_posts" to "authenticated";
grant trigger on table "public"."blog_posts" to "authenticated";
grant truncate on table "public"."blog_posts" to "authenticated";
grant update on table "public"."blog_posts" to "authenticated";
grant delete on table "public"."blog_posts" to "service_role";
grant insert on table "public"."blog_posts" to "service_role";
grant references on table "public"."blog_posts" to "service_role";
grant select on table "public"."blog_posts" to "service_role";
grant trigger on table "public"."blog_posts" to "service_role";
grant truncate on table "public"."blog_posts" to "service_role";
grant update on table "public"."blog_posts" to "service_role";
grant delete on table "public"."calendar_sessions" to "anon";
grant insert on table "public"."calendar_sessions" to "anon";
grant references on table "public"."calendar_sessions" to "anon";
grant select on table "public"."calendar_sessions" to "anon";
grant trigger on table "public"."calendar_sessions" to "anon";
grant truncate on table "public"."calendar_sessions" to "anon";
grant update on table "public"."calendar_sessions" to "anon";
grant delete on table "public"."calendar_sessions" to "authenticated";
grant insert on table "public"."calendar_sessions" to "authenticated";
grant references on table "public"."calendar_sessions" to "authenticated";
grant select on table "public"."calendar_sessions" to "authenticated";
grant trigger on table "public"."calendar_sessions" to "authenticated";
grant truncate on table "public"."calendar_sessions" to "authenticated";
grant update on table "public"."calendar_sessions" to "authenticated";
grant delete on table "public"."calendar_sessions" to "service_role";
grant insert on table "public"."calendar_sessions" to "service_role";
grant references on table "public"."calendar_sessions" to "service_role";
grant select on table "public"."calendar_sessions" to "service_role";
grant trigger on table "public"."calendar_sessions" to "service_role";
grant truncate on table "public"."calendar_sessions" to "service_role";
grant update on table "public"."calendar_sessions" to "service_role";
grant delete on table "public"."cascade_deletion_log" to "anon";
grant insert on table "public"."cascade_deletion_log" to "anon";
grant references on table "public"."cascade_deletion_log" to "anon";
grant select on table "public"."cascade_deletion_log" to "anon";
grant trigger on table "public"."cascade_deletion_log" to "anon";
grant truncate on table "public"."cascade_deletion_log" to "anon";
grant update on table "public"."cascade_deletion_log" to "anon";
grant delete on table "public"."cascade_deletion_log" to "authenticated";
grant insert on table "public"."cascade_deletion_log" to "authenticated";
grant references on table "public"."cascade_deletion_log" to "authenticated";
grant select on table "public"."cascade_deletion_log" to "authenticated";
grant trigger on table "public"."cascade_deletion_log" to "authenticated";
grant truncate on table "public"."cascade_deletion_log" to "authenticated";
grant update on table "public"."cascade_deletion_log" to "authenticated";
grant delete on table "public"."cascade_deletion_log" to "service_role";
grant insert on table "public"."cascade_deletion_log" to "service_role";
grant references on table "public"."cascade_deletion_log" to "service_role";
grant select on table "public"."cascade_deletion_log" to "service_role";
grant trigger on table "public"."cascade_deletion_log" to "service_role";
grant truncate on table "public"."cascade_deletion_log" to "service_role";
grant update on table "public"."cascade_deletion_log" to "service_role";
grant delete on table "public"."chat_folders" to "anon";
grant insert on table "public"."chat_folders" to "anon";
grant references on table "public"."chat_folders" to "anon";
grant select on table "public"."chat_folders" to "anon";
grant trigger on table "public"."chat_folders" to "anon";
grant truncate on table "public"."chat_folders" to "anon";
grant update on table "public"."chat_folders" to "anon";
grant delete on table "public"."chat_folders" to "authenticated";
grant insert on table "public"."chat_folders" to "authenticated";
grant references on table "public"."chat_folders" to "authenticated";
grant select on table "public"."chat_folders" to "authenticated";
grant trigger on table "public"."chat_folders" to "authenticated";
grant truncate on table "public"."chat_folders" to "authenticated";
grant update on table "public"."chat_folders" to "authenticated";
grant delete on table "public"."chat_folders" to "service_role";
grant insert on table "public"."chat_folders" to "service_role";
grant references on table "public"."chat_folders" to "service_role";
grant select on table "public"."chat_folders" to "service_role";
grant trigger on table "public"."chat_folders" to "service_role";
grant truncate on table "public"."chat_folders" to "service_role";
grant update on table "public"."chat_folders" to "service_role";
grant delete on table "public"."conversation_caches" to "anon";
grant insert on table "public"."conversation_caches" to "anon";
grant references on table "public"."conversation_caches" to "anon";
grant select on table "public"."conversation_caches" to "anon";
grant trigger on table "public"."conversation_caches" to "anon";
grant truncate on table "public"."conversation_caches" to "anon";
grant update on table "public"."conversation_caches" to "anon";
grant delete on table "public"."conversation_caches" to "authenticated";
grant insert on table "public"."conversation_caches" to "authenticated";
grant references on table "public"."conversation_caches" to "authenticated";
grant select on table "public"."conversation_caches" to "authenticated";
grant trigger on table "public"."conversation_caches" to "authenticated";
grant truncate on table "public"."conversation_caches" to "authenticated";
grant update on table "public"."conversation_caches" to "authenticated";
grant delete on table "public"."conversation_caches" to "service_role";
grant insert on table "public"."conversation_caches" to "service_role";
grant references on table "public"."conversation_caches" to "service_role";
grant select on table "public"."conversation_caches" to "service_role";
grant trigger on table "public"."conversation_caches" to "service_role";
grant truncate on table "public"."conversation_caches" to "service_role";
grant update on table "public"."conversation_caches" to "service_role";
grant delete on table "public"."conversation_summaries" to "anon";
grant insert on table "public"."conversation_summaries" to "anon";
grant references on table "public"."conversation_summaries" to "anon";
grant select on table "public"."conversation_summaries" to "anon";
grant trigger on table "public"."conversation_summaries" to "anon";
grant truncate on table "public"."conversation_summaries" to "anon";
grant update on table "public"."conversation_summaries" to "anon";
grant delete on table "public"."conversation_summaries" to "authenticated";
grant insert on table "public"."conversation_summaries" to "authenticated";
grant references on table "public"."conversation_summaries" to "authenticated";
grant select on table "public"."conversation_summaries" to "authenticated";
grant trigger on table "public"."conversation_summaries" to "authenticated";
grant truncate on table "public"."conversation_summaries" to "authenticated";
grant update on table "public"."conversation_summaries" to "authenticated";
grant delete on table "public"."conversation_summaries" to "service_role";
grant insert on table "public"."conversation_summaries" to "service_role";
grant references on table "public"."conversation_summaries" to "service_role";
grant select on table "public"."conversation_summaries" to "service_role";
grant trigger on table "public"."conversation_summaries" to "service_role";
grant truncate on table "public"."conversation_summaries" to "service_role";
grant update on table "public"."conversation_summaries" to "service_role";
grant delete on table "public"."conversations" to "anon";
grant insert on table "public"."conversations" to "anon";
grant references on table "public"."conversations" to "anon";
grant select on table "public"."conversations" to "anon";
grant trigger on table "public"."conversations" to "anon";
grant truncate on table "public"."conversations" to "anon";
grant update on table "public"."conversations" to "anon";
grant delete on table "public"."conversations" to "authenticated";
grant insert on table "public"."conversations" to "authenticated";
grant references on table "public"."conversations" to "authenticated";
grant select on table "public"."conversations" to "authenticated";
grant trigger on table "public"."conversations" to "authenticated";
grant truncate on table "public"."conversations" to "authenticated";
grant update on table "public"."conversations" to "authenticated";
grant delete on table "public"."conversations" to "service_role";
grant insert on table "public"."conversations" to "service_role";
grant references on table "public"."conversations" to "service_role";
grant select on table "public"."conversations" to "service_role";
grant trigger on table "public"."conversations" to "service_role";
grant truncate on table "public"."conversations" to "service_role";
grant update on table "public"."conversations" to "service_role";
grant delete on table "public"."conversations_participants" to "anon";
grant insert on table "public"."conversations_participants" to "anon";
grant references on table "public"."conversations_participants" to "anon";
grant select on table "public"."conversations_participants" to "anon";
grant trigger on table "public"."conversations_participants" to "anon";
grant truncate on table "public"."conversations_participants" to "anon";
grant update on table "public"."conversations_participants" to "anon";
grant delete on table "public"."conversations_participants" to "authenticated";
grant insert on table "public"."conversations_participants" to "authenticated";
grant references on table "public"."conversations_participants" to "authenticated";
grant select on table "public"."conversations_participants" to "authenticated";
grant trigger on table "public"."conversations_participants" to "authenticated";
grant truncate on table "public"."conversations_participants" to "authenticated";
grant update on table "public"."conversations_participants" to "authenticated";
grant delete on table "public"."conversations_participants" to "service_role";
grant insert on table "public"."conversations_participants" to "service_role";
grant references on table "public"."conversations_participants" to "service_role";
grant select on table "public"."conversations_participants" to "service_role";
grant trigger on table "public"."conversations_participants" to "service_role";
grant truncate on table "public"."conversations_participants" to "service_role";
grant update on table "public"."conversations_participants" to "service_role";
grant delete on table "public"."credit_transactions" to "anon";
grant insert on table "public"."credit_transactions" to "anon";
grant references on table "public"."credit_transactions" to "anon";
grant select on table "public"."credit_transactions" to "anon";
grant trigger on table "public"."credit_transactions" to "anon";
grant truncate on table "public"."credit_transactions" to "anon";
grant update on table "public"."credit_transactions" to "anon";
grant delete on table "public"."credit_transactions" to "authenticated";
grant insert on table "public"."credit_transactions" to "authenticated";
grant references on table "public"."credit_transactions" to "authenticated";
grant select on table "public"."credit_transactions" to "authenticated";
grant trigger on table "public"."credit_transactions" to "authenticated";
grant truncate on table "public"."credit_transactions" to "authenticated";
grant update on table "public"."credit_transactions" to "authenticated";
grant delete on table "public"."credit_transactions" to "service_role";
grant insert on table "public"."credit_transactions" to "service_role";
grant references on table "public"."credit_transactions" to "service_role";
grant select on table "public"."credit_transactions" to "service_role";
grant trigger on table "public"."credit_transactions" to "service_role";
grant truncate on table "public"."credit_transactions" to "service_role";
grant update on table "public"."credit_transactions" to "service_role";
grant delete on table "public"."debug_logs" to "anon";
grant insert on table "public"."debug_logs" to "anon";
grant references on table "public"."debug_logs" to "anon";
grant select on table "public"."debug_logs" to "anon";
grant trigger on table "public"."debug_logs" to "anon";
grant truncate on table "public"."debug_logs" to "anon";
grant update on table "public"."debug_logs" to "anon";
grant delete on table "public"."debug_logs" to "authenticated";
grant insert on table "public"."debug_logs" to "authenticated";
grant references on table "public"."debug_logs" to "authenticated";
grant select on table "public"."debug_logs" to "authenticated";
grant trigger on table "public"."debug_logs" to "authenticated";
grant truncate on table "public"."debug_logs" to "authenticated";
grant update on table "public"."debug_logs" to "authenticated";
grant delete on table "public"."debug_logs" to "service_role";
grant insert on table "public"."debug_logs" to "service_role";
grant references on table "public"."debug_logs" to "service_role";
grant select on table "public"."debug_logs" to "service_role";
grant trigger on table "public"."debug_logs" to "service_role";
grant truncate on table "public"."debug_logs" to "service_role";
grant update on table "public"."debug_logs" to "service_role";
grant delete on table "public"."domain_slugs" to "anon";
grant insert on table "public"."domain_slugs" to "anon";
grant references on table "public"."domain_slugs" to "anon";
grant select on table "public"."domain_slugs" to "anon";
grant trigger on table "public"."domain_slugs" to "anon";
grant truncate on table "public"."domain_slugs" to "anon";
grant update on table "public"."domain_slugs" to "anon";
grant delete on table "public"."domain_slugs" to "authenticated";
grant insert on table "public"."domain_slugs" to "authenticated";
grant references on table "public"."domain_slugs" to "authenticated";
grant select on table "public"."domain_slugs" to "authenticated";
grant trigger on table "public"."domain_slugs" to "authenticated";
grant truncate on table "public"."domain_slugs" to "authenticated";
grant update on table "public"."domain_slugs" to "authenticated";
grant delete on table "public"."domain_slugs" to "service_role";
grant insert on table "public"."domain_slugs" to "service_role";
grant references on table "public"."domain_slugs" to "service_role";
grant select on table "public"."domain_slugs" to "service_role";
grant trigger on table "public"."domain_slugs" to "service_role";
grant truncate on table "public"."domain_slugs" to "service_role";
grant update on table "public"."domain_slugs" to "service_role";
grant delete on table "public"."email_messages" to "anon";
grant insert on table "public"."email_messages" to "anon";
grant references on table "public"."email_messages" to "anon";
grant select on table "public"."email_messages" to "anon";
grant trigger on table "public"."email_messages" to "anon";
grant truncate on table "public"."email_messages" to "anon";
grant update on table "public"."email_messages" to "anon";
grant delete on table "public"."email_messages" to "authenticated";
grant insert on table "public"."email_messages" to "authenticated";
grant references on table "public"."email_messages" to "authenticated";
grant select on table "public"."email_messages" to "authenticated";
grant trigger on table "public"."email_messages" to "authenticated";
grant truncate on table "public"."email_messages" to "authenticated";
grant update on table "public"."email_messages" to "authenticated";
grant delete on table "public"."email_messages" to "service_role";
grant insert on table "public"."email_messages" to "service_role";
grant references on table "public"."email_messages" to "service_role";
grant select on table "public"."email_messages" to "service_role";
grant trigger on table "public"."email_messages" to "service_role";
grant truncate on table "public"."email_messages" to "service_role";
grant update on table "public"."email_messages" to "service_role";
grant delete on table "public"."email_notification_templates" to "anon";
grant insert on table "public"."email_notification_templates" to "anon";
grant references on table "public"."email_notification_templates" to "anon";
grant select on table "public"."email_notification_templates" to "anon";
grant trigger on table "public"."email_notification_templates" to "anon";
grant truncate on table "public"."email_notification_templates" to "anon";
grant update on table "public"."email_notification_templates" to "anon";
grant delete on table "public"."email_notification_templates" to "authenticated";
grant insert on table "public"."email_notification_templates" to "authenticated";
grant references on table "public"."email_notification_templates" to "authenticated";
grant select on table "public"."email_notification_templates" to "authenticated";
grant trigger on table "public"."email_notification_templates" to "authenticated";
grant truncate on table "public"."email_notification_templates" to "authenticated";
grant update on table "public"."email_notification_templates" to "authenticated";
grant delete on table "public"."email_notification_templates" to "service_role";
grant insert on table "public"."email_notification_templates" to "service_role";
grant references on table "public"."email_notification_templates" to "service_role";
grant select on table "public"."email_notification_templates" to "service_role";
grant trigger on table "public"."email_notification_templates" to "service_role";
grant truncate on table "public"."email_notification_templates" to "service_role";
grant update on table "public"."email_notification_templates" to "service_role";
grant delete on table "public"."geo_cache" to "anon";
grant insert on table "public"."geo_cache" to "anon";
grant references on table "public"."geo_cache" to "anon";
grant select on table "public"."geo_cache" to "anon";
grant trigger on table "public"."geo_cache" to "anon";
grant truncate on table "public"."geo_cache" to "anon";
grant update on table "public"."geo_cache" to "anon";
grant delete on table "public"."geo_cache" to "authenticated";
grant insert on table "public"."geo_cache" to "authenticated";
grant references on table "public"."geo_cache" to "authenticated";
grant select on table "public"."geo_cache" to "authenticated";
grant trigger on table "public"."geo_cache" to "authenticated";
grant truncate on table "public"."geo_cache" to "authenticated";
grant update on table "public"."geo_cache" to "authenticated";
grant delete on table "public"."geo_cache" to "service_role";
grant insert on table "public"."geo_cache" to "service_role";
grant references on table "public"."geo_cache" to "service_role";
grant select on table "public"."geo_cache" to "service_role";
grant trigger on table "public"."geo_cache" to "service_role";
grant truncate on table "public"."geo_cache" to "service_role";
grant update on table "public"."geo_cache" to "service_role";
grant delete on table "public"."insights" to "anon";
grant insert on table "public"."insights" to "anon";
grant references on table "public"."insights" to "anon";
grant select on table "public"."insights" to "anon";
grant trigger on table "public"."insights" to "anon";
grant truncate on table "public"."insights" to "anon";
grant update on table "public"."insights" to "anon";
grant delete on table "public"."insights" to "authenticated";
grant insert on table "public"."insights" to "authenticated";
grant references on table "public"."insights" to "authenticated";
grant select on table "public"."insights" to "authenticated";
grant trigger on table "public"."insights" to "authenticated";
grant truncate on table "public"."insights" to "authenticated";
grant update on table "public"."insights" to "authenticated";
grant delete on table "public"."insights" to "service_role";
grant insert on table "public"."insights" to "service_role";
grant references on table "public"."insights" to "service_role";
grant select on table "public"."insights" to "service_role";
grant trigger on table "public"."insights" to "service_role";
grant truncate on table "public"."insights" to "service_role";
grant update on table "public"."insights" to "service_role";
grant delete on table "public"."ip_allowlist" to "anon";
grant insert on table "public"."ip_allowlist" to "anon";
grant references on table "public"."ip_allowlist" to "anon";
grant select on table "public"."ip_allowlist" to "anon";
grant trigger on table "public"."ip_allowlist" to "anon";
grant truncate on table "public"."ip_allowlist" to "anon";
grant update on table "public"."ip_allowlist" to "anon";
grant delete on table "public"."ip_allowlist" to "authenticated";
grant insert on table "public"."ip_allowlist" to "authenticated";
grant references on table "public"."ip_allowlist" to "authenticated";
grant select on table "public"."ip_allowlist" to "authenticated";
grant trigger on table "public"."ip_allowlist" to "authenticated";
grant truncate on table "public"."ip_allowlist" to "authenticated";
grant update on table "public"."ip_allowlist" to "authenticated";
grant delete on table "public"."ip_allowlist" to "service_role";
grant insert on table "public"."ip_allowlist" to "service_role";
grant references on table "public"."ip_allowlist" to "service_role";
grant select on table "public"."ip_allowlist" to "service_role";
grant trigger on table "public"."ip_allowlist" to "service_role";
grant truncate on table "public"."ip_allowlist" to "service_role";
grant update on table "public"."ip_allowlist" to "service_role";
grant delete on table "public"."journal_entries" to "anon";
grant insert on table "public"."journal_entries" to "anon";
grant references on table "public"."journal_entries" to "anon";
grant select on table "public"."journal_entries" to "anon";
grant trigger on table "public"."journal_entries" to "anon";
grant truncate on table "public"."journal_entries" to "anon";
grant update on table "public"."journal_entries" to "anon";
grant delete on table "public"."journal_entries" to "authenticated";
grant insert on table "public"."journal_entries" to "authenticated";
grant references on table "public"."journal_entries" to "authenticated";
grant select on table "public"."journal_entries" to "authenticated";
grant trigger on table "public"."journal_entries" to "authenticated";
grant truncate on table "public"."journal_entries" to "authenticated";
grant update on table "public"."journal_entries" to "authenticated";
grant delete on table "public"."journal_entries" to "service_role";
grant insert on table "public"."journal_entries" to "service_role";
grant references on table "public"."journal_entries" to "service_role";
grant select on table "public"."journal_entries" to "service_role";
grant trigger on table "public"."journal_entries" to "service_role";
grant truncate on table "public"."journal_entries" to "service_role";
grant update on table "public"."journal_entries" to "service_role";
grant delete on table "public"."landing_page_config" to "anon";
grant insert on table "public"."landing_page_config" to "anon";
grant references on table "public"."landing_page_config" to "anon";
grant select on table "public"."landing_page_config" to "anon";
grant trigger on table "public"."landing_page_config" to "anon";
grant truncate on table "public"."landing_page_config" to "anon";
grant update on table "public"."landing_page_config" to "anon";
grant delete on table "public"."landing_page_config" to "authenticated";
grant insert on table "public"."landing_page_config" to "authenticated";
grant references on table "public"."landing_page_config" to "authenticated";
grant select on table "public"."landing_page_config" to "authenticated";
grant trigger on table "public"."landing_page_config" to "authenticated";
grant truncate on table "public"."landing_page_config" to "authenticated";
grant update on table "public"."landing_page_config" to "authenticated";
grant delete on table "public"."landing_page_config" to "service_role";
grant insert on table "public"."landing_page_config" to "service_role";
grant references on table "public"."landing_page_config" to "service_role";
grant select on table "public"."landing_page_config" to "service_role";
grant trigger on table "public"."landing_page_config" to "service_role";
grant truncate on table "public"."landing_page_config" to "service_role";
grant update on table "public"."landing_page_config" to "service_role";
grant delete on table "public"."legal_documents" to "anon";
grant insert on table "public"."legal_documents" to "anon";
grant references on table "public"."legal_documents" to "anon";
grant select on table "public"."legal_documents" to "anon";
grant trigger on table "public"."legal_documents" to "anon";
grant truncate on table "public"."legal_documents" to "anon";
grant update on table "public"."legal_documents" to "anon";
grant delete on table "public"."legal_documents" to "authenticated";
grant insert on table "public"."legal_documents" to "authenticated";
grant references on table "public"."legal_documents" to "authenticated";
grant select on table "public"."legal_documents" to "authenticated";
grant trigger on table "public"."legal_documents" to "authenticated";
grant truncate on table "public"."legal_documents" to "authenticated";
grant update on table "public"."legal_documents" to "authenticated";
grant delete on table "public"."legal_documents" to "service_role";
grant insert on table "public"."legal_documents" to "service_role";
grant references on table "public"."legal_documents" to "service_role";
grant select on table "public"."legal_documents" to "service_role";
grant trigger on table "public"."legal_documents" to "service_role";
grant truncate on table "public"."legal_documents" to "service_role";
grant update on table "public"."legal_documents" to "service_role";
grant insert on table "public"."messages" to "anon";
grant select on table "public"."messages" to "anon";
grant update on table "public"."messages" to "anon";
grant delete on table "public"."messages" to "authenticated";
grant insert on table "public"."messages" to "authenticated";
grant references on table "public"."messages" to "authenticated";
grant select on table "public"."messages" to "authenticated";
grant trigger on table "public"."messages" to "authenticated";
grant truncate on table "public"."messages" to "authenticated";
grant update on table "public"."messages" to "authenticated";
grant delete on table "public"."messages" to "service_role";
grant insert on table "public"."messages" to "service_role";
grant references on table "public"."messages" to "service_role";
grant select on table "public"."messages" to "service_role";
grant trigger on table "public"."messages" to "service_role";
grant truncate on table "public"."messages" to "service_role";
grant update on table "public"."messages" to "service_role";
grant delete on table "public"."password_reset_tokens" to "anon";
grant insert on table "public"."password_reset_tokens" to "anon";
grant references on table "public"."password_reset_tokens" to "anon";
grant select on table "public"."password_reset_tokens" to "anon";
grant trigger on table "public"."password_reset_tokens" to "anon";
grant truncate on table "public"."password_reset_tokens" to "anon";
grant update on table "public"."password_reset_tokens" to "anon";
grant delete on table "public"."password_reset_tokens" to "authenticated";
grant insert on table "public"."password_reset_tokens" to "authenticated";
grant references on table "public"."password_reset_tokens" to "authenticated";
grant select on table "public"."password_reset_tokens" to "authenticated";
grant trigger on table "public"."password_reset_tokens" to "authenticated";
grant truncate on table "public"."password_reset_tokens" to "authenticated";
grant update on table "public"."password_reset_tokens" to "authenticated";
grant delete on table "public"."password_reset_tokens" to "service_role";
grant insert on table "public"."password_reset_tokens" to "service_role";
grant references on table "public"."password_reset_tokens" to "service_role";
grant select on table "public"."password_reset_tokens" to "service_role";
grant trigger on table "public"."password_reset_tokens" to "service_role";
grant truncate on table "public"."password_reset_tokens" to "service_role";
grant update on table "public"."password_reset_tokens" to "service_role";
grant delete on table "public"."payment_method" to "anon";
grant insert on table "public"."payment_method" to "anon";
grant references on table "public"."payment_method" to "anon";
grant select on table "public"."payment_method" to "anon";
grant trigger on table "public"."payment_method" to "anon";
grant truncate on table "public"."payment_method" to "anon";
grant update on table "public"."payment_method" to "anon";
grant delete on table "public"."payment_method" to "authenticated";
grant insert on table "public"."payment_method" to "authenticated";
grant references on table "public"."payment_method" to "authenticated";
grant select on table "public"."payment_method" to "authenticated";
grant trigger on table "public"."payment_method" to "authenticated";
grant truncate on table "public"."payment_method" to "authenticated";
grant update on table "public"."payment_method" to "authenticated";
grant delete on table "public"."payment_method" to "service_role";
grant insert on table "public"."payment_method" to "service_role";
grant references on table "public"."payment_method" to "service_role";
grant select on table "public"."payment_method" to "service_role";
grant trigger on table "public"."payment_method" to "service_role";
grant truncate on table "public"."payment_method" to "service_role";
grant update on table "public"."payment_method" to "service_role";
grant references on table "public"."price_list" to "anon";
grant select on table "public"."price_list" to "anon";
grant trigger on table "public"."price_list" to "anon";
grant truncate on table "public"."price_list" to "anon";
grant references on table "public"."price_list" to "authenticated";
grant select on table "public"."price_list" to "authenticated";
grant trigger on table "public"."price_list" to "authenticated";
grant truncate on table "public"."price_list" to "authenticated";
grant delete on table "public"."price_list" to "service_role";
grant insert on table "public"."price_list" to "service_role";
grant references on table "public"."price_list" to "service_role";
grant select on table "public"."price_list" to "service_role";
grant trigger on table "public"."price_list" to "service_role";
grant truncate on table "public"."price_list" to "service_role";
grant update on table "public"."price_list" to "service_role";
grant delete on table "public"."profiles" to "anon";
grant insert on table "public"."profiles" to "anon";
grant references on table "public"."profiles" to "anon";
grant select on table "public"."profiles" to "anon";
grant trigger on table "public"."profiles" to "anon";
grant truncate on table "public"."profiles" to "anon";
grant update on table "public"."profiles" to "anon";
grant delete on table "public"."profiles" to "authenticated";
grant insert on table "public"."profiles" to "authenticated";
grant references on table "public"."profiles" to "authenticated";
grant select on table "public"."profiles" to "authenticated";
grant trigger on table "public"."profiles" to "authenticated";
grant truncate on table "public"."profiles" to "authenticated";
grant update on table "public"."profiles" to "authenticated";
grant delete on table "public"."profiles" to "service_role";
grant insert on table "public"."profiles" to "service_role";
grant references on table "public"."profiles" to "service_role";
grant select on table "public"."profiles" to "service_role";
grant trigger on table "public"."profiles" to "service_role";
grant truncate on table "public"."profiles" to "service_role";
grant update on table "public"."profiles" to "service_role";
grant delete on table "public"."promo_codes" to "anon";
grant insert on table "public"."promo_codes" to "anon";
grant references on table "public"."promo_codes" to "anon";
grant select on table "public"."promo_codes" to "anon";
grant trigger on table "public"."promo_codes" to "anon";
grant truncate on table "public"."promo_codes" to "anon";
grant update on table "public"."promo_codes" to "anon";
grant delete on table "public"."promo_codes" to "authenticated";
grant insert on table "public"."promo_codes" to "authenticated";
grant references on table "public"."promo_codes" to "authenticated";
grant select on table "public"."promo_codes" to "authenticated";
grant trigger on table "public"."promo_codes" to "authenticated";
grant truncate on table "public"."promo_codes" to "authenticated";
grant update on table "public"."promo_codes" to "authenticated";
grant delete on table "public"."promo_codes" to "service_role";
grant insert on table "public"."promo_codes" to "service_role";
grant references on table "public"."promo_codes" to "service_role";
grant select on table "public"."promo_codes" to "service_role";
grant trigger on table "public"."promo_codes" to "service_role";
grant truncate on table "public"."promo_codes" to "service_role";
grant update on table "public"."promo_codes" to "service_role";
grant delete on table "public"."report_logs" to "anon";
grant insert on table "public"."report_logs" to "anon";
grant references on table "public"."report_logs" to "anon";
grant select on table "public"."report_logs" to "anon";
grant trigger on table "public"."report_logs" to "anon";
grant truncate on table "public"."report_logs" to "anon";
grant update on table "public"."report_logs" to "anon";
grant delete on table "public"."report_logs" to "authenticated";
grant insert on table "public"."report_logs" to "authenticated";
grant references on table "public"."report_logs" to "authenticated";
grant select on table "public"."report_logs" to "authenticated";
grant trigger on table "public"."report_logs" to "authenticated";
grant truncate on table "public"."report_logs" to "authenticated";
grant update on table "public"."report_logs" to "authenticated";
grant delete on table "public"."report_logs" to "service_role";
grant insert on table "public"."report_logs" to "service_role";
grant references on table "public"."report_logs" to "service_role";
grant select on table "public"."report_logs" to "service_role";
grant trigger on table "public"."report_logs" to "service_role";
grant truncate on table "public"."report_logs" to "service_role";
grant update on table "public"."report_logs" to "service_role";
grant delete on table "public"."report_prompts" to "anon";
grant insert on table "public"."report_prompts" to "anon";
grant references on table "public"."report_prompts" to "anon";
grant select on table "public"."report_prompts" to "anon";
grant trigger on table "public"."report_prompts" to "anon";
grant truncate on table "public"."report_prompts" to "anon";
grant update on table "public"."report_prompts" to "anon";
grant delete on table "public"."report_prompts" to "authenticated";
grant insert on table "public"."report_prompts" to "authenticated";
grant references on table "public"."report_prompts" to "authenticated";
grant select on table "public"."report_prompts" to "authenticated";
grant trigger on table "public"."report_prompts" to "authenticated";
grant truncate on table "public"."report_prompts" to "authenticated";
grant update on table "public"."report_prompts" to "authenticated";
grant delete on table "public"."report_prompts" to "service_role";
grant insert on table "public"."report_prompts" to "service_role";
grant references on table "public"."report_prompts" to "service_role";
grant select on table "public"."report_prompts" to "service_role";
grant trigger on table "public"."report_prompts" to "service_role";
grant truncate on table "public"."report_prompts" to "service_role";
grant update on table "public"."report_prompts" to "service_role";
grant delete on table "public"."stripe_products" to "anon";
grant insert on table "public"."stripe_products" to "anon";
grant references on table "public"."stripe_products" to "anon";
grant select on table "public"."stripe_products" to "anon";
grant trigger on table "public"."stripe_products" to "anon";
grant truncate on table "public"."stripe_products" to "anon";
grant update on table "public"."stripe_products" to "anon";
grant delete on table "public"."stripe_products" to "authenticated";
grant insert on table "public"."stripe_products" to "authenticated";
grant references on table "public"."stripe_products" to "authenticated";
grant select on table "public"."stripe_products" to "authenticated";
grant trigger on table "public"."stripe_products" to "authenticated";
grant truncate on table "public"."stripe_products" to "authenticated";
grant update on table "public"."stripe_products" to "authenticated";
grant delete on table "public"."stripe_products" to "service_role";
grant insert on table "public"."stripe_products" to "service_role";
grant references on table "public"."stripe_products" to "service_role";
grant select on table "public"."stripe_products" to "service_role";
grant trigger on table "public"."stripe_products" to "service_role";
grant truncate on table "public"."stripe_products" to "service_role";
grant update on table "public"."stripe_products" to "service_role";
grant delete on table "public"."stripe_webhook_events" to "anon";
grant insert on table "public"."stripe_webhook_events" to "anon";
grant references on table "public"."stripe_webhook_events" to "anon";
grant select on table "public"."stripe_webhook_events" to "anon";
grant trigger on table "public"."stripe_webhook_events" to "anon";
grant truncate on table "public"."stripe_webhook_events" to "anon";
grant update on table "public"."stripe_webhook_events" to "anon";
grant delete on table "public"."stripe_webhook_events" to "authenticated";
grant insert on table "public"."stripe_webhook_events" to "authenticated";
grant references on table "public"."stripe_webhook_events" to "authenticated";
grant select on table "public"."stripe_webhook_events" to "authenticated";
grant trigger on table "public"."stripe_webhook_events" to "authenticated";
grant truncate on table "public"."stripe_webhook_events" to "authenticated";
grant update on table "public"."stripe_webhook_events" to "authenticated";
grant delete on table "public"."stripe_webhook_events" to "service_role";
grant insert on table "public"."stripe_webhook_events" to "service_role";
grant references on table "public"."stripe_webhook_events" to "service_role";
grant select on table "public"."stripe_webhook_events" to "service_role";
grant trigger on table "public"."stripe_webhook_events" to "service_role";
grant truncate on table "public"."stripe_webhook_events" to "service_role";
grant update on table "public"."stripe_webhook_events" to "service_role";
grant delete on table "public"."swissdebuglogs" to "anon";
grant insert on table "public"."swissdebuglogs" to "anon";
grant references on table "public"."swissdebuglogs" to "anon";
grant select on table "public"."swissdebuglogs" to "anon";
grant trigger on table "public"."swissdebuglogs" to "anon";
grant truncate on table "public"."swissdebuglogs" to "anon";
grant update on table "public"."swissdebuglogs" to "anon";
grant delete on table "public"."swissdebuglogs" to "authenticated";
grant insert on table "public"."swissdebuglogs" to "authenticated";
grant references on table "public"."swissdebuglogs" to "authenticated";
grant select on table "public"."swissdebuglogs" to "authenticated";
grant trigger on table "public"."swissdebuglogs" to "authenticated";
grant truncate on table "public"."swissdebuglogs" to "authenticated";
grant update on table "public"."swissdebuglogs" to "authenticated";
grant delete on table "public"."swissdebuglogs" to "service_role";
grant insert on table "public"."swissdebuglogs" to "service_role";
grant references on table "public"."swissdebuglogs" to "service_role";
grant select on table "public"."swissdebuglogs" to "service_role";
grant trigger on table "public"."swissdebuglogs" to "service_role";
grant truncate on table "public"."swissdebuglogs" to "service_role";
grant update on table "public"."swissdebuglogs" to "service_role";
grant delete on table "public"."system_config" to "anon";
grant insert on table "public"."system_config" to "anon";
grant references on table "public"."system_config" to "anon";
grant select on table "public"."system_config" to "anon";
grant trigger on table "public"."system_config" to "anon";
grant truncate on table "public"."system_config" to "anon";
grant update on table "public"."system_config" to "anon";
grant delete on table "public"."system_config" to "authenticated";
grant insert on table "public"."system_config" to "authenticated";
grant references on table "public"."system_config" to "authenticated";
grant select on table "public"."system_config" to "authenticated";
grant trigger on table "public"."system_config" to "authenticated";
grant truncate on table "public"."system_config" to "authenticated";
grant update on table "public"."system_config" to "authenticated";
grant delete on table "public"."system_config" to "service_role";
grant insert on table "public"."system_config" to "service_role";
grant references on table "public"."system_config" to "service_role";
grant select on table "public"."system_config" to "service_role";
grant trigger on table "public"."system_config" to "service_role";
grant truncate on table "public"."system_config" to "service_role";
grant update on table "public"."system_config" to "service_role";
grant delete on table "public"."system_prompts" to "anon";
grant insert on table "public"."system_prompts" to "anon";
grant references on table "public"."system_prompts" to "anon";
grant select on table "public"."system_prompts" to "anon";
grant trigger on table "public"."system_prompts" to "anon";
grant truncate on table "public"."system_prompts" to "anon";
grant update on table "public"."system_prompts" to "anon";
grant delete on table "public"."system_prompts" to "authenticated";
grant insert on table "public"."system_prompts" to "authenticated";
grant references on table "public"."system_prompts" to "authenticated";
grant select on table "public"."system_prompts" to "authenticated";
grant trigger on table "public"."system_prompts" to "authenticated";
grant truncate on table "public"."system_prompts" to "authenticated";
grant update on table "public"."system_prompts" to "authenticated";
grant delete on table "public"."system_prompts" to "service_role";
grant insert on table "public"."system_prompts" to "service_role";
grant references on table "public"."system_prompts" to "service_role";
grant select on table "public"."system_prompts" to "service_role";
grant trigger on table "public"."system_prompts" to "service_role";
grant truncate on table "public"."system_prompts" to "service_role";
grant update on table "public"."system_prompts" to "service_role";
grant delete on table "public"."temp_audio" to "anon";
grant insert on table "public"."temp_audio" to "anon";
grant references on table "public"."temp_audio" to "anon";
grant select on table "public"."temp_audio" to "anon";
grant trigger on table "public"."temp_audio" to "anon";
grant truncate on table "public"."temp_audio" to "anon";
grant update on table "public"."temp_audio" to "anon";
grant delete on table "public"."temp_audio" to "authenticated";
grant insert on table "public"."temp_audio" to "authenticated";
grant references on table "public"."temp_audio" to "authenticated";
grant select on table "public"."temp_audio" to "authenticated";
grant trigger on table "public"."temp_audio" to "authenticated";
grant truncate on table "public"."temp_audio" to "authenticated";
grant update on table "public"."temp_audio" to "authenticated";
grant delete on table "public"."temp_audio" to "service_role";
grant insert on table "public"."temp_audio" to "service_role";
grant references on table "public"."temp_audio" to "service_role";
grant select on table "public"."temp_audio" to "service_role";
grant trigger on table "public"."temp_audio" to "service_role";
grant truncate on table "public"."temp_audio" to "service_role";
grant update on table "public"."temp_audio" to "service_role";
grant delete on table "public"."temp_report_data" to "anon";
grant insert on table "public"."temp_report_data" to "anon";
grant references on table "public"."temp_report_data" to "anon";
grant select on table "public"."temp_report_data" to "anon";
grant trigger on table "public"."temp_report_data" to "anon";
grant truncate on table "public"."temp_report_data" to "anon";
grant update on table "public"."temp_report_data" to "anon";
grant delete on table "public"."temp_report_data" to "authenticated";
grant insert on table "public"."temp_report_data" to "authenticated";
grant references on table "public"."temp_report_data" to "authenticated";
grant select on table "public"."temp_report_data" to "authenticated";
grant trigger on table "public"."temp_report_data" to "authenticated";
grant truncate on table "public"."temp_report_data" to "authenticated";
grant update on table "public"."temp_report_data" to "authenticated";
grant delete on table "public"."temp_report_data" to "service_role";
grant insert on table "public"."temp_report_data" to "service_role";
grant references on table "public"."temp_report_data" to "service_role";
grant select on table "public"."temp_report_data" to "service_role";
grant trigger on table "public"."temp_report_data" to "service_role";
grant truncate on table "public"."temp_report_data" to "service_role";
grant update on table "public"."temp_report_data" to "service_role";
grant delete on table "public"."token_emails" to "anon";
grant insert on table "public"."token_emails" to "anon";
grant references on table "public"."token_emails" to "anon";
grant select on table "public"."token_emails" to "anon";
grant trigger on table "public"."token_emails" to "anon";
grant truncate on table "public"."token_emails" to "anon";
grant update on table "public"."token_emails" to "anon";
grant delete on table "public"."token_emails" to "authenticated";
grant insert on table "public"."token_emails" to "authenticated";
grant references on table "public"."token_emails" to "authenticated";
grant select on table "public"."token_emails" to "authenticated";
grant trigger on table "public"."token_emails" to "authenticated";
grant truncate on table "public"."token_emails" to "authenticated";
grant update on table "public"."token_emails" to "authenticated";
grant delete on table "public"."token_emails" to "service_role";
grant insert on table "public"."token_emails" to "service_role";
grant references on table "public"."token_emails" to "service_role";
grant select on table "public"."token_emails" to "service_role";
grant trigger on table "public"."token_emails" to "service_role";
grant truncate on table "public"."token_emails" to "service_role";
grant update on table "public"."token_emails" to "service_role";
grant delete on table "public"."topup_logs" to "anon";
grant insert on table "public"."topup_logs" to "anon";
grant references on table "public"."topup_logs" to "anon";
grant select on table "public"."topup_logs" to "anon";
grant trigger on table "public"."topup_logs" to "anon";
grant truncate on table "public"."topup_logs" to "anon";
grant update on table "public"."topup_logs" to "anon";
grant delete on table "public"."topup_logs" to "authenticated";
grant insert on table "public"."topup_logs" to "authenticated";
grant references on table "public"."topup_logs" to "authenticated";
grant select on table "public"."topup_logs" to "authenticated";
grant trigger on table "public"."topup_logs" to "authenticated";
grant truncate on table "public"."topup_logs" to "authenticated";
grant update on table "public"."topup_logs" to "authenticated";
grant delete on table "public"."topup_logs" to "service_role";
grant insert on table "public"."topup_logs" to "service_role";
grant references on table "public"."topup_logs" to "service_role";
grant select on table "public"."topup_logs" to "service_role";
grant trigger on table "public"."topup_logs" to "service_role";
grant truncate on table "public"."topup_logs" to "service_role";
grant update on table "public"."topup_logs" to "service_role";
grant delete on table "public"."topup_queue" to "anon";
grant insert on table "public"."topup_queue" to "anon";
grant references on table "public"."topup_queue" to "anon";
grant select on table "public"."topup_queue" to "anon";
grant trigger on table "public"."topup_queue" to "anon";
grant truncate on table "public"."topup_queue" to "anon";
grant update on table "public"."topup_queue" to "anon";
grant delete on table "public"."topup_queue" to "authenticated";
grant insert on table "public"."topup_queue" to "authenticated";
grant references on table "public"."topup_queue" to "authenticated";
grant select on table "public"."topup_queue" to "authenticated";
grant trigger on table "public"."topup_queue" to "authenticated";
grant truncate on table "public"."topup_queue" to "authenticated";
grant update on table "public"."topup_queue" to "authenticated";
grant delete on table "public"."topup_queue" to "service_role";
grant insert on table "public"."topup_queue" to "service_role";
grant references on table "public"."topup_queue" to "service_role";
grant select on table "public"."topup_queue" to "service_role";
grant trigger on table "public"."topup_queue" to "service_role";
grant truncate on table "public"."topup_queue" to "service_role";
grant update on table "public"."topup_queue" to "service_role";
grant delete on table "public"."translator_logs" to "anon";
grant insert on table "public"."translator_logs" to "anon";
grant references on table "public"."translator_logs" to "anon";
grant select on table "public"."translator_logs" to "anon";
grant trigger on table "public"."translator_logs" to "anon";
grant truncate on table "public"."translator_logs" to "anon";
grant update on table "public"."translator_logs" to "anon";
grant delete on table "public"."translator_logs" to "authenticated";
grant insert on table "public"."translator_logs" to "authenticated";
grant references on table "public"."translator_logs" to "authenticated";
grant select on table "public"."translator_logs" to "authenticated";
grant trigger on table "public"."translator_logs" to "authenticated";
grant truncate on table "public"."translator_logs" to "authenticated";
grant update on table "public"."translator_logs" to "authenticated";
grant delete on table "public"."translator_logs" to "service_role";
grant insert on table "public"."translator_logs" to "service_role";
grant references on table "public"."translator_logs" to "service_role";
grant select on table "public"."translator_logs" to "service_role";
grant trigger on table "public"."translator_logs" to "service_role";
grant truncate on table "public"."translator_logs" to "service_role";
grant update on table "public"."translator_logs" to "service_role";
grant delete on table "public"."user_credits" to "anon";
grant insert on table "public"."user_credits" to "anon";
grant references on table "public"."user_credits" to "anon";
grant select on table "public"."user_credits" to "anon";
grant trigger on table "public"."user_credits" to "anon";
grant truncate on table "public"."user_credits" to "anon";
grant update on table "public"."user_credits" to "anon";
grant delete on table "public"."user_credits" to "authenticated";
grant insert on table "public"."user_credits" to "authenticated";
grant references on table "public"."user_credits" to "authenticated";
grant select on table "public"."user_credits" to "authenticated";
grant trigger on table "public"."user_credits" to "authenticated";
grant truncate on table "public"."user_credits" to "authenticated";
grant update on table "public"."user_credits" to "authenticated";
grant delete on table "public"."user_credits" to "service_role";
grant insert on table "public"."user_credits" to "service_role";
grant references on table "public"."user_credits" to "service_role";
grant select on table "public"."user_credits" to "service_role";
grant trigger on table "public"."user_credits" to "service_role";
grant truncate on table "public"."user_credits" to "service_role";
grant update on table "public"."user_credits" to "service_role";
grant delete on table "public"."user_errors" to "anon";
grant insert on table "public"."user_errors" to "anon";
grant references on table "public"."user_errors" to "anon";
grant select on table "public"."user_errors" to "anon";
grant trigger on table "public"."user_errors" to "anon";
grant truncate on table "public"."user_errors" to "anon";
grant update on table "public"."user_errors" to "anon";
grant delete on table "public"."user_errors" to "authenticated";
grant insert on table "public"."user_errors" to "authenticated";
grant references on table "public"."user_errors" to "authenticated";
grant select on table "public"."user_errors" to "authenticated";
grant trigger on table "public"."user_errors" to "authenticated";
grant truncate on table "public"."user_errors" to "authenticated";
grant update on table "public"."user_errors" to "authenticated";
grant delete on table "public"."user_errors" to "service_role";
grant insert on table "public"."user_errors" to "service_role";
grant references on table "public"."user_errors" to "service_role";
grant select on table "public"."user_errors" to "service_role";
grant trigger on table "public"."user_errors" to "service_role";
grant truncate on table "public"."user_errors" to "service_role";
grant update on table "public"."user_errors" to "service_role";
grant delete on table "public"."user_preferences" to "anon";
grant insert on table "public"."user_preferences" to "anon";
grant references on table "public"."user_preferences" to "anon";
grant select on table "public"."user_preferences" to "anon";
grant trigger on table "public"."user_preferences" to "anon";
grant truncate on table "public"."user_preferences" to "anon";
grant update on table "public"."user_preferences" to "anon";
grant delete on table "public"."user_preferences" to "authenticated";
grant insert on table "public"."user_preferences" to "authenticated";
grant references on table "public"."user_preferences" to "authenticated";
grant select on table "public"."user_preferences" to "authenticated";
grant trigger on table "public"."user_preferences" to "authenticated";
grant truncate on table "public"."user_preferences" to "authenticated";
grant update on table "public"."user_preferences" to "authenticated";
grant delete on table "public"."user_preferences" to "service_role";
grant insert on table "public"."user_preferences" to "service_role";
grant references on table "public"."user_preferences" to "service_role";
grant select on table "public"."user_preferences" to "service_role";
grant trigger on table "public"."user_preferences" to "service_role";
grant truncate on table "public"."user_preferences" to "service_role";
grant update on table "public"."user_preferences" to "service_role";
grant delete on table "public"."user_profile_list" to "anon";
grant insert on table "public"."user_profile_list" to "anon";
grant references on table "public"."user_profile_list" to "anon";
grant select on table "public"."user_profile_list" to "anon";
grant trigger on table "public"."user_profile_list" to "anon";
grant truncate on table "public"."user_profile_list" to "anon";
grant update on table "public"."user_profile_list" to "anon";
grant delete on table "public"."user_profile_list" to "authenticated";
grant insert on table "public"."user_profile_list" to "authenticated";
grant references on table "public"."user_profile_list" to "authenticated";
grant select on table "public"."user_profile_list" to "authenticated";
grant trigger on table "public"."user_profile_list" to "authenticated";
grant truncate on table "public"."user_profile_list" to "authenticated";
grant update on table "public"."user_profile_list" to "authenticated";
grant delete on table "public"."user_profile_list" to "service_role";
grant insert on table "public"."user_profile_list" to "service_role";
grant references on table "public"."user_profile_list" to "service_role";
grant select on table "public"."user_profile_list" to "service_role";
grant trigger on table "public"."user_profile_list" to "service_role";
grant truncate on table "public"."user_profile_list" to "service_role";
grant update on table "public"."user_profile_list" to "service_role";
grant delete on table "public"."user_roles" to "anon";
grant insert on table "public"."user_roles" to "anon";
grant references on table "public"."user_roles" to "anon";
grant select on table "public"."user_roles" to "anon";
grant trigger on table "public"."user_roles" to "anon";
grant truncate on table "public"."user_roles" to "anon";
grant update on table "public"."user_roles" to "anon";
grant delete on table "public"."user_roles" to "authenticated";
grant insert on table "public"."user_roles" to "authenticated";
grant references on table "public"."user_roles" to "authenticated";
grant select on table "public"."user_roles" to "authenticated";
grant trigger on table "public"."user_roles" to "authenticated";
grant truncate on table "public"."user_roles" to "authenticated";
grant update on table "public"."user_roles" to "authenticated";
grant delete on table "public"."user_roles" to "service_role";
grant insert on table "public"."user_roles" to "service_role";
grant references on table "public"."user_roles" to "service_role";
grant select on table "public"."user_roles" to "service_role";
grant trigger on table "public"."user_roles" to "service_role";
grant truncate on table "public"."user_roles" to "service_role";
grant update on table "public"."user_roles" to "service_role";
grant delete on table "public"."website_templates" to "anon";
grant insert on table "public"."website_templates" to "anon";
grant references on table "public"."website_templates" to "anon";
grant select on table "public"."website_templates" to "anon";
grant trigger on table "public"."website_templates" to "anon";
grant truncate on table "public"."website_templates" to "anon";
grant update on table "public"."website_templates" to "anon";
grant delete on table "public"."website_templates" to "authenticated";
grant insert on table "public"."website_templates" to "authenticated";
grant references on table "public"."website_templates" to "authenticated";
grant select on table "public"."website_templates" to "authenticated";
grant trigger on table "public"."website_templates" to "authenticated";
grant truncate on table "public"."website_templates" to "authenticated";
grant update on table "public"."website_templates" to "authenticated";
grant delete on table "public"."website_templates" to "service_role";
grant insert on table "public"."website_templates" to "service_role";
grant references on table "public"."website_templates" to "service_role";
grant select on table "public"."website_templates" to "service_role";
grant trigger on table "public"."website_templates" to "service_role";
grant truncate on table "public"."website_templates" to "service_role";
grant update on table "public"."website_templates" to "service_role";
create policy "Only service role can access admin_logs"
  on "public"."admin_logs"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "service_role_insert"
  on "public"."api_usage"
  as permissive
  for insert
  to service_role
with check (true);
create policy "service_role_select"
  on "public"."api_usage"
  as permissive
  for select
  to service_role
using (true);
create policy "service_role_update"
  on "public"."api_usage"
  as permissive
  for update
  to service_role
using (true)
with check (true);
create policy "Allow service role on blog_posts"
  on "public"."blog_posts"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "Public can view published posts"
  on "public"."blog_posts"
  as permissive
  for select
  to public
using ((published = true));
create policy "Coach can delete own sessions"
  on "public"."calendar_sessions"
  as permissive
  for delete
  to public
using ((coach_id = auth.uid()));
create policy "Coach can insert sessions"
  on "public"."calendar_sessions"
  as permissive
  for insert
  to public
with check ((coach_id = auth.uid()));
create policy "Coach can update sessions"
  on "public"."calendar_sessions"
  as permissive
  for update
  to public
using ((coach_id = auth.uid()));
create policy "Coach can view own sessions"
  on "public"."calendar_sessions"
  as permissive
  for select
  to public
using ((coach_id = auth.uid()));
create policy "service_role_manage_cascade_log"
  on "public"."cascade_deletion_log"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "Users can create their own folders"
  on "public"."chat_folders"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));
create policy "Users can delete their own folders"
  on "public"."chat_folders"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));
create policy "Users can update their own folders"
  on "public"."chat_folders"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));
create policy "Users can view their own folders"
  on "public"."chat_folders"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));
create policy "Service role full access on conversation_caches"
  on "public"."conversation_caches"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "Service role full access on conversation_summaries"
  on "public"."conversation_summaries"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "public_sel"
  on "public"."conversations"
  as permissive
  for select
  to public
using ((is_public = true));
create policy "svc_all"
  on "public"."conversations"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "usr_del"
  on "public"."conversations"
  as permissive
  for delete
  to authenticated
using (((user_id = auth.uid()) OR (owner_user_id = auth.uid())));
create policy "usr_ins"
  on "public"."conversations"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));
create policy "usr_sel"
  on "public"."conversations"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR (owner_user_id = auth.uid()) OR (is_public = true) OR (EXISTS ( SELECT 1
   FROM public.conversations_participants
  WHERE ((conversations_participants.conversation_id = conversations.id) AND (conversations_participants.user_id = auth.uid()))
 LIMIT 1))));
create policy "usr_upd"
  on "public"."conversations"
  as permissive
  for update
  to authenticated
using (((user_id = auth.uid()) OR (owner_user_id = auth.uid())))
with check (((user_id = auth.uid()) OR (owner_user_id = auth.uid())));
create policy "Users can join conversations"
  on "public"."conversations_participants"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));
create policy "Users can leave conversations"
  on "public"."conversations_participants"
  as permissive
  for delete
  to authenticated
using ((user_id = auth.uid()));
create policy "Users can view participants"
  on "public"."conversations_participants"
  as permissive
  for select
  to authenticated
using (true);
create policy "Service role full access on transactions"
  on "public"."credit_transactions"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "Users can view own transactions"
  on "public"."credit_transactions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));
create policy "service_role_insert"
  on "public"."debug_logs"
  as permissive
  for insert
  to service_role
with check (true);
create policy "service_role_select"
  on "public"."debug_logs"
  as permissive
  for select
  to service_role
using (true);
create policy "service_role_update"
  on "public"."debug_logs"
  as permissive
  for update
  to service_role
using (true)
with check (true);
create policy "Authenticated users can read domain_slugs"
  on "public"."domain_slugs"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));
create policy "Service role can manage domain_slugs"
  on "public"."domain_slugs"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
create policy "Admins can manage all email messages"
  on "public"."email_messages"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.user_role)))));
create policy "Service role can manage all email messages"
  on "public"."email_messages"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "Allow all users to view email templates"
  on "public"."email_notification_templates"
  as permissive
  for select
  to public
using (true);
create policy "Allow public read access to geo_cache"
  on "public"."geo_cache"
  as permissive
  for select
  to public
using (true);
create policy "Allow service role to insert/update geo_cache"
  on "public"."geo_cache"
  as permissive
  for insert
  to service_role
with check (true);
create policy "Allow service role to update geo_cache"
  on "public"."geo_cache"
  as permissive
  for update
  to service_role
using (true);
create policy "Users can create own insights"
  on "public"."insights"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));
create policy "Users can delete own insights"
  on "public"."insights"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));
create policy "Users can update own insights"
  on "public"."insights"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));
create policy "Users can view own insights"
  on "public"."insights"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));
create policy "Admin can manage ip_allowlist"
  on "public"."ip_allowlist"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "Coach can access own clients' journal entries"
  on "public"."journal_entries"
  as permissive
  for select
  to public
using ((coach_id = (current_setting('request.coach_id'::text, true))::uuid));
create policy "Coaches can create their own journal entries"
  on "public"."journal_entries"
  as permissive
  for insert
  to public
with check ((auth.uid() = coach_id));
create policy "Coaches can delete their own journal entries"
  on "public"."journal_entries"
  as permissive
  for delete
  to public
using ((auth.uid() = coach_id));
create policy "Coaches can update their own journal entries"
  on "public"."journal_entries"
  as permissive
  for update
  to public
using ((auth.uid() = coach_id));
create policy "Coaches can view their own journal entries"
  on "public"."journal_entries"
  as permissive
  for select
  to public
using ((auth.uid() = coach_id));
create policy "Anyone can view landing page config"
  on "public"."landing_page_config"
  as permissive
  for select
  to public
using (true);
create policy "Authenticated users can insert landing page config"
  on "public"."landing_page_config"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));
create policy "Authenticated users can update landing page config"
  on "public"."landing_page_config"
  as permissive
  for update
  to public
using ((auth.role() = 'authenticated'::text));
create policy "Allow superusers to modify legal documents"
  on "public"."legal_documents"
  as permissive
  for all
  to authenticated
using (true)
with check (true);
create policy "Public can read current legal documents"
  on "public"."legal_documents"
  as permissive
  for select
  to public
using ((is_current = true));
create policy "svc_all"
  on "public"."messages"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "usr_ins"
  on "public"."messages"
  as permissive
  for insert
  to authenticated
with check (((EXISTS ( SELECT 1
   FROM public.conversations
  WHERE ((conversations.id = messages.chat_id) AND (conversations.user_id = auth.uid()))
 LIMIT 1)) OR (EXISTS ( SELECT 1
   FROM public.conversations_participants
  WHERE ((conversations_participants.conversation_id = messages.chat_id) AND (conversations_participants.user_id = auth.uid()))
 LIMIT 1))));
create policy "usr_sel"
  on "public"."messages"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.conversations
  WHERE ((conversations.id = messages.chat_id) AND (conversations.user_id = auth.uid()))
 LIMIT 1)) OR (EXISTS ( SELECT 1
   FROM public.conversations_participants
  WHERE ((conversations_participants.conversation_id = messages.chat_id) AND (conversations_participants.user_id = auth.uid()))
 LIMIT 1))));
create policy "Service role can manage password reset tokens"
  on "public"."password_reset_tokens"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "Users can read their own tokens"
  on "public"."password_reset_tokens"
  as permissive
  for select
  to public
using ((auth.email() = email));
create policy "Users can delete their own payment methods"
  on "public"."payment_method"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));
create policy "Users can update their own payment methods"
  on "public"."payment_method"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));
create policy "Users can view their own transactions"
  on "public"."payment_method"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));
create policy "service_all_credit_transactions"
  on "public"."payment_method"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
create policy "Public can read price list"
  on "public"."price_list"
  as permissive
  for select
  to authenticated, anon
using (true);
create policy "Authenticated users can update their own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using (((auth.uid() = id) AND (auth.role() = 'authenticated'::text)))
with check (((auth.uid() = id) AND (auth.role() = 'authenticated'::text)));
create policy "Authenticated users can view their own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using (((auth.uid() = id) AND (auth.role() = 'authenticated'::text)));
create policy "profiles_service_role_all"
  on "public"."profiles"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
create policy "service_role_insert"
  on "public"."promo_codes"
  as permissive
  for insert
  to service_role
with check (true);
create policy "service_role_select"
  on "public"."promo_codes"
  as permissive
  for select
  to service_role
using (true);
create policy "service_role_update"
  on "public"."promo_codes"
  as permissive
  for update
  to service_role
using (true)
with check (true);
create policy "Users can access own report logs"
  on "public"."report_logs"
  as permissive
  for all
  to public
using ((chat_id = auth.uid()));
create policy "Users can delete own report logs"
  on "public"."report_logs"
  as permissive
  for delete
  to public
using (public.user_owns_insight(chat_id));
create policy "service_role_can_insert_report_logs"
  on "public"."report_logs"
  as permissive
  for insert
  to public
with check (true);
create policy "service_role_can_update_report_logs"
  on "public"."report_logs"
  as permissive
  for update
  to public
using (true)
with check (true);
create policy "Allow service role only"
  on "public"."report_prompts"
  as permissive
  for all
  to service_role
using (true);
create policy "Everyone can view active products"
  on "public"."stripe_products"
  as permissive
  for select
  to public
using ((active = true));
create policy "service_all_stripe_products"
  on "public"."stripe_products"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
create policy "service_all_webhook_events"
  on "public"."stripe_webhook_events"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
create policy "service_role_manage_stripe_webhook_events"
  on "public"."stripe_webhook_events"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
create policy "service_role_insert"
  on "public"."swissdebuglogs"
  as permissive
  for insert
  to service_role
with check (true);
create policy "service_role_select"
  on "public"."swissdebuglogs"
  as permissive
  for select
  to service_role
using (true);
create policy "service_role_update"
  on "public"."swissdebuglogs"
  as permissive
  for update
  to service_role
using (true)
with check (true);
create policy "Public read access to system_config"
  on "public"."system_config"
  as permissive
  for select
  to public
using (true);
create policy "Service role can update system_config"
  on "public"."system_config"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "system_prompts_admin_policy"
  on "public"."system_prompts"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "system_prompts_read_policy"
  on "public"."system_prompts"
  as permissive
  for select
  to public
using ((is_active = true));
create policy "service_role_manage_temp_audio"
  on "public"."temp_audio"
  as permissive
  for all
  to public
using (true);
create policy "service_role_insert"
  on "public"."temp_report_data"
  as permissive
  for insert
  to service_role
with check (true);
create policy "service_role_select"
  on "public"."temp_report_data"
  as permissive
  for select
  to service_role
using (true);
create policy "service_role_update"
  on "public"."temp_report_data"
  as permissive
  for update
  to service_role
using (true)
with check (true);
create policy "Allow service role to read email templates"
  on "public"."token_emails"
  as permissive
  for select
  to service_role
using (true);
create policy "service_role_insert"
  on "public"."topup_logs"
  as permissive
  for insert
  to service_role
with check (true);
create policy "service_role_select"
  on "public"."topup_logs"
  as permissive
  for select
  to service_role
using (true);
create policy "service_role_update"
  on "public"."topup_logs"
  as permissive
  for update
  to service_role
using (true)
with check (true);
create policy "service_all_topup_queue"
  on "public"."topup_queue"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
create policy "Service role can insert translator logs"
  on "public"."translator_logs"
  as permissive
  for insert
  to public
with check (true);
create policy "Service role can manage translator logs"
  on "public"."translator_logs"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "Users can delete own translator logs"
  on "public"."translator_logs"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.insights
  WHERE ((insights.id = translator_logs.chat_id) AND (insights.user_id = auth.uid())))));
create policy "Users can read their own translator logs"
  on "public"."translator_logs"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.conversations
  WHERE ((conversations.id = translator_logs.chat_id) AND (conversations.user_id = auth.uid())))));
create policy "Service role full access"
  on "public"."user_credits"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "Users can view own credits"
  on "public"."user_credits"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));
create policy "Allow anonymous users to insert error logs"
  on "public"."user_errors"
  as permissive
  for insert
  to public
with check (true);
create policy "Authenticated users can view user errors"
  on "public"."user_errors"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));
create policy "Service role can manage user errors"
  on "public"."user_errors"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));
create policy "Users can create their own preferences"
  on "public"."user_preferences"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));
create policy "Users can read their own preferences"
  on "public"."user_preferences"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));
create policy "Users can update their own preferences"
  on "public"."user_preferences"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));
create policy "Users can delete their own profiles"
  on "public"."user_profile_list"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));
create policy "Users can insert their own profiles"
  on "public"."user_profile_list"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));
create policy "Users can update their own profiles"
  on "public"."user_profile_list"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));
create policy "Users can view their own profiles"
  on "public"."user_profile_list"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));
create policy "Admins can delete roles"
  on "public"."user_roles"
  as permissive
  for delete
  to public
using (public.check_user_admin_role(auth.uid()));
create policy "Admins can insert roles"
  on "public"."user_roles"
  as permissive
  for insert
  to public
with check (public.check_user_admin_role(auth.uid()));
create policy "Admins can read all roles"
  on "public"."user_roles"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles user_roles_1
  WHERE ((user_roles_1.user_id = auth.uid()) AND (user_roles_1.role = 'admin'::public.user_role)))));
create policy "Admins can update roles"
  on "public"."user_roles"
  as permissive
  for update
  to public
using (public.check_user_admin_role(auth.uid()));
create policy "Admins can view all roles"
  on "public"."user_roles"
  as permissive
  for select
  to public
using (public.check_user_admin_role(auth.uid()));
create policy "Authenticated users can view all roles"
  on "public"."user_roles"
  as permissive
  for select
  to authenticated
using (true);
create policy "Only admins can manage roles"
  on "public"."user_roles"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles user_roles_1
  WHERE ((user_roles_1.user_id = auth.uid()) AND (user_roles_1.role = 'admin'::public.user_role)))));
create policy "Service role can manage roles"
  on "public"."user_roles"
  as permissive
  for all
  to service_role
using (true);
create policy "Users can read their own roles"
  on "public"."user_roles"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));
create policy "Users can view their own roles"
  on "public"."user_roles"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));
create policy "Public can view active templates"
  on "public"."website_templates"
  as permissive
  for select
  to public
using ((is_active = true));
create policy "Users can view website templates"
  on "public"."website_templates"
  as permissive
  for select
  to authenticated
using ((is_active = true));
CREATE TRIGGER trg_update_api_usage_costs AFTER INSERT OR UPDATE OF report_tier, used_geo_lookup ON public.api_usage FOR EACH ROW EXECUTE FUNCTION public.update_api_usage_costs();
CREATE TRIGGER chat_folders_updated_at BEFORE UPDATE ON public.chat_folders FOR EACH ROW EXECUTE FUNCTION public.update_chat_folders_updated_at();
CREATE TRIGGER trg_handle_public_conversation AFTER INSERT OR UPDATE OF is_public ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_public_conversation_participant();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_notification_templates FOR EACH ROW EXECUTE FUNCTION public.update_email_templates_updated_at();
CREATE TRIGGER update_geo_cache_updated_at BEFORE UPDATE ON public.geo_cache FOR EACH ROW EXECUTE FUNCTION public.update_geo_cache_updated_at();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_landing_page_config_updated_at BEFORE UPDATE ON public.landing_page_config FOR EACH ROW EXECUTE FUNCTION public.update_landing_page_config_updated_at();
CREATE TRIGGER log_message_deletions BEFORE DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.log_message_cascade_deletion();
CREATE TRIGGER trg_deactivate_old_methods AFTER INSERT ON public.payment_method FOR EACH ROW EXECUTE FUNCTION public.deactivate_old_payment_methods();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_system_prompts_updated_at BEFORE UPDATE ON public.system_prompts FOR EACH ROW EXECUTE FUNCTION public.update_system_prompts_updated_at();
CREATE TRIGGER update_token_emails_updated_at BEFORE UPDATE ON public.token_emails FOR EACH ROW EXECUTE FUNCTION public.update_token_emails_updated_at();
CREATE TRIGGER update_user_preferences_timestamp BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER update_user_profile_list_updated_at_trigger BEFORE UPDATE ON public.user_profile_list FOR EACH ROW EXECUTE FUNCTION public.update_user_profile_list_updated_at();
CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_email_verified AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_verification_status();
create policy "Authenticated users can delete feature images"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'feature-images'::text) AND (auth.role() = 'authenticated'::text)));
create policy "Authenticated users can update feature images"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'feature-images'::text) AND (auth.role() = 'authenticated'::text)));
create policy "Authenticated users can upload feature images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'feature-images'::text) AND (auth.role() = 'authenticated'::text)));
create policy "Public Access"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'feature-images'::text));
