-- Add retention policies for system log tables
-- Keeps system logs within manageable sizes while preserving user data
-- System logs: edge_function_logs (7 days), stripe_webhook_events (90 days)

-- Note: User-controlled data (report_logs, translator_logs, user images) is NOT deleted
-- Users manage their own data lifecycle

-- 1. Create function to clean old edge function logs (if table exists)
CREATE OR REPLACE FUNCTION clean_edge_function_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete edge function logs older than 7 days
  DELETE FROM edge_function_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  RAISE NOTICE 'Cleaned edge_function_logs older than 7 days';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'edge_function_logs table does not exist, skipping';
  WHEN OTHERS THEN
    RAISE WARNING 'Error cleaning edge_function_logs: %', SQLERRM;
END;
$$;

-- 2. Create function to clean old webhook events (for reconciliation only)
CREATE OR REPLACE FUNCTION clean_old_webhook_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete webhook events older than 90 days (keep for reconciliation period)
  DELETE FROM stripe_webhook_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleaned stripe_webhook_events older than 90 days';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'stripe_webhook_events table does not exist, skipping';
  WHEN OTHERS THEN
    RAISE WARNING 'Error cleaning stripe_webhook_events: %', SQLERRM;
END;
$$;

-- 3. Schedule daily cleanup jobs using pg_cron (if extension is available)
DO $$
BEGIN
  -- Schedule edge function log cleanup (daily at 2 AM)
  PERFORM cron.schedule(
    'cleanup-edge-function-logs',
    '0 2 * * *',
    $$SELECT clean_edge_function_logs();$$
  );
  
  -- Schedule webhook event cleanup (daily at 3 AM)
  PERFORM cron.schedule(
    'cleanup-webhook-events',
    '0 3 * * *',
    $$SELECT clean_old_webhook_events();$$
  );
  
  RAISE NOTICE 'Scheduled system log cleanup cron jobs';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not available, cleanup functions created but not scheduled';
  WHEN OTHERS THEN
    RAISE WARNING 'Error scheduling cron jobs: %', SQLERRM;
END;
$$;

-- Comments
COMMENT ON FUNCTION clean_edge_function_logs() IS 'Deletes edge function logs older than 7 days to prevent table bloat';
COMMENT ON FUNCTION clean_old_webhook_events() IS 'Deletes Stripe webhook events older than 90 days (reconciliation period)';

