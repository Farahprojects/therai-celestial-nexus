# Pro Subscription Limits Architecture

## The Problem We're Solving

**Before**: Limits scattered across codebase
- Hardcoded in `featureLimits.ts` → requires redeployment to change
- Image gen uses `image_generation_log` table
- Voice uses `feature_usage` table
- Different patterns everywhere
- Adding new features requires code changes + migrations

**After**: Single source of truth, database-driven
- All limits in `plan_limits` table → change without redeployment
- One function to check any limit → `check_feature_limit()`
- Consistent pattern everywhere
- Easy to add new features

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  plan_limits table (SOURCE OF TRUTH)                         │
│  ├── 10_monthly: { voice: 600s, images: 3/day, ... }        │
│  ├── 18_monthly: { voice: NULL (unlimited), ... }           │
│  └── free: { voice: 120s, ... }                             │
│                                                               │
│  feature_usage table (USAGE TRACKING)                        │
│  ├── user_id + period + voice_seconds                        │
│  ├── user_id + period + therai_calls                         │
│  └── user_id + period + insights_count                       │
│                                                               │
│  Database Functions (BUSINESS LOGIC)                         │
│  ├── check_feature_limit() - Check if allowed               │
│  └── get_user_limits() - Get all limits + usage             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                     APPLICATION LAYER                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  limitChecker.ts (TYPESCRIPT SDK)                            │
│  ├── checkLimit(userId, feature, amount)                    │
│  ├── getUserLimits(userId)                                   │
│  └── incrementUsage(userId, feature, amount)                │
│                                                               │
│  Edge Functions (USAGE)                                      │
│  ├── google-whisper: checkLimit('voice_seconds')            │
│  ├── image-generate: checkLimit('image_generation')         │
│  ├── llm-handler-together: checkLimit('therai_calls')       │
│  └── Any new feature: checkLimit('new_feature')             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. `plan_limits` Table
**Single source of truth for all plan configurations**

```sql
CREATE TABLE plan_limits (
  plan_id TEXT PRIMARY KEY,        -- '10_monthly', '18_monthly'
  plan_name TEXT,                   -- 'Growth', 'Premium'
  
  -- Limits (NULL = unlimited)
  voice_seconds_limit INTEGER,
  image_generation_daily_limit INTEGER,
  therai_calls_limit INTEGER,
  insights_limit INTEGER,
  
  -- Feature flags
  has_together_mode BOOLEAN,
  has_priority_support BOOLEAN,
  -- ... etc
);
```

**Example Data**:
```sql
'10_monthly' → { voice: 600, images: 3, therai_calls: NULL }
'18_monthly' → { voice: NULL, images: NULL, therai_calls: NULL }
```

### 2. `check_feature_limit()` Function
**Centralized limit checking**

```sql
check_feature_limit(
  p_user_id UUID,
  p_feature_type TEXT,           -- 'voice_seconds', 'image_generation', etc.
  p_requested_amount INTEGER,
  p_period TEXT
) RETURNS JSONB
```

**Returns**:
```json
{
  "allowed": true,
  "limit": 600,
  "current_usage": 245,
  "remaining": 355,
  "is_unlimited": false
}
```

### 3. `limitChecker.ts` SDK
**TypeScript wrapper for easy usage**

```typescript
import { checkLimit, getUserLimits } from './_shared/limitChecker.ts';

// Check if user can use feature
const result = await checkLimit(supabase, userId, 'voice_seconds', 30);

if (!result.allowed) {
  return error(429, { message: result.reason });
}

// Proceed with feature...
```

## How to Use

### Example 1: Voice Feature (google-whisper)

**Before** (scattered logic):
```typescript
// OLD: Hardcoded config
const FREE_TIER_LIMIT = 120;
const GROWTH_LIMIT = 600;

// Multiple if statements
if (plan === 'free' && usage > 120) { ... }
if (plan === '10_monthly' && usage > 600) { ... }
```

