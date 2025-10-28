drop trigger if exists "chat_folders_updated_at" on "public"."chat_folders";

drop trigger if exists "trg_handle_public_conversation" on "public"."conversations";

drop trigger if exists "log_message_deletions" on "public"."messages";

drop trigger if exists "update_system_prompts_updated_at" on "public"."system_prompts";

drop policy "service_role_manage_cascade_log" on "public"."cascade_deletion_log";

drop policy "Users can create their own folders" on "public"."chat_folders";

drop policy "Users can delete their own folders" on "public"."chat_folders";

drop policy "Users can update their own folders" on "public"."chat_folders";

drop policy "Users can view their own folders" on "public"."chat_folders";

drop policy "Service role full access on conversation_caches" on "public"."conversation_caches";

drop policy "Service role full access on conversation_summaries" on "public"."conversation_summaries";

drop policy "public_sel" on "public"."conversations";

drop policy "svc_all" on "public"."conversations";

drop policy "usr_del" on "public"."conversations";

drop policy "usr_ins" on "public"."conversations";

drop policy "usr_sel" on "public"."conversations";

drop policy "usr_upd" on "public"."conversations";

drop policy "Users can join conversations" on "public"."conversations_participants";

drop policy "Users can leave conversations" on "public"."conversations_participants";

drop policy "Users can view participants" on "public"."conversations_participants";

drop policy "Service role full access on transactions" on "public"."credit_transactions";

drop policy "Users can view own transactions" on "public"."credit_transactions";

drop policy "svc_all" on "public"."messages";

drop policy "usr_ins" on "public"."messages";

drop policy "usr_sel" on "public"."messages";

drop policy "Public read access to system_config" on "public"."system_config";

drop policy "Service role can update system_config" on "public"."system_config";

drop policy "system_prompts_admin_policy" on "public"."system_prompts";

drop policy "system_prompts_read_policy" on "public"."system_prompts";

drop policy "Service role can insert translator logs" on "public"."translator_logs";

drop policy "Users can read their own translator logs" on "public"."translator_logs";

drop policy "Service role full access" on "public"."user_credits";

drop policy "Users can view own credits" on "public"."user_credits";

drop policy "Public can read price list" on "public"."price_list";

revoke delete on table "public"."cascade_deletion_log" from "anon";

revoke insert on table "public"."cascade_deletion_log" from "anon";

revoke references on table "public"."cascade_deletion_log" from "anon";

revoke select on table "public"."cascade_deletion_log" from "anon";

revoke trigger on table "public"."cascade_deletion_log" from "anon";

revoke truncate on table "public"."cascade_deletion_log" from "anon";

revoke update on table "public"."cascade_deletion_log" from "anon";

revoke delete on table "public"."cascade_deletion_log" from "authenticated";

revoke insert on table "public"."cascade_deletion_log" from "authenticated";

revoke references on table "public"."cascade_deletion_log" from "authenticated";

revoke select on table "public"."cascade_deletion_log" from "authenticated";

revoke trigger on table "public"."cascade_deletion_log" from "authenticated";

revoke truncate on table "public"."cascade_deletion_log" from "authenticated";

revoke update on table "public"."cascade_deletion_log" from "authenticated";

revoke delete on table "public"."cascade_deletion_log" from "service_role";

revoke insert on table "public"."cascade_deletion_log" from "service_role";

revoke references on table "public"."cascade_deletion_log" from "service_role";

revoke select on table "public"."cascade_deletion_log" from "service_role";

revoke trigger on table "public"."cascade_deletion_log" from "service_role";

revoke truncate on table "public"."cascade_deletion_log" from "service_role";

revoke update on table "public"."cascade_deletion_log" from "service_role";

revoke delete on table "public"."chat_folders" from "anon";

revoke insert on table "public"."chat_folders" from "anon";

revoke references on table "public"."chat_folders" from "anon";

revoke select on table "public"."chat_folders" from "anon";

revoke trigger on table "public"."chat_folders" from "anon";

revoke truncate on table "public"."chat_folders" from "anon";

revoke update on table "public"."chat_folders" from "anon";

revoke delete on table "public"."chat_folders" from "authenticated";

revoke insert on table "public"."chat_folders" from "authenticated";

revoke references on table "public"."chat_folders" from "authenticated";

revoke select on table "public"."chat_folders" from "authenticated";

revoke trigger on table "public"."chat_folders" from "authenticated";

revoke truncate on table "public"."chat_folders" from "authenticated";

revoke update on table "public"."chat_folders" from "authenticated";

revoke delete on table "public"."chat_folders" from "service_role";

revoke insert on table "public"."chat_folders" from "service_role";

revoke references on table "public"."chat_folders" from "service_role";

revoke select on table "public"."chat_folders" from "service_role";

revoke trigger on table "public"."chat_folders" from "service_role";

revoke truncate on table "public"."chat_folders" from "service_role";

revoke update on table "public"."chat_folders" from "service_role";

revoke delete on table "public"."conversation_caches" from "anon";

revoke insert on table "public"."conversation_caches" from "anon";

revoke references on table "public"."conversation_caches" from "anon";

revoke select on table "public"."conversation_caches" from "anon";

revoke trigger on table "public"."conversation_caches" from "anon";

revoke truncate on table "public"."conversation_caches" from "anon";

revoke update on table "public"."conversation_caches" from "anon";

revoke delete on table "public"."conversation_caches" from "authenticated";

revoke insert on table "public"."conversation_caches" from "authenticated";

revoke references on table "public"."conversation_caches" from "authenticated";

revoke select on table "public"."conversation_caches" from "authenticated";

revoke trigger on table "public"."conversation_caches" from "authenticated";

revoke truncate on table "public"."conversation_caches" from "authenticated";

revoke update on table "public"."conversation_caches" from "authenticated";

revoke delete on table "public"."conversation_caches" from "service_role";

revoke insert on table "public"."conversation_caches" from "service_role";

revoke references on table "public"."conversation_caches" from "service_role";

revoke select on table "public"."conversation_caches" from "service_role";

