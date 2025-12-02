-- USER_IMAGES CONSOLIDATED POLICIES
-- Reference implementation for user image management
-- User isolation with conditional policy creation

-- Safe creation of user image modification policy
DO $$
BEGIN
  -- Only create if policy doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_images'
      AND policyname = 'user_images_user_modify'
  ) THEN
    EXECUTE '
      CREATE POLICY user_images_user_modify ON public.user_images
      FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
    ';
  END IF;
END $$;
