-- Remove insights from realtime publication
-- Insights are now using polling (migrated in Phase 1)

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'insights'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE insights;
    RAISE NOTICE '✅ Removed insights from realtime publication';
  ELSE
    RAISE NOTICE '✅ Insights already removed from realtime publication';
  END IF;
END $$;

-- Verify
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND tablename = 'insights'
    ) THEN '❌ Insights still in realtime'
    ELSE '✅ Insights removed from realtime'
  END as insights_status;



