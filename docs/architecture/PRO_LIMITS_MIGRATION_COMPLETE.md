# Pro Limits Migration - COMPLETE ✅

## Functions Migrated

### 1. ✅ google-whisper (Voice/STT)
**File**: `supabase/functions/google-whisper/index.ts`

**Changes**:
- ❌ Removed: `import { checkFreeTierSTTAccess } from "../_shared/featureGating.ts"`
- ✅ Added: `import { checkLimit, incrementUsage } from "../_shared/limitChecker.ts"`
- ✅ Replaced pre-transcription check with `checkLimit()`
- ✅ Replaced post-transcription check with `checkLimit()`
- ✅ Replaced edge function call with direct `incrementUsage()`

**Old Way** (3 calls):
1. Call `checkFreeTierSTTAccess()` - pre-check
2. Call `checkFreeTierSTTAccess()` - post-check  
3. Call `increment-feature-usage` edge function via HTTP

**New Way** (2 calls):
1. Call `checkLimit()` - pre-check (database function)
2. Call `checkLimit()` + `incrementUsage()` - post-check + increment (database functions)

### 2. ✅ llm-handler-together-mode (@therai limiting)
**File**: `supabase/functions/llm-handler-together-mode/index.ts`

**Changes**:
- ✅ Added: `import { checkLimit, incrementUsage } from "../_shared/limitChecker.ts"`
- ✅ Added @therai limit check before processing request
- ✅ Added increment call after successful response
- ✅ Returns friendly message when limit exceeded

**New Logic**:
```typescript
// Before processing @therai request
const limitCheck = await checkLimit(supabase, user_id, 'therai_calls', 1);

if (!limitCheck.allowed) {
  return json(200, {
    role: 'assistant',
    text: "You've used your 3 @therai insights this month. Upgrade to Premium! ✨",
    meta: { limit_exceeded: true }
  });
}

// After successful response
await incrementUsage(supabase, user_id, 'therai_calls', 1);
```

## Limits Now Active

| Feature | Free | Growth ($10) | Premium ($18) |
|---------|------|--------------|---------------|
| **Voice (STT)** | 120s (2 min) | 600s (10 min) | Unlimited |
| **@therai calls** | 0 | Unlimited* | Unlimited |
| **Image generation** | 0 | 3/day | 3/day** |

*Note: Currently unlimited for Growth - you can change this:
```sql
UPDATE plan_limits SET therai_calls_limit = 3 WHERE plan_id = '10_monthly';
```

**Note: Image generation not migrated yet (still uses old system)

## Benefits of New System

### 1. Database-Driven
- Change limits without redeployment
- Query actual limits: `SELECT * FROM plan_limits;`
- Update anytime: `UPDATE plan_limits SET voice_seconds_limit = 900 WHERE plan_id = '10_monthly';`

### 2. Consistent Pattern
Every feature check now follows same pattern:
```typescript
// 1. Check
const check = await checkLimit(supabase, userId, 'feature_name', amount);
if (!check.allowed) return error();

// 2. Use feature
// ... your logic ...

// 3. Track
await incrementUsage(supabase, userId, 'feature_name', amount);
```

### 3. Single Source of Truth
- All limits: `plan_limits` table
- All usage: `feature_usage` table
- All logic: `check_feature_limit()` SQL function

### 4. Cleaner Code
**Before** (google-whisper):
- 100+ lines of limit checking logic
- HTTP call to separate edge function
- Different patterns for different features

**After** (google-whisper):
- 3 function calls
- No HTTP overhead
- Same pattern for all features

## Old Code Still Present (Not Used)

These files still exist but are **NOT** used by the migrated functions:
- `supabase/functions/_shared/featureLimits.ts` - Hardcoded limits
- `supabase/functions/_shared/featureGating.ts` - Old checking logic
- `supabase/functions/increment-feature-usage/` - Edge function (HTTP wrapper)

**Safe to delete?** Yes, once you verify the migrated functions work correctly.

## Testing Checklist

### Voice (google-whisper)
- [ ] Free user can use 2 minutes, then blocked
- [ ] Growth user can use 10 minutes, then blocked
- [ ] Premium user has unlimited voice
- [ ] Limits reset at start of new month
- [ ] Error messages show correct limits

### @therai (llm-handler-together-mode)
- [ ] Free user blocked from using @therai
- [ ] Growth user can use @therai unlimited times (current config)
- [ ] Premium user can use @therai unlimited times
- [ ] Friendly message shown when limit exceeded
- [ ] Usage tracked correctly in `feature_usage` table

### Database
```sql
-- Check limits are configured correctly
SELECT * FROM plan_limits ORDER BY display_order;

-- Check usage tracking works
SELECT * FROM feature_usage WHERE user_id = 'test-user-id';

-- Test limit function directly
SELECT check_feature_limit('test-user-id'::uuid, 'voice_seconds', 30);
SELECT check_feature_limit('test-user-id'::uuid, 'therai_calls', 1);
```

## How to Test

### 1. Test Voice Limits
```bash
# As free user - should fail after 2 minutes
curl -X POST /functions/v1/google-whisper \
  -H "Authorization: Bearer $USER_TOKEN" \
  --data '{"audio":"...", "chattype":"voice"}'

# Check usage
SELECT voice_seconds FROM feature_usage 
WHERE user_id = 'your-user-id' 
  AND period = TO_CHAR(NOW(), 'YYYY-MM');
```

### 2. Test @therai Limits
```bash
# As Growth user - should work unlimited times (current config)
# Change limit first if you want to test: UPDATE plan_limits SET therai_calls_limit = 3 WHERE plan_id = '10_monthly';

curl -X POST /functions/v1/llm-handler-together-mode \
  -H "Authorization: Bearer $SERVICE_KEY" \
  --data '{"chat_id":"...", "text":"test", "user_id":"..."}'

# Check usage
SELECT therai_calls FROM feature_usage 
WHERE user_id = 'your-user-id' 
  AND period = TO_CHAR(NOW(), 'YYYY-MM');
```

## Next Steps

### Recommended: Migrate Image Generation
Image generation still uses the old hardcoded limit (3/day). Migrate to pro system:

**File**: `supabase/functions/image-generate/index.ts`
```typescript
// Replace manual count query with:
const check = await checkLimit(supabase, user_id, 'image_generation', 1);
```

### Optional: Clean Up Old Code
After testing confirms everything works:
```bash
rm supabase/functions/_shared/featureLimits.ts
rm supabase/functions/_shared/featureGating.ts
rm -rf supabase/functions/increment-feature-usage/
```

### Update Frontend
Update `useFeatureUsage` hook to use new `get_user_limits()` function:
```typescript
const { data } = await supabase.rpc('get_user_limits', {
  p_user_id: userId
});
```

## Rollback Plan

If something breaks:
1. The old code files still exist
2. Revert the import statements in both functions
3. Old system will work immediately
4. No data loss (both systems use same `feature_usage` table)

---

**Status**: ✅ Migration Complete - Ready for Testing  
**Date**: 2025-11-09  
**Files Modified**: 2  
**Old Code Cleaned**: Yes (from migrated functions)  
**Database Schema**: Updated (pro limits system deployed)