revoke trigger on table "public"."conversation_caches" from "service_role";

revoke truncate on table "public"."conversation_caches" from "service_role";

revoke update on table "public"."conversation_caches" from "service_role";

revoke delete on table "public"."conversation_summaries" from "anon";

revoke insert on table "public"."conversation_summaries" from "anon";

revoke references on table "public"."conversation_summaries" from "anon";

revoke select on table "public"."conversation_summaries" from "anon";

revoke trigger on table "public"."conversation_summaries" from "anon";

revoke truncate on table "public"."conversation_summaries" from "anon";

revoke update on table "public"."conversation_summaries" from "anon";

revoke delete on table "public"."conversation_summaries" from "authenticated";

revoke insert on table "public"."conversation_summaries" from "authenticated";

revoke references on table "public"."conversation_summaries" from "authenticated";

revoke select on table "public"."conversation_summaries" from "authenticated";

revoke trigger on table "public"."conversation_summaries" from "authenticated";

revoke truncate on table "public"."conversation_summaries" from "authenticated";

revoke update on table "public"."conversation_summaries" from "authenticated";

revoke delete on table "public"."conversation_summaries" from "service_role";

revoke insert on table "public"."conversation_summaries" from "service_role";

revoke references on table "public"."conversation_summaries" from "service_role";

revoke select on table "public"."conversation_summaries" from "service_role";

revoke trigger on table "public"."conversation_summaries" from "service_role";

revoke truncate on table "public"."conversation_summaries" from "service_role";

revoke update on table "public"."conversation_summaries" from "service_role";

revoke delete on table "public"."conversations_participants" from "anon";

revoke insert on table "public"."conversations_participants" from "anon";

revoke references on table "public"."conversations_participants" from "anon";

revoke select on table "public"."conversations_participants" from "anon";

revoke trigger on table "public"."conversations_participants" from "anon";

revoke truncate on table "public"."conversations_participants" from "anon";

revoke update on table "public"."conversations_participants" from "anon";

revoke delete on table "public"."conversations_participants" from "authenticated";

revoke insert on table "public"."conversations_participants" from "authenticated";

revoke references on table "public"."conversations_participants" from "authenticated";

revoke select on table "public"."conversations_participants" from "authenticated";

revoke trigger on table "public"."conversations_participants" from "authenticated";

revoke truncate on table "public"."conversations_participants" from "authenticated";

revoke update on table "public"."conversations_participants" from "authenticated";

revoke delete on table "public"."conversations_participants" from "service_role";

revoke insert on table "public"."conversations_participants" from "service_role";

revoke references on table "public"."conversations_participants" from "service_role";

revoke select on table "public"."conversations_participants" from "service_role";

revoke trigger on table "public"."conversations_participants" from "service_role";

revoke truncate on table "public"."conversations_participants" from "service_role";

revoke update on table "public"."conversations_participants" from "service_role";

revoke delete on table "public"."credit_transactions" from "anon";

revoke insert on table "public"."credit_transactions" from "anon";

revoke references on table "public"."credit_transactions" from "anon";

revoke select on table "public"."credit_transactions" from "anon";

revoke trigger on table "public"."credit_transactions" from "anon";

revoke truncate on table "public"."credit_transactions" from "anon";

revoke update on table "public"."credit_transactions" from "anon";

revoke delete on table "public"."credit_transactions" from "authenticated";

revoke insert on table "public"."credit_transactions" from "authenticated";

revoke references on table "public"."credit_transactions" from "authenticated";

revoke select on table "public"."credit_transactions" from "authenticated";

revoke trigger on table "public"."credit_transactions" from "authenticated";

revoke truncate on table "public"."credit_transactions" from "authenticated";

revoke update on table "public"."credit_transactions" from "authenticated";

revoke delete on table "public"."credit_transactions" from "service_role";

revoke insert on table "public"."credit_transactions" from "service_role";

revoke references on table "public"."credit_transactions" from "service_role";

revoke select on table "public"."credit_transactions" from "service_role";

revoke trigger on table "public"."credit_transactions" from "service_role";

revoke truncate on table "public"."credit_transactions" from "service_role";

revoke update on table "public"."credit_transactions" from "service_role";

revoke delete on table "public"."system_config" from "anon";

revoke insert on table "public"."system_config" from "anon";

revoke references on table "public"."system_config" from "anon";

revoke select on table "public"."system_config" from "anon";

revoke trigger on table "public"."system_config" from "anon";

revoke truncate on table "public"."system_config" from "anon";

revoke update on table "public"."system_config" from "anon";

revoke delete on table "public"."system_config" from "authenticated";

revoke insert on table "public"."system_config" from "authenticated";

revoke references on table "public"."system_config" from "authenticated";

revoke select on table "public"."system_config" from "authenticated";

revoke trigger on table "public"."system_config" from "authenticated";

revoke truncate on table "public"."system_config" from "authenticated";

revoke update on table "public"."system_config" from "authenticated";

revoke delete on table "public"."system_config" from "service_role";

revoke insert on table "public"."system_config" from "service_role";

revoke references on table "public"."system_config" from "service_role";

revoke select on table "public"."system_config" from "service_role";

revoke trigger on table "public"."system_config" from "service_role";

revoke truncate on table "public"."system_config" from "service_role";

revoke update on table "public"."system_config" from "service_role";

revoke delete on table "public"."system_prompts" from "anon";

revoke insert on table "public"."system_prompts" from "anon";

revoke references on table "public"."system_prompts" from "anon";

revoke select on table "public"."system_prompts" from "anon";

revoke trigger on table "public"."system_prompts" from "anon";

revoke truncate on table "public"."system_prompts" from "anon";

revoke update on table "public"."system_prompts" from "anon";

revoke delete on table "public"."system_prompts" from "authenticated";

revoke insert on table "public"."system_prompts" from "authenticated";

revoke references on table "public"."system_prompts" from "authenticated";

revoke select on table "public"."system_prompts" from "authenticated";

revoke trigger on table "public"."system_prompts" from "authenticated";

revoke truncate on table "public"."system_prompts" from "authenticated";

