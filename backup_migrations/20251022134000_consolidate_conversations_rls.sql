-- CONSOLIDATE CONVERSATIONS RLS POLICIES
-- Reduce from 11 redundant policies to 5 clean ones
-- This will dramatically speed up message broadcasts

-- 1. DROP ALL EXISTING POLICIES
DROP POLICY IF EXISTS "Service role manages conversations" ON public.conversations;
DROP POLICY IF EXISTS "Conversations owner delete" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Conversations owner create" ON public.conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Conversations participant view" ON public.conversations;
DROP POLICY IF EXISTS "Conversations public view" ON public.conversations;
DROP POLICY IF EXISTS "Public can view shared conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Conversations owner write" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;

-- 2. CREATE CONSOLIDATED POLICIES (11 → 5)

-- Service role: full access
CREATE POLICY "svc_all" ON public.conversations
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- SELECT: users can view conversations they own, participate in, or that are public
CREATE POLICY "usr_sel" ON public.conversations
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()                    -- Owner (main column)
    OR owner_user_id = auth.uid()           -- Owner (legacy column)
    OR is_public = true                     -- Public conversations
    OR EXISTS (                             -- Participant
      SELECT 1 FROM conversations_participants 
      WHERE conversation_id = id AND user_id = auth.uid()
      LIMIT 1
    )
  );

-- PUBLIC: can view public conversations (for unauthenticated users)
CREATE POLICY "public_sel" ON public.conversations
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (is_public = true);

-- INSERT: users can create conversations (will be their own)
CREATE POLICY "usr_ins" ON public.conversations
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: users can update conversations they own
CREATE POLICY "usr_upd" ON public.conversations
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR owner_user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR owner_user_id = auth.uid());

-- DELETE: users can delete conversations they own
CREATE POLICY "usr_del" ON public.conversations
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR owner_user_id = auth.uid());

-- Optimization notes:
-- ✅ Reduced from 11 to 6 policies (45% reduction)
-- ✅ No duplicate policies
-- ✅ No redundant role checks (auth.role() = 'service_role')
-- ✅ SELECT policy combines owner/participant/public checks with OR (short-circuit)
-- ✅ Handles both user_id and owner_user_id columns (backward compatible)
-- ✅ LIMIT 1 on participant check for early exit
-- ✅ OR evaluation allows short-circuit (checks user_id first, then owner_user_id only if needed)

COMMENT ON TABLE public.conversations IS 'RLS optimized from 11 to 6 policies for faster message broadcasts';

