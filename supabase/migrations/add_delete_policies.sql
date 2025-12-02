-- Add DELETE policies for insights, report_logs, translator_logs
-- Run this in your Supabase SQL editor

-- 1. Add DELETE policy for insights table
-- Users can delete their own insights
DROP POLICY IF EXISTS "Users can delete own insights" ON public.insights;
CREATE POLICY "Users can delete own insights" ON public.insights
    FOR DELETE USING (auth.uid() = user_id);

-- 2. Add DELETE policy for report_logs table
-- Users can delete report_logs where user_id matches their insight report_ids
DROP POLICY IF EXISTS "Users can delete own report logs" ON public.report_logs;
CREATE POLICY "Users can delete own report logs" ON public.report_logs
    FOR DELETE USING (
        -- Check if this report_log's user_id (which is a report_id) 
        -- belongs to an insight owned by the current user
        EXISTS (
            SELECT 1 FROM public.insights
            WHERE insights.id = report_logs.user_id
            AND insights.user_id = auth.uid()
        )
    );

-- 3. Add DELETE policy for translator_logs table
-- Users can delete translator_logs where user_id matches their insight report_ids
DROP POLICY IF EXISTS "Users can delete own translator logs" ON public.translator_logs;
CREATE POLICY "Users can delete own translator logs" ON public.translator_logs
    FOR DELETE USING (
        -- Check if this translator_log's user_id (which is a report_id)
        -- belongs to an insight owned by the current user
        EXISTS (
            SELECT 1 FROM public.insights
            WHERE insights.id = translator_logs.user_id
            AND insights.user_id = auth.uid()
        )
    );

-- Verify policies were created
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('insights', 'report_logs', 'translator_logs')
AND cmd = 'DELETE'
ORDER BY tablename, policyname;