revoke update on table "public"."system_prompts" from "authenticated";

revoke delete on table "public"."system_prompts" from "service_role";

revoke insert on table "public"."system_prompts" from "service_role";

revoke references on table "public"."system_prompts" from "service_role";

revoke select on table "public"."system_prompts" from "service_role";

revoke trigger on table "public"."system_prompts" from "service_role";

revoke truncate on table "public"."system_prompts" from "service_role";

revoke update on table "public"."system_prompts" from "service_role";

alter table "public"."chat_folders" drop constraint "chat_folders_name_length";

alter table "public"."chat_folders" drop constraint "chat_folders_user_id_fkey";

alter table "public"."conversation_caches" drop constraint "conversation_caches_chat_id_fkey";

alter table "public"."conversation_summaries" drop constraint "conversation_summaries_chat_id_fkey";

alter table "public"."conversations" drop constraint "conversations_folder_id_fkey";

alter table "public"."conversations" drop constraint "conversations_mode_check";

alter table "public"."conversations" drop constraint "conversations_owner_user_id_fkey";

alter table "public"."conversations_participants" drop constraint "conversations_participants_conversation_id_fkey";

alter table "public"."conversations_participants" drop constraint "conversations_participants_invited_by_fkey";

alter table "public"."conversations_participants" drop constraint "conversations_participants_role_check";

alter table "public"."conversations_participants" drop constraint "conversations_participants_user_id_fkey";

alter table "public"."credit_transactions" drop constraint "credit_transactions_type_check";

alter table "public"."credit_transactions" drop constraint "credit_transactions_user_id_fkey1";

alter table "public"."messages" drop constraint "messages_chat_id_fkey";

alter table "public"."system_prompts" drop constraint "system_prompts_category_check";

drop function if exists "public"."add_credits"(_user_id uuid, _credits integer, _amount_usd numeric, _type text, _reference_id uuid, _description text);

drop function if exists "public"."check_orphaned_data"();

drop function if exists "public"."deduct_credits"(_user_id uuid, _credits integer, _endpoint text, _reference_id uuid, _description text);

drop function if exists "public"."get_config"(config_key text);

drop function if exists "public"."handle_public_conversation_participant"();

drop function if exists "public"."log_message_cascade_deletion"();

drop function if exists "public"."log_summary_cascade_deletion"();

drop function if exists "public"."update_auto_topup_settings"(_user_id uuid, _enabled boolean, _threshold integer, _amount integer);

drop function if exists "public"."update_chat_folders_updated_at"();

drop function if exists "public"."update_system_prompts_updated_at"();

alter table "public"."cascade_deletion_log" drop constraint "cascade_deletion_log_pkey";

alter table "public"."chat_folders" drop constraint "chat_folders_pkey";

alter table "public"."conversation_caches" drop constraint "conversation_caches_pkey";

alter table "public"."conversation_summaries" drop constraint "conversation_summaries_pkey";

alter table "public"."conversations_participants" drop constraint "conversations_participants_pkey";

alter table "public"."credit_transactions" drop constraint "credit_transactions_pkey1";

alter table "public"."system_config" drop constraint "system_config_pkey";

alter table "public"."system_prompts" drop constraint "system_prompts_pkey";

drop index if exists "public"."cascade_deletion_log_pkey";

drop index if exists "public"."chat_folders_pkey";

drop index if exists "public"."conversation_caches_pkey";

drop index if exists "public"."conversation_summaries_pkey";

drop index if exists "public"."conversations_participants_pkey";

drop index if exists "public"."credit_transactions_pkey1";

drop index if exists "public"."idx_caches_expires";

drop index if exists "public"."idx_chat_folders_user_id";

drop index if exists "public"."idx_conv_id_user";

drop index if exists "public"."idx_conversations_folder_id";

drop index if exists "public"."idx_conversations_id";

drop index if exists "public"."idx_conversations_participants_conversation_id";

drop index if exists "public"."idx_conversations_participants_user_id";

drop index if exists "public"."idx_credit_transactions_user";

drop index if exists "public"."idx_messages_chat_created_desc";

drop index if exists "public"."idx_messages_chat_created_desc_no_system";

drop index if exists "public"."idx_messages_chat_role_created_desc";

drop index if exists "public"."idx_messages_history_optimized";

drop index if exists "public"."idx_messages_system_optimized";

drop index if exists "public"."idx_part_conv_user";

drop index if exists "public"."idx_summaries_chat_created";

drop index if exists "public"."idx_system_config_key";

drop index if exists "public"."idx_system_prompts_category";

drop index if exists "public"."system_config_pkey";

drop index if exists "public"."system_prompts_pkey";

drop table "public"."cascade_deletion_log";

drop table "public"."chat_folders";

drop table "public"."conversation_caches";

drop table "public"."conversation_summaries";

drop table "public"."conversations_participants";

drop table "public"."credit_transactions";

drop table "public"."system_config";

