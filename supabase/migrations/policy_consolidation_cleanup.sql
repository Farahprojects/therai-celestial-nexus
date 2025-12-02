-- POLICY CONSOLIDATION CLEANUP
-- Reference implementation for removing duplicate permissive SELECT policies
-- Reduces RLS evaluation overhead by consolidating redundant policies

-- This script safely removes duplicate SELECT policies while preserving
-- the most appropriate access patterns for each table

DO $$
BEGIN
  -- blog_posts: keep single public SELECT and remove authenticated duplicate
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS public_read_blog ON public.blog_posts;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- chat_folders: keep one authenticated SELECT that includes own/public/participant
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS chat_folders_public_read ON public.chat_folders;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Note: chat_folders_user_select_merged is already the superset policy

  -- email_notification_templates: keep one authenticated SELECT
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_notification_templates;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS public_read_email_templates ON public.email_notification_templates;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- folder_ai_messages: keep only user_id-based SELECT; drop redundant
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS folder_ai_messages_user_select ON public.folder_ai_messages;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Note: existing "Users can read their folder AI messages" covers folder membership

  -- folder_ai_usage: keep user_id-based SELECT; drop duplicate
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS folder_ai_usage_user_select ON public.folder_ai_usage;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- folder_documents: keep public SELECT superset and drop authenticated duplicate
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS folder_documents_user_select ON public.folder_documents;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- legal_documents: keep single public SELECT; drop authenticated duplicate
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS public_read_legal ON public.legal_documents;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- system_prompts: keep single authenticated SELECT and service policy; already unique
  -- No changes needed

  -- translator_logs: keep broader authenticated SELECT and drop narrower
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS translator_logs_authenticated_select ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- website_templates: keep single public SELECT and drop authenticated duplicates
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view website templates" ON public.website_templates;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS public_read_templates ON public.website_templates;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- price_list: keep anon+authenticated SELECT; drop authenticated duplicate
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS public_read_price_list ON public.price_list;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- stripe_webhook_events: keep authenticated SELECT by stripe_customer_id; nothing to merge for anon
  -- No changes needed

  -- conversation_activity: merge multiple SELECTs
  -- Keep a single authenticated SELECT that is the superset of existing participant/owner/public policies
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS conversation_activity_select ON public.conversation_activity;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS conversation_activity_user_select ON public.conversation_activity;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Note: Keep public policy "Users can view own conversation activity" with SELECT auth.uid()

  -- password_reset_tokens: keep a single anon+authenticated SELECT if you truly want public read
  -- Otherwise prefer email match. Drop the generic redundant one.
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS password_reset_tokens_select ON public.password_reset_tokens;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- plan_limits: keep single public SELECT; drop duplicates for other roles
  -- Note: already have "Plan limits are publicly readable" for public role
  -- No action on role-specific duplicates since they reference same access

END $$;