**After** (clean):
```typescript
import { checkLimit } from './_shared/limitChecker.ts';

// Single check for all plans
const check = await checkLimit(supabase, userId, 'voice_seconds', durationSeconds);

if (!check.allowed) {
  return json(429, {
    error: 'Voice limit exceeded',
    limit: check.limit,
    remaining: check.remaining
  });
}

// ✅ Allowed, proceed...
```

### Example 2: New Feature (Together Mode @therai calls)

**Adding a new limited feature is just 3 steps:**

1. **Update plan_limits table** (no code deploy!):
```sql
UPDATE plan_limits 
SET therai_calls_limit = 3 
WHERE plan_id = '10_monthly';
```

2. **Check limit in edge function**:
```typescript
// In llm-handler-together-mode
if (analyze === true) {
  const check = await checkLimit(supabase, userId, 'therai_calls', 1);
  
  if (!check.allowed) {
    return json(200, {
      text: `You've used all ${check.limit} @therai calls this month. Upgrade to Premium for unlimited!`
    });
  }
}
```

3. **Increment after successful use**:
```typescript
await incrementUsage(supabase, userId, 'therai_calls', 1);
```

**Done!** No migrations, no config changes, no redeployment.

### Example 3: UI Display

```typescript
// Get all limits for current user
const data = await getUserLimits(supabase, userId);

// Display in UI
{data.limits.voice_seconds === null ? (
  <span>Unlimited Voice</span>
) : (
  <span>
    {data.usage.voice_seconds} / {data.limits.voice_seconds} minutes
    ({data.limits.voice_seconds - data.usage.voice_seconds} remaining)
  </span>
)}
```

## Benefits

### 1. **Change Limits Without Redeployment**
```sql
-- Adjust Growth plan voice limit from 10 to 15 minutes
UPDATE plan_limits 
SET voice_seconds_limit = 900 
WHERE plan_id = '10_monthly';

-- Takes effect immediately! 🚀
```

### 2. **Consistent Pattern Everywhere**
Every feature uses the same 3-step pattern:
1. Check: `checkLimit()`
2. Use feature
3. Track: `incrementUsage()`

### 3. **Easy to Add Features**
Want to add "AI Sessions per month"?
```sql
-- 1. Add column
ALTER TABLE plan_limits ADD COLUMN ai_sessions_limit INTEGER;

-- 2. Set limits
UPDATE plan_limits SET ai_sessions_limit = 10 WHERE plan_id = '10_monthly';
UPDATE plan_limits SET ai_sessions_limit = NULL WHERE plan_id = '18_monthly';

-- 3. Use in code
const check = await checkLimit(supabase, userId, 'ai_sessions', 1);
```

### 4. **Self-Documenting**
Query to see all plan differences:
```sql
SELECT 
  plan_name,
  voice_seconds_limit,
  image_generation_daily_limit,
  therai_calls_limit
FROM plan_limits
WHERE is_active = true
ORDER BY display_order;
```

## Migration Plan

### Phase 1: Deploy New System (Non-Breaking)
1. ✅ Run migration: `20250208000000_pro_subscription_limits.sql`
2. ✅ New `limitChecker.ts` available but not required yet
3. Old `featureLimits.ts` still works

### Phase 2: Migrate Edge Functions (One by One)
1. **google-whisper**:
   ```typescript
   // Replace old: checkFeatureAccess()
   // With new: checkLimit()
   ```

2. **image-generate**:
   ```typescript
   // Replace: manual count query
   // With: checkLimit('image_generation')
   ```

3. **llm-handler-together-mode** (NEW):
   ```typescript
   // Add: checkLimit('therai_calls')
   ```

### Phase 3: Update Frontend
1. **useFeatureUsage hook**:
   ```typescript
   // Use new: getUserLimits() RPC
   ```

2. **Subscription cards**:
   ```typescript
   // Fetch limits from plan_limits table
   ```

### Phase 4: Cleanup
1. Delete old `featureLimits.ts`
2. Delete old `featureGating.ts`
3. Update tests

## Advanced Features

### A/B Testing Plans
```sql
-- Easily create test variants
INSERT INTO plan_limits (plan_id, plan_name, voice_seconds_limit)
VALUES ('10_monthly_test', 'Growth (Test)', 900); -- 15 minutes

