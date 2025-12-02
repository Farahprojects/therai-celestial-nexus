# Realtime Load Diagnosis - 97% Load Investigation

## Current Status
- ✅ Code is clean (no postgres_changes in source)
- ✅ Conversations RLS policy exists (migration partially applied)
- ⚠️ Still seeing 97% load on `realtime.list_changes`

## Root Cause Analysis

The 97% load means **something is still using postgres_changes**. Since the code is clean, the issue is:

### Most Likely: **Migrations Not Fully Applied**

The database migrations that remove `messages` and `conversations` from the `supabase_realtime` publication may not have been applied.

---

## Diagnostic Steps

### Step 1: Check What Tables Are in Realtime Publication

Run this SQL in Supabase SQL Editor:

```sql
-- Check ALL tables in realtime publication
SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

**Expected Result:**
- ❌ If you see `messages` → Messages migration not applied
- ❌ If you see `conversations` → Conversations migration not fully applied
- ✅ Should NOT see either of these

### Step 2: Check Messages Migration Status

```sql
-- Check if messages table is still in realtime
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND tablename = 'messages'
    ) THEN '❌ MESSAGES STILL IN REALTIME - Run migration'
    ELSE '✅ MESSAGES REMOVED FROM REALTIME'
  END as messages_status;
```

### Step 3: Check Conversations Migration Status

```sql
-- Check if conversations table is still in realtime
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND tablename = 'conversations'
    ) THEN '❌ CONVERSATIONS STILL IN REALTIME - Run migration'
    ELSE '✅ CONVERSATIONS REMOVED FROM REALTIME'
  END as conversations_status;
```

---

## Solution: Apply Missing Migrations

### If Messages Still in Realtime

Run this migration:
```sql
-- From: supabase/migrations/20250211000000_websocket_optimization.sql
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE messages;
  END IF;
END $$;
```

### If Conversations Still in Realtime

The conversations migration (`20251120000006_conversations_broadcast_trigger.sql`) should have removed it, but if it's still there:

```sql
-- Remove conversations from realtime publication
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE conversations;
  END IF;
END $$;
```

---

## Other Potential Causes (Less Likely)

### 1. Other Tables in Realtime Publication

If other high-traffic tables are in the publication:
- `insights` - Should be removed (we use polling)
- `chat_folders` - Usually OK (low traffic)
- `profiles` - Usually OK (low traffic)

### 2. Active Subscriptions from Old Code

If old code is still running somewhere:
- Check browser DevTools → Network → WS (WebSocket) tab
- Look for channels with `postgres_changes` in the name
- Check for duplicate subscriptions

### 3. Edge Functions Using postgres_changes

Check edge functions for any postgres_changes subscriptions:
```bash
grep -r "postgres_changes" supabase/functions/
```

---

## Verification After Fix

After applying migrations, verify:

1. **Check publication status:**
   ```sql
   SELECT tablename 
   FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime'
     AND tablename IN ('messages', 'conversations');
   ```
   Should return **0 rows**.

2. **Monitor performance:**
   - Wait 5-10 minutes
   - Check Supabase performance dashboard
   - `realtime.list_changes` should drop to <10% of DB time

3. **Test functionality:**
   - Send a message → Should appear immediately (via broadcast)
   - Create conversation in folder → Should appear immediately (via broadcast)
   - Update conversation title → Should update immediately (via broadcast)

---

## Quick Fix Script

Run this to apply both migrations at once:

```sql
-- Remove messages from realtime publication
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE messages;
    RAISE NOTICE '✅ Removed messages from realtime publication';
  ELSE
    RAISE NOTICE '✅ Messages already removed from realtime publication';
  END IF;
END $$;

-- Remove conversations from realtime publication
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE conversations;
    RAISE NOTICE '✅ Removed conversations from realtime publication';
  ELSE
    RAISE NOTICE '✅ Conversations already removed from realtime publication';
  END IF;
END $$;

-- Verify
SELECT 
  '📊 FINAL STATUS' as check_name,
  COUNT(CASE WHEN tablename = 'messages' THEN 1 END) as messages_in_realtime,
  COUNT(CASE WHEN tablename = 'conversations' THEN 1 END) as conversations_in_realtime
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversations');
```

**Expected output:**
- `messages_in_realtime`: 0
- `conversations_in_realtime`: 0

---

## Summary

**Most likely cause:** `messages` and/or `conversations` are still in the `supabase_realtime` publication.

**Fix:** Run the quick fix script above to remove them.

**Expected impact:** `realtime.list_changes` load should drop from 97% to <10% within 5-10 minutes.



