-- Fix message_archival_stats view security issue
-- Replace the SECURITY DEFINER view with a secure function

-- Drop the insecure view
DROP VIEW IF EXISTS public.message_archival_stats;

-- Create a secure function that requires admin access
CREATE OR REPLACE FUNCTION public.get_message_archival_stats()
RETURNS TABLE(
  archived_messages BIGINT,
  active_messages BIGINT,
  conversations_with_archived BIGINT,
  oldest_archive_date TIMESTAMPTZ,
  latest_archive_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify that the caller is an admin or service_role
  -- Only admins should be able to see global archival statistics
  IF auth.role() = 'service_role' OR public.check_user_admin_role(auth.uid()) THEN
    RETURN QUERY
    SELECT 
      COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as archived_messages,
      COUNT(*) FILTER (WHERE archived_at IS NULL) as active_messages,
      COUNT(DISTINCT chat_id) FILTER (WHERE archived_at IS NOT NULL) as conversations_with_archived,
      MIN(archived_at) as oldest_archive_date,
      MAX(archived_at) as latest_archive_date
    FROM public.messages;
  ELSE
    RAISE EXCEPTION 'Access denied. Only administrators can view archival statistics.';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users (they'll get an error if not admin)
-- Service role already has access via SECURITY DEFINER
GRANT EXECUTE ON FUNCTION public.get_message_archival_stats() TO authenticated, anon;

-- Add comment
COMMENT ON FUNCTION public.get_message_archival_stats() IS 'Returns message archival statistics. Requires admin role. Use this instead of the old message_archival_stats view.';