-- Assign users to test
UPDATE profiles SET subscription_plan = '10_monthly_test' WHERE id = '...';
```

### Dynamic Pricing
```sql
-- Holiday promotion: double all limits
UPDATE plan_limits 
SET 
  voice_seconds_limit = voice_seconds_limit * 2,
  image_generation_daily_limit = image_generation_daily_limit * 2
WHERE plan_id IN ('10_monthly', '18_monthly');

-- Revert after promotion
UPDATE plan_limits SET ... ; -- restore original values
```

### Usage Analytics
```sql
-- Who's hitting limits?
SELECT 
  p.email,
  pl.plan_name,
  fu.voice_seconds,
  pl.voice_seconds_limit,
  ROUND(100.0 * fu.voice_seconds / NULLIF(pl.voice_seconds_limit, 0), 1) as usage_pct
FROM profiles p
JOIN plan_limits pl ON p.subscription_plan = pl.plan_id
LEFT JOIN feature_usage fu ON p.id = fu.user_id 
WHERE fu.period = TO_CHAR(NOW(), 'YYYY-MM')
  AND pl.voice_seconds_limit IS NOT NULL
  AND fu.voice_seconds > pl.voice_seconds_limit * 0.8
ORDER BY usage_pct DESC;
```

## Best Practices

### 1. Always Use `checkLimit()` Before Feature Use
```typescript
// ❌ BAD: Check plan directly
if (plan === '10_monthly' && usage > 600) { ... }

// ✅ GOOD: Use centralized check
const check = await checkLimit(supabase, userId, 'voice_seconds', amount);
if (!check.allowed) { ... }
```

### 2. NULL = Unlimited (Not a Large Number)
```sql
-- ❌ BAD
voice_seconds_limit = 999999

-- ✅ GOOD
voice_seconds_limit = NULL
```

### 3. Feature Flags for Binary Features
```sql
-- ❌ BAD: Use limits for on/off features
together_mode_limit = 1  -- to indicate it's available

-- ✅ GOOD: Use boolean flags
has_together_mode = true
```

### 4. Use Descriptive Error Codes
```typescript
if (!check.allowed) {
  return {
    error_code: check.error_code, // 'LIMIT_EXCEEDED', 'NO_SUBSCRIPTION'
    message: getUserFriendlyMessage(check.error_code),
    remaining: check.remaining
  };
}
```

## Testing

```typescript
// Test plan limits
await supabase.rpc('check_feature_limit', {
  p_user_id: testUserId,
  p_feature_type: 'voice_seconds',
  p_requested_amount: 700
});
// Should return: { allowed: false, reason: 'limit exceeded' }

// Test unlimited
await supabase.rpc('check_feature_limit', {
  p_user_id: premiumUserId,
  p_feature_type: 'voice_seconds',
  p_requested_amount: 10000
});
// Should return: { allowed: true, is_unlimited: true }
```

## Summary

**Old Way**: Hardcoded → Scattered → Inflexible
**New Way**: Database-driven → Centralized → Flexible

Change limits in Supabase dashboard → No redeployment → Happy customers 🎉

---

**Files Created**:
- `supabase/migrations/20250208000000_pro_subscription_limits.sql` - Database schema
- `supabase/functions/_shared/limitChecker.ts` - TypeScript SDK
- `PRO_LIMITS_ARCHITECTURE.md` - This guide

**Next Step**: Run the migration and start using `checkLimit()` in your edge functions!

