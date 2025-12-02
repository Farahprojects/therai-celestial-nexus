# Supabase Credentials Migration Guide

## Problem

Several SQL migrations contained hardcoded Supabase URLs and service role keys, which is a security risk. These credentials should never be committed to version control.

## Solution

Created migration `20251120000007_fix_hardcoded_supabase_credentials.sql` that:
1. Replaces hardcoded URLs with environment-based configuration
2. Removes hardcoded service role keys and JWT tokens
3. Uses Supabase settings and Vault for secure credential storage

## Affected Functions

1. **`call_process_guest_report_pdf()`** - Calls edge function to process guest report PDFs
2. **`rpc_notify_orchestrator()`** - Notifies orchestrator when reports are ready
3. **`trigger_process_memory_buffer()`** - Triggers memory buffer processing

## Configuration Required

After applying this migration, you need to configure the following:

### Option 1: Using Supabase Settings (Recommended for Production)

```sql
-- Set Supabase URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';

-- Set service role key (if not using Vault)
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

-- Set anon key (for memory buffer function)
ALTER DATABASE postgres SET app.settings.anon_key = 'your-anon-key';
```

### Option 2: Using Supabase Vault (Most Secure)

```sql
-- Store service role key in Vault
SELECT vault.create_secret('your-service-role-key', 'service_role_key');

-- Store anon key in Vault
SELECT vault.create_secret('your-anon-key', 'anon_key');
```

### Option 3: Using Project Reference

If you only set the project reference, the URL will be constructed automatically:

```sql
ALTER DATABASE postgres SET app.settings.project_ref = 'your-project-ref';
```

## Migration Files to Review

The following migration files still contain hardcoded URLs (these are remote schema dumps and will be overridden by the new migration):

- `20251028230808_remote_schema.sql` - Contains hardcoded URLs and `[SERVICE_ROLE_KEY]` placeholder
- `20251112030000_remote_schema.sql` - Contains hardcoded URLs and `[SERVICE_ROLE_KEY]` placeholder

**Note:** These are schema dumps from Supabase. The new migration `20251120000007_fix_hardcoded_supabase_credentials.sql` will override the functions with secure versions.

## Security Benefits

1. ✅ No hardcoded credentials in version control
2. ✅ Credentials stored securely in Supabase Vault or database settings
3. ✅ Easy to rotate credentials without code changes
4. ✅ Different credentials per environment (dev/staging/prod)

## Verification

After applying the migration and configuring credentials, test the functions:

```sql
-- Test URL retrieval
SELECT public.get_supabase_url();

-- Test service role key retrieval (should only work for service_role)
SELECT public.get_service_role_key();
```

## Next Steps

1. Apply the migration: `supabase migration up`
2. Configure credentials using one of the options above
3. Test the affected functions
4. Remove any remaining hardcoded credentials from other files
5. Consider moving sensitive migrations to a private repository

