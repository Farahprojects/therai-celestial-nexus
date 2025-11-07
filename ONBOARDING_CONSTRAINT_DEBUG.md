# Onboarding Conversation Mode Constraint Issue - Debug Guide

## Issue
Onboarding fails with error: `conversations_mode_check` constraint violation when trying to create conversations.

## Root Cause Analysis
The constraint should allow 'profile' and 'together' modes, but the edge function is rejecting inserts. This suggests one of:
1. Edge functions are using a cached database schema
2. The migration wasn't applied to the correct environment
3. There's a type coercion issue with the mode value

## Diagnostic Steps

### Step 1: Verify Database Constraint
Run this query in your Supabase SQL Editor:

```sql
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition,
  convalidated AS is_validated
FROM pg_constraint
WHERE conrelid = 'public.conversations'::regclass
  AND conname = 'conversations_mode_check';
```

**Expected Result:** The definition should include 'profile' and 'together' in the ARRAY.

### Step 2: Check Existing Conversations
```sql
SELECT mode, COUNT(*) as count
FROM public.conversations
GROUP BY mode
ORDER BY count DESC;
```

This shows what mode values currently exist in your database.

### Step 3: Run Comprehensive Fix
Execute the SQL file: `fix_mode_constraint_issue.sql`

This will:
- Check current constraint
- Check existing mode values
- Drop and recreate the constraint
- Test that 'profile' mode works

### Step 4: Redeploy Edge Functions
The edge functions may have cached the old schema. Redeploy with:

```bash
npx supabase functions deploy conversation-manager
```

### Step 5: Check Edge Function Logs
After deploying the updated conversation-manager (with added logging), run the onboarding flow and check the logs in Supabase Dashboard > Edge Functions > conversation-manager > Logs.

Look for:
```
[conversation-manager] create_conversation called with:
[conversation-manager] About to insert conversation with:
```

This will show the actual mode value being passed and its type.

## Expected Behavior
- Profile conversation should be created with `mode='profile'` and `profile_mode=true`
- Chat conversation should be created with `mode='chat'`
- Both should succeed without constraint violations

## If Still Failing
1. Check that you're testing against the correct Supabase project (not staging/dev)
2. Verify the edge function is using the correct database connection
3. Check for any database replicas or read-only connections
4. Look at the full error in edge function logs - it may reveal more details

## Files Modified
- `supabase/functions/conversation-manager/index.ts` - Added comprehensive logging
- `fix_mode_constraint_issue.sql` - Diagnostic and fix script
- `debug_constraints.sql` - Quick constraint check

