# Backup Migrations

## ⚠️ SECURITY WARNING

**This directory contains old migration files that may have hardcoded Supabase URLs and service role keys.**

These files are kept for historical reference but should **NOT** be used in production. They may contain:
- Hardcoded Supabase URLs (e.g., `https://wrvqqvqvwqmfdqvqmaar.supabase.co`)
- Hardcoded service role keys and JWT tokens
- Placeholder service role keys (`[SERVICE_ROLE_KEY]`)

## Security Status

✅ **Active migrations** in `supabase/migrations/` have been cleaned up (see `20251120000007_fix_hardcoded_supabase_credentials.sql`)

⚠️ **Backup migrations** in this directory still contain hardcoded credentials and should be:
- Kept local only (consider moving to private storage)
- Not used for new deployments
- Reviewed before sharing

## Recommendations

1. **For new deployments**: Use only migrations from `supabase/migrations/`
2. **For historical reference**: Keep these backups in a private repository or local storage
3. **Before sharing**: Review and sanitize any hardcoded credentials

## Overview

This directory contains old, redundant migrations that have been backed up for historical reference.

## What was done:
1. **Backed up** all original migrations to this directory
2. **Removed** old migration files from active migrations
3. **Created** consolidated migrations in `supabase/migrations/`

## If you need to restore:
⚠️ **Warning**: These migrations may contain hardcoded credentials. Review and update them before use.

## Next steps:
When you need to make schema changes, create new migrations in `supabase/migrations/` with descriptive names like:
- `20250101000001-add-new-feature.sql`
- `20250101000002-modify-existing-table.sql` 