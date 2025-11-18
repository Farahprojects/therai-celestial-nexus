# Admin App Security Fix

## Problem

The admin app was exposing the Supabase service role key in the frontend code, which is a **critical security vulnerability**. The service role key should never be exposed to client-side code as it bypasses all Row Level Security (RLS) policies and grants full database access.

## Solution

All admin operations have been moved to a secure edge function (`admin-operations`) that:
1. Verifies the requesting user is authenticated
2. Checks that the user has admin role
3. Uses the service role key only on the server side (edge function)
4. Never exposes the service role key to the frontend

## Changes Made

### 1. Created Secure Admin Edge Function
- **File**: `supabase/functions/admin-operations/index.ts`
- **Actions Supported**:
  - `list_users` - List all users with profiles and roles
  - `update_credits` - Add or remove user credits
  - `update_subscription` - Update user subscription plan
  - `toggle_admin_role` - Grant or revoke admin role
  - `get_admin_logs` - Fetch admin activity logs
  - `get_api_usage` - Fetch API usage logs

### 2. Updated Admin App to Use Edge Functions
- **Created**: `admin-app/src/lib/adminApi.ts` - Utility for calling admin operations
- **Updated Hooks**:
  - `useUsers.ts` - Now uses `list_users` action
  - `useActivityLogs.ts` - Now uses `get_admin_logs` and `get_api_usage` actions
- **Updated Components**:
  - `CreditManagement.tsx` - Uses `update_credits` action
  - `SubscriptionPanel.tsx` - Uses `update_subscription` action
  - `RoleManagement.tsx` - Uses `toggle_admin_role` action
  - `MessagesView.tsx` - Updated error message (already using edge function)

### 3. Removed Service Role Key from Frontend
- **Removed**: `supabaseAdmin` export from `admin-app/src/lib/supabase.ts`
- **Removed**: `VITE_SUPABASE_SERVICE_ROLE_KEY` requirement from README
- **Added**: Security comment explaining all admin operations go through edge functions

## Security Benefits

1. **Service Role Key Protection**: The service role key is now only used in server-side edge functions, never exposed to the browser
2. **Admin Verification**: All operations verify the requesting user has admin role before executing
3. **Authentication Required**: All requests require valid authentication tokens
4. **Audit Trail**: All operations can be logged and monitored server-side

## Migration Notes

- The admin app no longer requires `VITE_SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- All existing admin functionality continues to work, but now goes through secure edge functions
- The admin app should be deployed separately from the main therai app to maintain separation

## Next Steps (Optional)

1. Consider adding admin verification to `admin-email-messages` edge function as well
2. Add rate limiting to admin operations edge function
3. Add audit logging for all admin operations
4. Consider separating the admin app into its own repository for better isolation

