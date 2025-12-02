-- ============================================================================
-- LANDING PAGE CONFIG SECURITY SETUP
-- ============================================================================
-- Setup secure access control for landing_page_config table
-- Only admin users and edge system processes can access this table
-- This migration documents the already-deployed security configuration
-- ============================================================================

-- Ensure helper exists from prior step
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from anon, authenticated;

-- Create helper to check edge/system JWT claim without exposing logic
create or replace function public.is_edge_system() returns boolean
language sql stable as $$
  select (select auth.jwt() ->> 'edge_role') = 'system';
$$;

revoke execute on function public.is_edge_system() from anon, authenticated;

-- Clean up existing policies on landing_page_config
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'landing_page_config'
  ) LOOP
    EXECUTE format('drop policy if exists %I on public.landing_page_config;', r.policyname);
  END LOOP;
END $$;

-- Admin or Edge system can SELECT
create policy "Admin or edge select" on public.landing_page_config
for select to authenticated
using ( public.is_admin() or public.is_edge_system() );

-- Admin or Edge system can INSERT
create policy "Admin or edge insert" on public.landing_page_config
for insert to authenticated
with check ( public.is_admin() or public.is_edge_system() );

-- Admin or Edge system can UPDATE
create policy "Admin or edge update" on public.landing_page_config
for update to authenticated
using ( public.is_admin() or public.is_edge_system() )
with check ( public.is_admin() or public.is_edge_system() );

-- Admin or Edge system can DELETE
create policy "Admin or edge delete" on public.landing_page_config
for delete to authenticated
using ( public.is_admin() or public.is_edge_system() );

-- Optional: Revoke broad grants (RLS still governs access)
revoke select, insert, update, delete on public.landing_page_config from authenticated;
