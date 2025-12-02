-- Fix report_logs DELETE policy
-- The issue: The EXISTS subquery might be too slow or not matching correctly

-- Drop the complex policy
DROP POLICY IF EXISTS "Users can delete own report logs" ON public.report_logs;

-- Create a simpler policy that checks if the user owns the insight
-- Since RLS can't easily join, we'll use a function
CREATE OR REPLACE FUNCTION public.user_owns_insight(report_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.insights
        WHERE insights.id = report_id
        AND insights.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now create the policy using the function
CREATE POLICY "Users can delete own report logs" ON public.report_logs
    FOR DELETE USING (
        user_owns_insight(user_id)
    );

-- Verify
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'report_logs' 
AND cmd = 'DELETE';
