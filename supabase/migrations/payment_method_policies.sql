-- PAYMENT_METHOD CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- User-isolated access with restricted delete operations

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their payment methods" ON public.payment_method;
DROP POLICY IF EXISTS "Users can manage their payment methods" ON public.payment_method;

-- Service role: full access
CREATE POLICY payment_method_service_all ON public.payment_method
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users: SELECT/INSERT/UPDATE own payment methods only
CREATE POLICY payment_method_user_select ON public.payment_method
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY payment_method_user_insert ON public.payment_method
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY payment_method_user_update ON public.payment_method
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Optional: DELETE reserved for service role only (no user hard delete)
-- Users cannot hard delete payment methods - use soft delete or archiving instead
