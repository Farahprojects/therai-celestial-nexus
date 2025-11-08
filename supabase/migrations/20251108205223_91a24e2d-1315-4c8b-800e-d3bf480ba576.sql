-- Security fix: Restrict access to email_notification_templates and system_prompts tables
-- These tables contain sensitive business logic and should not be publicly readable

-- 1. Fix email_notification_templates table
-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Allow all users to view email templates" ON public.email_notification_templates;

-- Create new policy: Only authenticated users can view email templates
DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_notification_templates;
CREATE POLICY "Authenticated users can view email templates"
ON public.email_notification_templates
FOR SELECT
TO authenticated
USING (true);

-- Service role retains full access (already handled by Supabase's default service role permissions)

-- 2. Fix system_prompts table  
-- Drop the public read policy
DROP POLICY IF EXISTS "system_prompts_read_policy" ON public.system_prompts;

-- Create new policy: Only authenticated users can view system prompts
DROP POLICY IF EXISTS "Authenticated users can view active system prompts" ON public.system_prompts;
CREATE POLICY "Authenticated users can view active system prompts"
ON public.system_prompts
FOR SELECT
TO authenticated
USING (is_active = true);

-- Note: system_prompts_admin_policy already exists and restricts write operations to service_role
-- This ensures only authenticated users can read, and only service role can modify

-- Verify the new policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression
FROM pg_policies 
WHERE tablename IN ('email_notification_templates', 'system_prompts')
ORDER BY tablename, policyname;