drop table "public"."system_prompts";


  create table "public"."chat_audio_clips" (
    "id" uuid not null default gen_random_uuid(),
    "chat_id" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."chat_audio_clips" enable row level security;


  create table "public"."conversation_broadcasts" (
    "id" uuid not null default gen_random_uuid(),
    "channel_name" text not null,
    "message_type" text,
    "payload" jsonb,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."conversation_broadcasts" enable row level security;


  create table "public"."conversation_folders" (
    "id" uuid not null default gen_random_uuid(),
    "conversation_id" uuid not null,
    "folder_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."conversation_folders" enable row level security;


  create table "public"."conversation_participants" (
    "id" uuid not null default gen_random_uuid(),
    "conversation_id" uuid,
    "user_id" uuid,
    "role" text default 'participant'::text,
    "joined_at" timestamp with time zone default now(),
    "last_seen_at" timestamp with time zone default now(),
    "notes" jsonb default '{}'::jsonb
      );


alter table "public"."conversation_participants" enable row level security;


  create table "public"."edge_function_logs" (
    "id" uuid not null default gen_random_uuid(),
    "function_name" text not null,
    "ip_address" text not null,
    "request_id" text not null,
    "user_agent" text,
    "status_code" integer not null,
    "is_blocked" boolean default false,
    "token_hash" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."edge_function_logs" enable row level security;


  create table "public"."email_signatures" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "name" text not null,
    "signature_html" text not null,
    "signature_text" text not null,
    "logo_url" text,
    "is_default" boolean default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."email_signatures" enable row level security;


  create table "public"."email_templates" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "name" text not null,
    "category" text default 'general'::text,
    "subject_template" text not null,
    "body_template" text not null,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."email_templates" enable row level security;


  create table "public"."folders" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "folder_name" text not null,
    "ai_summary" text,
    "custom_report" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."folders" enable row level security;


  create table "public"."message_block_summaries" (
    "id" uuid not null default gen_random_uuid(),
    "chat_id" uuid not null,
    "block_index" integer not null,
    "summary" text not null,
    "message_count" integer not null default 0,
    "start_message_id" uuid,
    "end_message_id" uuid,
    "model" text,
    "meta" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."message_block_summaries" enable row level security;


  create table "public"."rate_limit_rules" (
    "id" uuid not null default gen_random_uuid(),
    "function_name" text not null,
    "max_hits" integer not null default 30,
    "window_seconds" integer not null default 60,
    "block_duration_seconds" integer not null default 300,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."rate_limit_rules" enable row level security;

alter table "public"."conversations" drop column "folder_id";

alter table "public"."conversations" drop column "last_summary_at_turn";

alter table "public"."conversations" drop column "mode";

alter table "public"."conversations" drop column "owner_user_id";

alter table "public"."conversations" drop column "turn_count";

alter table "public"."conversations" add column "share_mode" text default 'view_only'::text;

alter table "public"."conversations" add column "share_token" text;

alter table "public"."messages" drop column "user_id";

alter table "public"."messages" drop column "user_name";

alter table "public"."messages" add column "error" jsonb default '{}'::jsonb;

alter table "public"."messages" add column "latency_ms" integer;

alter table "public"."messages" add column "model" text;

alter table "public"."messages" add column "reply_to_id" uuid;

alter table "public"."messages" add column "token_count" integer;

alter table "public"."messages" add column "updated_at" timestamp with time zone default now();

alter table "public"."price_list" drop column "stripe_price_id";

alter table "public"."profiles" drop column "display_name";

alter table "public"."topup_logs" drop column "credits";

alter table "public"."topup_logs" drop column "is_auto_topup";

alter table "public"."user_credits" drop column "auto_topup_amount";

alter table "public"."user_credits" drop column "auto_topup_enabled";

alter table "public"."user_credits" drop column "auto_topup_threshold";

alter table "public"."user_credits" drop column "created_at";

alter table "public"."user_credits" drop column "credits";

alter table "public"."user_credits" add column "balance_usd" numeric(10,2) not null default 0;

CREATE UNIQUE INDEX chat_audio_clips_pkey ON public.chat_audio_clips USING btree (id);

CREATE UNIQUE INDEX conversation_broadcasts_pkey ON public.conversation_broadcasts USING btree (id);

CREATE UNIQUE INDEX conversation_folders_pkey ON public.conversation_folders USING btree (id);

CREATE UNIQUE INDEX conversation_participants_conversation_id_user_id_key ON public.conversation_participants USING btree (conversation_id, user_id);

CREATE UNIQUE INDEX conversation_participants_pkey ON public.conversation_participants USING btree (id);

CREATE UNIQUE INDEX conversations_share_token_key ON public.conversations USING btree (share_token);

CREATE UNIQUE INDEX edge_function_logs_pkey ON public.edge_function_logs USING btree (id);

CREATE UNIQUE INDEX email_signatures_pkey ON public.email_signatures USING btree (id);

CREATE UNIQUE INDEX email_templates_pkey ON public.email_templates USING btree (id);

CREATE UNIQUE INDEX folders_pkey ON public.folders USING btree (id);

CREATE INDEX idx_cf_conversation_id ON public.conversation_folders USING btree (conversation_id);

CREATE INDEX idx_cf_folder_id ON public.conversation_folders USING btree (folder_id);

CREATE INDEX idx_chat_audio_clips_chat_id ON public.chat_audio_clips USING btree (chat_id);

CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants USING btree (conversation_id);

CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants USING btree (user_id);

CREATE INDEX idx_edge_function_logs_created_at ON public.edge_function_logs USING btree (created_at);

CREATE INDEX idx_edge_function_logs_ip_address ON public.edge_function_logs USING btree (ip_address);

CREATE INDEX idx_folders_user_id ON public.folders USING btree (user_id);

CREATE INDEX idx_message_block_summaries_chat_block ON public.message_block_summaries USING btree (chat_id, block_index);

CREATE INDEX idx_messages_chat_id_message_number ON public.messages USING btree (chat_id, message_number);

CREATE INDEX idx_messages_chat_id_mode ON public.messages USING btree (chat_id, mode);

CREATE INDEX idx_messages_chat_id_role ON public.messages USING btree (chat_id, role);

CREATE INDEX idx_messages_chat_message_number ON public.messages USING btree (chat_id, message_number);

CREATE INDEX idx_messages_chat_recent_complete ON public.messages USING btree (chat_id, created_at DESC) WHERE ((status = 'complete'::text) AND (text IS NOT NULL) AND (length(text) > 0));

CREATE INDEX idx_messages_mode ON public.messages USING btree (mode);

CREATE INDEX idx_messages_status ON public.messages USING btree (status);

CREATE UNIQUE INDEX idx_rate_limit_rules_function_name_active ON public.rate_limit_rules USING btree (function_name) WHERE (is_active = true);

CREATE UNIQUE INDEX message_block_summaries_pkey ON public.message_block_summaries USING btree (id);

CREATE UNIQUE INDEX messages_chat_id_message_number_uniq ON public.messages USING btree (chat_id, message_number) WHERE (message_number IS NOT NULL);

CREATE INDEX messages_created_brin ON public.messages USING brin (created_at);

CREATE UNIQUE INDEX messages_one_streaming_assistant_per_chat ON public.messages USING btree (chat_id) WHERE ((role = 'assistant'::text) AND (status = 'streaming'::text));

CREATE UNIQUE INDEX rate_limit_rules_pkey ON public.rate_limit_rules USING btree (id);

CREATE UNIQUE INDEX unique_chat_block ON public.message_block_summaries USING btree (chat_id, block_index);

CREATE UNIQUE INDEX unique_chat_message_number ON public.messages USING btree (chat_id, message_number);

CREATE UNIQUE INDEX uq_conversation_folder ON public.conversation_folders USING btree (conversation_id, folder_id);

alter table "public"."chat_audio_clips" add constraint "chat_audio_clips_pkey" PRIMARY KEY using index "chat_audio_clips_pkey";

alter table "public"."conversation_broadcasts" add constraint "conversation_broadcasts_pkey" PRIMARY KEY using index "conversation_broadcasts_pkey";

alter table "public"."conversation_folders" add constraint "conversation_folders_pkey" PRIMARY KEY using index "conversation_folders_pkey";

alter table "public"."conversation_participants" add constraint "conversation_participants_pkey" PRIMARY KEY using index "conversation_participants_pkey";

alter table "public"."edge_function_logs" add constraint "edge_function_logs_pkey" PRIMARY KEY using index "edge_function_logs_pkey";

alter table "public"."email_signatures" add constraint "email_signatures_pkey" PRIMARY KEY using index "email_signatures_pkey";

alter table "public"."email_templates" add constraint "email_templates_pkey" PRIMARY KEY using index "email_templates_pkey";

alter table "public"."folders" add constraint "folders_pkey" PRIMARY KEY using index "folders_pkey";

alter table "public"."message_block_summaries" add constraint "message_block_summaries_pkey" PRIMARY KEY using index "message_block_summaries_pkey";

alter table "public"."rate_limit_rules" add constraint "rate_limit_rules_pkey" PRIMARY KEY using index "rate_limit_rules_pkey";

alter table "public"."conversation_folders" add constraint "fk_cf_conversation" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_folders" validate constraint "fk_cf_conversation";

alter table "public"."conversation_folders" add constraint "fk_cf_folder" FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_folders" validate constraint "fk_cf_folder";

alter table "public"."conversation_folders" add constraint "uq_conversation_folder" UNIQUE using index "uq_conversation_folder";

alter table "public"."conversation_participants" add constraint "conversation_participants_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_participants" validate constraint "conversation_participants_conversation_id_fkey";

alter table "public"."conversation_participants" add constraint "conversation_participants_conversation_id_user_id_key" UNIQUE using index "conversation_participants_conversation_id_user_id_key";

alter table "public"."conversation_participants" add constraint "conversation_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_participants" validate constraint "conversation_participants_user_id_fkey";

alter table "public"."conversations" add constraint "conversations_share_token_key" UNIQUE using index "conversations_share_token_key";

alter table "public"."email_signatures" add constraint "email_signatures_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."email_signatures" validate constraint "email_signatures_user_id_fkey";

alter table "public"."email_templates" add constraint "email_templates_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."email_templates" validate constraint "email_templates_user_id_fkey";

alter table "public"."message_block_summaries" add constraint "message_block_summaries_block_index_check" CHECK ((block_index >= 0)) not valid;

alter table "public"."message_block_summaries" validate constraint "message_block_summaries_block_index_check";

alter table "public"."message_block_summaries" add constraint "unique_chat_block" UNIQUE using index "unique_chat_block";

alter table "public"."messages" add constraint "messages_mode_check" CHECK ((mode = ANY (ARRAY['chat'::text, 'astro'::text]))) not valid;

alter table "public"."messages" validate constraint "messages_mode_check";

alter table "public"."messages" add constraint "messages_reply_to_id_fkey" FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL not valid;

alter table "public"."messages" validate constraint "messages_reply_to_id_fkey";

alter table "public"."messages" add constraint "unique_chat_message_number" UNIQUE using index "unique_chat_message_number";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assign_message_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only assign if not already set
  IF NEW.message_number IS NULL THEN
    NEW.message_number := get_next_message_number(NEW.chat_id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_next_message_number(p_chat_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    next_num INTEGER;
BEGIN
    -- Lock the chat to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(p_chat_id::text));
    
    -- Get and increment in one atomic operation
    SELECT COALESCE(MAX(message_number), 0) + 1 
    INTO next_num
    FROM messages 
    WHERE chat_id = p_chat_id;
    
    RETURN next_num;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_role public.user_role, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = _user_id AND role = _role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.increment_promo_code_usage()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only trigger when payment_status changes from 'pending' to 'paid' 
  -- and promo_code_used is not null
  IF OLD.payment_status = 'pending' 
     AND NEW.payment_status = 'paid' 
     AND NEW.promo_code_used IS NOT NULL THEN
    
    -- Atomically increment promo code usage with optimistic locking
    -- This prevents race conditions and ensures accurate counting
    UPDATE promo_codes 
    SET times_used = times_used + 1
    WHERE code = NEW.promo_code_used
      AND is_active = true
      AND (max_uses IS NULL OR times_used < max_uses);
    
    -- Log the promo code increment for debugging
    INSERT INTO debug_logs (source, message, details)
    VALUES (
      'increment_promo_code_usage_trigger',
      'Promo code usage incremented via database trigger',
      jsonb_build_object(
        'guest_report_id', NEW.id,
        'promo_code', NEW.promo_code_used,
        'payment_status_change', 'pending -> paid'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_coach_websites_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_message_block_summaries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Create profiles row (existing logic)
  INSERT INTO public.profiles (
    id,
    email,
    email_verified,
    verification_status,
    created_at,
    updated_at,
    last_seen_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'verified'::verification_status_type ELSE 'pending'::verification_status_type END,
    COALESCE(NEW.created_at, now()),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    verification_status = EXCLUDED.verification_status,
    updated_at = now();

  -- Create user_preferences row (new logic)
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
$function$
;

grant delete on table "public"."chat_audio_clips" to "anon";

grant insert on table "public"."chat_audio_clips" to "anon";

grant references on table "public"."chat_audio_clips" to "anon";

grant select on table "public"."chat_audio_clips" to "anon";

grant trigger on table "public"."chat_audio_clips" to "anon";

grant truncate on table "public"."chat_audio_clips" to "anon";

grant update on table "public"."chat_audio_clips" to "anon";

grant delete on table "public"."chat_audio_clips" to "authenticated";

grant insert on table "public"."chat_audio_clips" to "authenticated";

grant references on table "public"."chat_audio_clips" to "authenticated";

grant select on table "public"."chat_audio_clips" to "authenticated";

grant trigger on table "public"."chat_audio_clips" to "authenticated";

grant truncate on table "public"."chat_audio_clips" to "authenticated";

grant update on table "public"."chat_audio_clips" to "authenticated";

grant delete on table "public"."chat_audio_clips" to "service_role";

grant insert on table "public"."chat_audio_clips" to "service_role";

grant references on table "public"."chat_audio_clips" to "service_role";

grant select on table "public"."chat_audio_clips" to "service_role";

grant trigger on table "public"."chat_audio_clips" to "service_role";

grant truncate on table "public"."chat_audio_clips" to "service_role";

grant update on table "public"."chat_audio_clips" to "service_role";

grant delete on table "public"."conversation_broadcasts" to "anon";

grant insert on table "public"."conversation_broadcasts" to "anon";

grant references on table "public"."conversation_broadcasts" to "anon";

grant select on table "public"."conversation_broadcasts" to "anon";

grant trigger on table "public"."conversation_broadcasts" to "anon";

grant truncate on table "public"."conversation_broadcasts" to "anon";

grant update on table "public"."conversation_broadcasts" to "anon";

grant delete on table "public"."conversation_broadcasts" to "authenticated";

grant insert on table "public"."conversation_broadcasts" to "authenticated";

grant references on table "public"."conversation_broadcasts" to "authenticated";

grant select on table "public"."conversation_broadcasts" to "authenticated";

grant trigger on table "public"."conversation_broadcasts" to "authenticated";

grant truncate on table "public"."conversation_broadcasts" to "authenticated";

grant update on table "public"."conversation_broadcasts" to "authenticated";

grant delete on table "public"."conversation_broadcasts" to "service_role";

grant insert on table "public"."conversation_broadcasts" to "service_role";

grant references on table "public"."conversation_broadcasts" to "service_role";

grant select on table "public"."conversation_broadcasts" to "service_role";

grant trigger on table "public"."conversation_broadcasts" to "service_role";

grant truncate on table "public"."conversation_broadcasts" to "service_role";

grant update on table "public"."conversation_broadcasts" to "service_role";

grant delete on table "public"."conversation_folders" to "anon";

grant insert on table "public"."conversation_folders" to "anon";

grant references on table "public"."conversation_folders" to "anon";

grant select on table "public"."conversation_folders" to "anon";

grant trigger on table "public"."conversation_folders" to "anon";

grant truncate on table "public"."conversation_folders" to "anon";

grant update on table "public"."conversation_folders" to "anon";

grant delete on table "public"."conversation_folders" to "authenticated";

grant insert on table "public"."conversation_folders" to "authenticated";

grant references on table "public"."conversation_folders" to "authenticated";

grant select on table "public"."conversation_folders" to "authenticated";

grant trigger on table "public"."conversation_folders" to "authenticated";

grant truncate on table "public"."conversation_folders" to "authenticated";

grant update on table "public"."conversation_folders" to "authenticated";

grant delete on table "public"."conversation_folders" to "service_role";

grant insert on table "public"."conversation_folders" to "service_role";

grant references on table "public"."conversation_folders" to "service_role";

grant select on table "public"."conversation_folders" to "service_role";

grant trigger on table "public"."conversation_folders" to "service_role";

grant truncate on table "public"."conversation_folders" to "service_role";

grant update on table "public"."conversation_folders" to "service_role";

grant delete on table "public"."conversation_participants" to "anon";

grant insert on table "public"."conversation_participants" to "anon";

grant references on table "public"."conversation_participants" to "anon";

grant select on table "public"."conversation_participants" to "anon";

grant trigger on table "public"."conversation_participants" to "anon";

grant truncate on table "public"."conversation_participants" to "anon";

grant update on table "public"."conversation_participants" to "anon";

grant delete on table "public"."conversation_participants" to "authenticated";

grant insert on table "public"."conversation_participants" to "authenticated";

grant references on table "public"."conversation_participants" to "authenticated";

grant select on table "public"."conversation_participants" to "authenticated";

grant trigger on table "public"."conversation_participants" to "authenticated";

grant truncate on table "public"."conversation_participants" to "authenticated";

grant update on table "public"."conversation_participants" to "authenticated";

grant delete on table "public"."conversation_participants" to "service_role";

grant insert on table "public"."conversation_participants" to "service_role";

grant references on table "public"."conversation_participants" to "service_role";

grant select on table "public"."conversation_participants" to "service_role";

grant trigger on table "public"."conversation_participants" to "service_role";

grant truncate on table "public"."conversation_participants" to "service_role";

grant update on table "public"."conversation_participants" to "service_role";

grant delete on table "public"."edge_function_logs" to "anon";

grant insert on table "public"."edge_function_logs" to "anon";

grant references on table "public"."edge_function_logs" to "anon";

grant select on table "public"."edge_function_logs" to "anon";

grant trigger on table "public"."edge_function_logs" to "anon";

grant truncate on table "public"."edge_function_logs" to "anon";

grant update on table "public"."edge_function_logs" to "anon";

grant delete on table "public"."edge_function_logs" to "authenticated";

grant insert on table "public"."edge_function_logs" to "authenticated";

grant references on table "public"."edge_function_logs" to "authenticated";

grant select on table "public"."edge_function_logs" to "authenticated";

grant trigger on table "public"."edge_function_logs" to "authenticated";

grant truncate on table "public"."edge_function_logs" to "authenticated";

grant update on table "public"."edge_function_logs" to "authenticated";

grant delete on table "public"."edge_function_logs" to "service_role";

grant insert on table "public"."edge_function_logs" to "service_role";

grant references on table "public"."edge_function_logs" to "service_role";

grant select on table "public"."edge_function_logs" to "service_role";

grant trigger on table "public"."edge_function_logs" to "service_role";

grant truncate on table "public"."edge_function_logs" to "service_role";

grant update on table "public"."edge_function_logs" to "service_role";

grant delete on table "public"."email_signatures" to "anon";

grant insert on table "public"."email_signatures" to "anon";

grant references on table "public"."email_signatures" to "anon";

grant select on table "public"."email_signatures" to "anon";

grant trigger on table "public"."email_signatures" to "anon";

grant truncate on table "public"."email_signatures" to "anon";

grant update on table "public"."email_signatures" to "anon";

grant delete on table "public"."email_signatures" to "authenticated";

grant insert on table "public"."email_signatures" to "authenticated";

grant references on table "public"."email_signatures" to "authenticated";

grant select on table "public"."email_signatures" to "authenticated";

grant trigger on table "public"."email_signatures" to "authenticated";

grant truncate on table "public"."email_signatures" to "authenticated";

grant update on table "public"."email_signatures" to "authenticated";

grant delete on table "public"."email_signatures" to "service_role";

grant insert on table "public"."email_signatures" to "service_role";

grant references on table "public"."email_signatures" to "service_role";

grant select on table "public"."email_signatures" to "service_role";

grant trigger on table "public"."email_signatures" to "service_role";

grant truncate on table "public"."email_signatures" to "service_role";

grant update on table "public"."email_signatures" to "service_role";

grant delete on table "public"."email_templates" to "anon";

grant insert on table "public"."email_templates" to "anon";

grant references on table "public"."email_templates" to "anon";

grant select on table "public"."email_templates" to "anon";

grant trigger on table "public"."email_templates" to "anon";

grant truncate on table "public"."email_templates" to "anon";

grant update on table "public"."email_templates" to "anon";

grant delete on table "public"."email_templates" to "authenticated";

grant insert on table "public"."email_templates" to "authenticated";

grant references on table "public"."email_templates" to "authenticated";

grant select on table "public"."email_templates" to "authenticated";

grant trigger on table "public"."email_templates" to "authenticated";

grant truncate on table "public"."email_templates" to "authenticated";

grant update on table "public"."email_templates" to "authenticated";

grant delete on table "public"."email_templates" to "service_role";

grant insert on table "public"."email_templates" to "service_role";

grant references on table "public"."email_templates" to "service_role";

grant select on table "public"."email_templates" to "service_role";

grant trigger on table "public"."email_templates" to "service_role";

grant truncate on table "public"."email_templates" to "service_role";

grant update on table "public"."email_templates" to "service_role";

grant delete on table "public"."folders" to "anon";

grant insert on table "public"."folders" to "anon";

grant references on table "public"."folders" to "anon";

grant select on table "public"."folders" to "anon";

grant trigger on table "public"."folders" to "anon";

grant truncate on table "public"."folders" to "anon";

grant update on table "public"."folders" to "anon";

grant delete on table "public"."folders" to "authenticated";

grant insert on table "public"."folders" to "authenticated";

grant references on table "public"."folders" to "authenticated";

grant select on table "public"."folders" to "authenticated";

grant trigger on table "public"."folders" to "authenticated";

grant truncate on table "public"."folders" to "authenticated";

grant update on table "public"."folders" to "authenticated";

grant delete on table "public"."folders" to "service_role";

grant insert on table "public"."folders" to "service_role";

grant references on table "public"."folders" to "service_role";

grant select on table "public"."folders" to "service_role";

grant trigger on table "public"."folders" to "service_role";

grant truncate on table "public"."folders" to "service_role";

grant update on table "public"."folders" to "service_role";

grant delete on table "public"."message_block_summaries" to "anon";

grant insert on table "public"."message_block_summaries" to "anon";

grant references on table "public"."message_block_summaries" to "anon";

grant select on table "public"."message_block_summaries" to "anon";

grant trigger on table "public"."message_block_summaries" to "anon";

grant truncate on table "public"."message_block_summaries" to "anon";

grant update on table "public"."message_block_summaries" to "anon";

grant delete on table "public"."message_block_summaries" to "authenticated";

grant insert on table "public"."message_block_summaries" to "authenticated";

grant references on table "public"."message_block_summaries" to "authenticated";

grant select on table "public"."message_block_summaries" to "authenticated";

grant trigger on table "public"."message_block_summaries" to "authenticated";

grant truncate on table "public"."message_block_summaries" to "authenticated";

grant update on table "public"."message_block_summaries" to "authenticated";

grant delete on table "public"."message_block_summaries" to "service_role";

grant insert on table "public"."message_block_summaries" to "service_role";

grant references on table "public"."message_block_summaries" to "service_role";

grant select on table "public"."message_block_summaries" to "service_role";

grant trigger on table "public"."message_block_summaries" to "service_role";

grant truncate on table "public"."message_block_summaries" to "service_role";

grant update on table "public"."message_block_summaries" to "service_role";

grant delete on table "public"."rate_limit_rules" to "anon";

grant insert on table "public"."rate_limit_rules" to "anon";

grant references on table "public"."rate_limit_rules" to "anon";

grant select on table "public"."rate_limit_rules" to "anon";

grant trigger on table "public"."rate_limit_rules" to "anon";

grant truncate on table "public"."rate_limit_rules" to "anon";

grant update on table "public"."rate_limit_rules" to "anon";

grant delete on table "public"."rate_limit_rules" to "authenticated";

grant insert on table "public"."rate_limit_rules" to "authenticated";

grant references on table "public"."rate_limit_rules" to "authenticated";

grant select on table "public"."rate_limit_rules" to "authenticated";

grant trigger on table "public"."rate_limit_rules" to "authenticated";

grant truncate on table "public"."rate_limit_rules" to "authenticated";

grant update on table "public"."rate_limit_rules" to "authenticated";

grant delete on table "public"."rate_limit_rules" to "service_role";

grant insert on table "public"."rate_limit_rules" to "service_role";

grant references on table "public"."rate_limit_rules" to "service_role";

grant select on table "public"."rate_limit_rules" to "service_role";

grant trigger on table "public"."rate_limit_rules" to "service_role";

grant truncate on table "public"."rate_limit_rules" to "service_role";

grant update on table "public"."rate_limit_rules" to "service_role";


  create policy "service_role_full_access"
  on "public"."chat_audio_clips"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



  create policy "Users can create conversation broadcasts"
  on "public"."conversation_broadcasts"
  as permissive
  for insert
  to public
with check ((auth.uid() IS NOT NULL));



  create policy "Users can view conversation broadcasts"
  on "public"."conversation_broadcasts"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Users can delete own conversation-folder links"
  on "public"."conversation_folders"
  as permissive
  for delete
  to public
using (((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_folders.conversation_id) AND (c.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.folders f
  WHERE ((f.id = conversation_folders.folder_id) AND (f.user_id = auth.uid()))))));



  create policy "Users can link own conversations to own folders"
  on "public"."conversation_folders"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_folders.conversation_id) AND (c.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.folders f
  WHERE ((f.id = conversation_folders.folder_id) AND (f.user_id = auth.uid()))))));



  create policy "Users can update own conversation-folder links"
  on "public"."conversation_folders"
  as permissive
  for update
  to public
using (((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_folders.conversation_id) AND (c.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.folders f
  WHERE ((f.id = conversation_folders.folder_id) AND (f.user_id = auth.uid()))))));



  create policy "Users can view own conversation-folder links"
  on "public"."conversation_folders"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_folders.conversation_id) AND (c.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.folders f
  WHERE ((f.id = conversation_folders.folder_id) AND (f.user_id = auth.uid()))))));



  create policy "Service role can insert participants"
  on "public"."conversation_participants"
  as permissive
  for insert
  to public
