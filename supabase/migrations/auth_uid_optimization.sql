-- AUTH.UID() PERFORMANCE OPTIMIZATION
-- Reference implementation for updating policies to use (SELECT auth.uid()) pattern
-- Improves query performance by reducing function evaluation overhead

-- This script updates existing RLS policies to use the optimized auth.uid() pattern
-- recommended by database performance advisors

DO $$
BEGIN
  -- calendar_sessions: Update coach access policies
  ALTER POLICY "Coach can view own sessions" ON public.calendar_sessions
  USING (coach_id = (SELECT auth.uid()));

  ALTER POLICY "Coach can insert sessions" ON public.calendar_sessions
  WITH CHECK (coach_id = (SELECT auth.uid()));

  ALTER POLICY "Coach can update sessions" ON public.calendar_sessions
  USING (coach_id = (SELECT auth.uid()))
  WITH CHECK (coach_id = (SELECT auth.uid()));

  ALTER POLICY "Coach can delete own sessions" ON public.calendar_sessions
  USING (coach_id = (SELECT auth.uid()));

  -- user_profile_list: Update user isolation policies
  ALTER POLICY "Users can view their own profiles" ON public.user_profile_list
  USING ((SELECT auth.uid()) = user_id);

  ALTER POLICY "Users can insert their own profiles" ON public.user_profile_list
  WITH CHECK ((SELECT auth.uid()) = user_id);

  ALTER POLICY "Users can update their own profiles" ON public.user_profile_list
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

  ALTER POLICY "Users can delete their own profiles" ON public.user_profile_list
  USING ((SELECT auth.uid()) = user_id);

  -- user_images: Update image access policies
  ALTER POLICY "Users can view own images" ON public.user_images
  USING ((SELECT auth.uid()) = user_id);

  ALTER POLICY "Users can delete own images" ON public.user_images
  USING ((SELECT auth.uid()) = user_id);

  -- feature_usage: Update usage tracking policies
  ALTER POLICY "Users can view own feature usage" ON public.feature_usage
  USING ((SELECT auth.uid()) = user_id);

  -- voice_usage: Update voice usage policies
  ALTER POLICY "Users can view own voice usage" ON public.voice_usage
  USING ((SELECT auth.uid()) = user_id);

  -- conversation_activity: Update activity monitoring policies
  ALTER POLICY "Users can view own conversation activity" ON public.conversation_activity
  USING ((SELECT auth.uid()) = user_id);

  -- user_memory_monthly_summaries: Update monthly summary policies
  ALTER POLICY "Users can view their own monthly summaries" ON public.user_memory_monthly_summaries
  USING ((SELECT auth.uid()) = user_id);

  -- chat_folder_participants: Update folder participation policies
  ALTER POLICY "Users can view folder participants" ON public.chat_folder_participants
  USING ((SELECT auth.uid()) = user_id);

  ALTER POLICY "Users can join folders" ON public.chat_folder_participants
  WITH CHECK ((SELECT auth.uid()) = user_id);

  ALTER POLICY "Users can leave folders" ON public.chat_folder_participants
  USING ((SELECT auth.uid()) = user_id);

  ALTER POLICY "Users can update own participant" ON public.chat_folder_participants
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

  -- folder_ai_messages: Update AI message access policies
  ALTER POLICY "Users can read their folder AI messages" ON public.folder_ai_messages
  USING ((SELECT auth.uid()) = user_id);

  -- folder_ai_usage: Update AI usage tracking policies
  ALTER POLICY "Users can read their own folder AI usage" ON public.folder_ai_usage
  USING ((SELECT auth.uid()) = user_id);

  -- folder_documents: Update document access policies with folder ownership
  ALTER POLICY "Users can view documents in their folders" ON public.folder_documents
  USING (
    ((SELECT auth.uid()) = user_id)
    OR (EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (SELECT auth.uid())
    ))
  );

  ALTER POLICY "Users can update their own documents" ON public.folder_documents
  USING (
    ((SELECT auth.uid()) = user_id)
    OR (EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND (EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = (SELECT auth.uid())
    ))
  );

  -- realtime.messages: Update realtime messaging policies
  ALTER POLICY folder_members_can_receive ON realtime.messages
  USING (
    topic LIKE 'folder:%:conversations' AND (
      EXISTS (
        SELECT 1 FROM public.chat_folders cf
        WHERE cf.id = (split_part(messages.topic, ':', 2))::uuid
        AND cf.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.chat_folder_participants cfp
        WHERE cfp.folder_id = (split_part(messages.topic, ':', 2))::uuid
        AND cfp.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.chat_folders cf
        WHERE cf.id = (split_part(messages.topic, ':', 2))::uuid
        AND cf.is_public = true
      )
    )
  );

END $$;
