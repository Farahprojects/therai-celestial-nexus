-- SECURITY FIX: folder_documents DELETE policy should use authenticated role, not public
-- Issue: DELETE policy was using public role instead of authenticated, violating least-privilege principle
-- Fix: Drop any public DELETE policies and create proper authenticated DELETE policy

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- First, identify and drop any DELETE policies that use the public role
    FOR policy_record IN
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'folder_documents'
          AND cmd = 'DELETE'
          AND 'public' = ANY(roles)
    LOOP
        RAISE NOTICE 'Dropping insecure DELETE policy: %', policy_record.policyname;
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.folder_documents;', policy_record.policyname);
    END LOOP;

    -- Now create the proper authenticated DELETE policy
    -- Users can delete documents they own AND that are in folders they own
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'folder_documents' 
          AND policyname = 'Users can delete their own documents'
    ) THEN
        CREATE POLICY "Users can delete their own documents" ON public.folder_documents
        FOR DELETE TO authenticated
        USING (
          (SELECT auth.uid()) = user_id
          AND EXISTS (
            SELECT 1 FROM public.chat_folders cf
            WHERE cf.id = folder_documents.folder_id
              AND cf.user_id = (SELECT auth.uid())
          )
        );
        
        RAISE NOTICE 'Created secure DELETE policy: Users can delete their own documents';
    END IF;

    -- Verify the fix
    RAISE NOTICE 'Final DELETE policies on folder_documents:';
    FOR policy_record IN
        SELECT policyname, roles
        FROM pg_policies 
        WHERE tablename = 'folder_documents'
          AND cmd = 'DELETE'
    LOOP
        RAISE NOTICE '  - %: %', policy_record.policyname, policy_record.roles;
    END LOOP;

END $$;