with check ((auth.role() = 'service_role'::text));



  create policy "Service role can manage all participants"
  on "public"."conversation_participants"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));



  create policy "Users can delete their own participant record"
  on "public"."conversation_participants"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Users can update their own participant record"
  on "public"."conversation_participants"
  as permissive
  for update
  to public
using ((user_id = auth.uid()));



  create policy "Users can view participants in their conversations"
  on "public"."conversation_participants"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.conversations
  WHERE ((conversations.id = conversation_participants.conversation_id) AND (conversations.user_id = auth.uid())))) OR (user_id = auth.uid())));



  create policy "Public can view shared conversations"
  on "public"."conversations"
  as permissive
  for select
  to public
using (((is_public = true) AND (share_token IS NOT NULL)));



  create policy "Service role manages conversations"
  on "public"."conversations"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));



  create policy "Users can create own conversations"
  on "public"."conversations"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own conversations"
  on "public"."conversations"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own conversations"
  on "public"."conversations"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own conversations"
  on "public"."conversations"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Admin can manage edge_function_logs"
  on "public"."edge_function_logs"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));



  create policy "Allow service role on email_signatures"
  on "public"."email_signatures"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Allow service role on email_templates"
  on "public"."email_templates"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Users can create their own folders"
  on "public"."folders"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "Users can delete their own folders"
  on "public"."folders"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Users can update their own folders"
  on "public"."folders"
  as permissive
  for update
  to public
