-- INSIGHTS CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- Insights inherit folder access permissions

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own insights" ON public.insights;
DROP POLICY IF EXISTS "Users can manage their own insights" ON public.insights;

-- Service role: full access
CREATE POLICY insights_service_all ON public.insights
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users: SELECT own insights or insights in folders they own
CREATE POLICY insights_user_select ON public.insights
FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.chat_folders cf
    WHERE cf.id = insights.folder_id
      AND cf.user_id = (select auth.uid())
  )
);

-- Authenticated users: manage their own insights
CREATE POLICY insights_user_insert ON public.insights
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY insights_user_update ON public.insights
FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY insights_user_delete ON public.insights
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));
