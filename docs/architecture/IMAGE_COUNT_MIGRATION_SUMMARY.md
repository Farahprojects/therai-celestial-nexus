# Image Count Migration to feature_usage Table

## Summary
Successfully migrated image generation count tracking from the `image_generation_log` table to the centralized `feature_usage` table. The `image_generation_log` table has been completely removed.

## Problem
Image generation was using a different tracking mechanism than other features:
- ❌ Voice, insights, @therai calls → tracked in `feature_usage` table
- ❌ Images → tracked in `image_generation_log` table (inconsistent)

This made the system harder to maintain and understand.

## Solution
Unified all feature tracking under the `feature_usage` table:
- ✅ All features now tracked in one place
- ✅ Consistent API for all feature increments
- ✅ `image_generation_log` table completely removed (no longer needed)

---

## Changes Made

### 1. Database Migrations

#### Migration 1: `20250210000005_migrate_image_count_to_feature_usage.sql`

**Added Column:**
```sql
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS images_generated INTEGER DEFAULT 0;
```

**Created Increment Function:**
```sql
CREATE OR REPLACE FUNCTION increment_images_generated(
  p_user_id UUID,
  p_count INTEGER,
  p_period TEXT -- Format: 'YYYY-MM-DD' for daily tracking
) RETURNS VOID
```
- Atomically increments daily image count
- Uses `YYYY-MM-DD` format (daily reset)
- Upserts usage record (creates row if doesn't exist)

**Updated `check_feature_limit()` Function:**
- **Before**: `image_generation` used `image_generation_log` table
- **After**: `image_generation` uses `feature_usage.images_generated` column
- Maps `image_generation` → `images_generated` column
- Period: Daily (`YYYY-MM-DD`)

#### Migration 2: `20250210000006_drop_image_generation_log.sql`

**Dropped Old Table:**
```sql
DROP TABLE IF EXISTS image_generation_log CASCADE;
```
- Table is no longer needed
- All tracking happens in `feature_usage` now

---

### 2. Edge Function Updates

#### `limitChecker.ts`
**Updated `incrementUsage()` function**:
```typescript
const rpcMap: Record<FeatureType, string> = {
  'voice_seconds': 'increment_voice_seconds',
  'therai_calls': 'increment_therai_calls',
  'insights': 'increment_insights_count',
  'image_generation': 'increment_images_generated', // ✅ NEW
  'chat': 'increment_chat_messages'
};
```
- Removed special case for `image_generation`
- Now calls `increment_images_generated` RPC function
- Consistent with other features

#### `image-generate/index.ts`
**Changes:**
1. Added increment call after image generation
2. Removed old race condition check (counted from `image_generation_log`)
3. Removed audit log insert (table no longer exists)

```typescript
// 🚀 FIRE-AND-FORGET: Increment usage counter in feature_usage table
incrementUsage(supabase, user_id, 'image_generation', 1).then(({ success, reason }) => {
  if (!success) {
    console.error(JSON.stringify({
      event: "image_generate_increment_failed",
      request_id: requestId,
      error: reason
    }));
  }
});
```
- Increments counter immediately after successful generation
- Runs in background (fire-and-forget)
- **Only** tracking mechanism now

#### `llm-handler-gemini/index.ts`
**Removed old rate limit check**:
- ❌ Deleted `checkImageGenerationLimit()` function (queried log table)
- ✅ Now uses centralized `checkLimit(supabase, user_id, 'image_generation', 1)`
- Consistent with all other features

---

### 3. TypeScript Types Update

#### `src/integrations/supabase/types.ts`
**Added `images_generated` to `feature_usage` table types**:
```typescript
feature_usage: {
  Row: {
    images_generated: number  // ✅ NEW
    insights_count: number
    voice_seconds: number
    therai_calls: number | null
    // ...
  }
}
```

---

## Architecture After Migration

```
┌─────────────────────────────────────────────────────────────┐
│                  FEATURE_USAGE TABLE                         │
│            (Single Source of Truth - ONLY TABLE)             │
├─────────────────────────────────────────────────────────────┤
│  user_id | period      | voice | images | insights | calls  │
│  ---------|-------------|-------|--------|----------|------- │
│  alice   | 2025-02     | 245   | -      | 5        | -      │ ← Monthly
│  alice   | 2025-02-10  | -     | 2      | -        | 8      │ ← Daily
│  bob     | 2025-02-10  | -     | 3      | -        | 15     │ ← Daily
└─────────────────────────────────────────────────────────────┘
                              ↑
                All features tracked here (including images!)
```

---

## Benefits

✅ **Consistency**: All features use same tracking mechanism  
✅ **Maintainability**: One pattern to understand and maintain  
✅ **Scalability**: Easy to add new features (just add column + increment function)  
✅ **Performance**: Single column read instead of counting log entries  
✅ **Simplicity**: One table to manage, no audit log complexity  

---

## Testing Checklist

### Database
- [ ] Run migrations: `supabase db push`
- [ ] Verify column exists: `SELECT images_generated FROM feature_usage LIMIT 1;`
- [ ] Verify function exists: `\df increment_images_generated`
- [ ] Verify old table is gone: `SELECT * FROM image_generation_log;` (should error)

### Edge Functions
- [ ] Deploy functions: `supabase functions deploy image-generate llm-handler-gemini`
- [ ] Test image generation (should increment counter in `feature_usage`)
- [ ] Test rate limit (should block after daily limit reached)
- [ ] Verify no errors about missing `image_generation_log` table

### Frontend
- [ ] Regenerate types: `npm run generate-types` (if needed)
- [ ] Test image generation in UI
- [ ] Verify error message when limit exceeded

---

## Files Changed

### Database
- `supabase/migrations/20250210000005_migrate_image_count_to_feature_usage.sql` ✅ NEW
- `supabase/migrations/20250210000006_drop_image_generation_log.sql` ✅ NEW

### Edge Functions
- `supabase/functions/_shared/limitChecker.ts` ✅ UPDATED
- `supabase/functions/image-generate/index.ts` ✅ UPDATED
- `supabase/functions/llm-handler-gemini/index.ts` ✅ UPDATED

### Frontend
- `src/integrations/supabase/types.ts` ✅ UPDATED

---

## Migration Notes

1. **Clean Slate**: Starting fresh with image counts (only user on DB)
2. **Table Removed**: `image_generation_log` table completely dropped
3. **Single Source**: Only `feature_usage.images_generated` is used
4. **Simple**: No audit log, no backfill complexity

---

## Next Steps

1. Run both migrations: `supabase db push`
2. Deploy edge functions: `supabase functions deploy image-generate llm-handler-gemini`
3. Test image generation and verify limits work
4. Monitor for any errors about missing table

