-- ============================================================================
-- WEB LEADS SECURITY SETUP
-- ============================================================================
-- Setup secure access control for web_leads table
-- Only admin users and edge system processes can access this table
-- Read-only access with optional commented insert/update/delete policies
-- This migration documents the already-deployed security configuration
-- ============================================================================

-- Helpers (reuse if already exist)
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from anon, authenticated;

create or replace function public.is_edge_system() returns boolean
language sql stable as $$
  select (select auth.jwt() ->> 'edge_role') = 'system';
$$;

revoke execute on function public.is_edge_system() from anon, authenticated;

-- Replace existing policies on web_leads
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'web_leads'
  ) LOOP
    EXECUTE format('drop policy if exists %I on public.web_leads;', r.policyname);
  END LOOP;
END $$;

-- Admin or Edge system can SELECT web leads
create policy "Admin or edge select web_leads" on public.web_leads
for select to authenticated
using ( public.is_admin() or public.is_edge_system() );

-- Optional: allow Edge/admin to insert if needed (commented out)
-- create policy "Admin or edge insert web_leads" on public.web_leads
-- for insert to authenticated
-- with check ( public.is_admin() or public.is_edge_system() );

-- Optional: allow updates/deletes if needed (commented out)
-- create policy "Admin or edge update web_leads" on public.web_leads
-- for update to authenticated
-- using ( public.is_admin() or public.is_edge_system() )
-- with check ( public.is_admin() or public.is_edge_system() );
-- create policy "Admin or edge delete web_leads" on public.web_leads
-- for delete to authenticated
-- using ( public.is_admin() or public.is_edge_system() );

-- Revoke broad grants
revoke select, insert, update, delete on public.web_leads from authenticated;