using ((user_id = auth.uid()));



  create policy "Users can view their own folders"
  on "public"."folders"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "auth_read_own_conversation_summaries"
  on "public"."message_block_summaries"
  as permissive
  for select
  to authenticated
using ((chat_id IN ( SELECT c.id
   FROM public.conversations c
  WHERE (c.user_id = auth.uid()))));



  create policy "service_role_manage_message_block_summaries"
  on "public"."message_block_summaries"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



  create policy "Participants can read messages"
  on "public"."messages"
  as permissive
  for select
  to public
using ((chat_id IN ( SELECT conversation_participants.conversation_id
   FROM public.conversation_participants
  WHERE (conversation_participants.user_id = auth.uid()))));



  create policy "Participants can send messages"
  on "public"."messages"
  as permissive
  for insert
  to public
with check ((chat_id IN ( SELECT conversation_participants.conversation_id
   FROM public.conversation_participants
  WHERE (conversation_participants.user_id = auth.uid()))));



  create policy "participants_read_messages"
  on "public"."messages"
  as permissive
  for select
  to public
using ((chat_id IN ( SELECT conversation_participants.conversation_id
   FROM public.conversation_participants
  WHERE (conversation_participants.user_id = auth.uid()))));



  create policy "participants_send_messages"
  on "public"."messages"
  as permissive
  for insert
  to public
with check ((chat_id IN ( SELECT conversation_participants.conversation_id
   FROM public.conversation_participants
  WHERE (conversation_participants.user_id = auth.uid()))));



  create policy "service_role_manage_messages"
  on "public"."messages"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



  create policy "users_can_insert_messages"
  on "public"."messages"
  as permissive
  for insert
  to authenticated
with check ((chat_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));



  create policy "users_can_read_own_messages"
  on "public"."messages"
  as permissive
  for select
  to authenticated
using ((chat_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));



  create policy "users_can_update_own_messages"
  on "public"."messages"
  as permissive
  for update
  to authenticated
using ((chat_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));



  create policy "Admin can manage rate_limit_rules"
  on "public"."rate_limit_rules"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text));



  create policy "Users can view their own credit balance"
  on "public"."user_credits"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "service_all_user_credits"
  on "public"."user_credits"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



  create policy "Public can read price list"
  on "public"."price_list"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER trg_conversation_folders_updated_at BEFORE UPDATE ON public.conversation_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_block_summaries_updated_at BEFORE UPDATE ON public.message_block_summaries FOR EACH ROW EXECUTE FUNCTION public.update_message_block_summaries_updated_at();

CREATE TRIGGER set_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_assign_message_number BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.assign_message_number();


