# How to Use Pro Limits System - Real Examples

## Before & After Comparison

### Voice Feature (google-whisper)

#### BEFORE: Scattered Logic ❌
```typescript
// OLD: supabase/functions/google-whisper/index.ts
import { checkFreeTierSTTAccess } from './_shared/featureGating.ts';

// Hardcoded limits
const FREE_TIER_LIMIT = 120;
// ... somewhere else ...
const GROWTH_LIMIT = 600;

// Multiple checks scattered
const freeTierCheck = await checkFreeTierSTTAccess(supabase, userId, durationSeconds);

if (!freeTierCheck.allowed) {
  const limitMinutes = Math.floor(freeTierCheck.limit / 60);
  const message = freeTierCheck.limit === 120 
    ? "You've used your 2 minutes..."
    : `You've used your ${limitMinutes} minutes...`;
  // ... lots of conditional logic
}
```

#### AFTER: Clean & Simple ✅
```typescript
// NEW: supabase/functions/google-whisper/index.ts
import { checkLimit, incrementUsage } from './_shared/limitChecker.ts';

// 1. Check limit (works for ALL plans)
const check = await checkLimit(supabase, userId, 'voice_seconds', durationSeconds);

if (!check.allowed) {
  // Dynamic message based on database config
  const minutes = check.limit ? Math.floor(check.limit / 60) : 0;
  return json(429, {
    code: 'STT_LIMIT_EXCEEDED',
    message: `You've used your ${minutes} minutes of voice this month.`,
    limit: check.limit,
    remaining: check.remaining
  });
}

// 2. Transcribe audio...
const { transcript } = await transcribeWithGoogle(...);

// 3. Track usage (automatic, consistent)
await incrementUsage(supabase, userId, 'voice_seconds', durationSeconds);

return json(200, { transcript });
```

**Benefits**:
- 80% less code
- Works for all plans automatically
- Change limits in database without redeployment
- Consistent error handling

#### Voice Usage RPCs Under the Hood
The helper in `_shared/limitChecker.ts` now proxies to the dedicated voice RPCs so everything stays in SQL:

```typescript
export async function checkLimit(supabase, userId, feature, amount) {
  if (feature === 'voice_seconds') {
    const { data, error } = await supabase.rpc('check_voice_limit', {
      p_user_id: userId,
      p_requested_seconds: amount,
    });
    if (error) throw error;
    return data;
  }
  // ... existing feature_usage lookups
}

export async function incrementUsage(supabase, userId, feature, amount) {
  if (feature === 'voice_seconds') {
    const { error } = await supabase.rpc('increment_voice_usage', {
      p_user_id: userId,
      p_seconds: amount,
    });
    if (error) throw error;
    return;
  }
  // ... existing feature_usage increments
}
```

This keeps the edge function ergonomics identical while shifting the real work into the `voice_usage` table and its helpers.

---

## Adding New Feature: Together Mode @therai Limit

Let's say you want to limit @therai calls to 3/month for Growth, unlimited for Premium.

### Step 1: Update Database (No Code Changes!)
```sql
-- Run in Supabase SQL Editor
UPDATE plan_limits 
SET therai_calls_limit = 3 
WHERE plan_id = '10_monthly';

-- Premium stays unlimited (NULL)
UPDATE plan_limits 
SET therai_calls_limit = NULL 
WHERE plan_id = '18_monthly';
```

### Step 2: Use in Edge Function
```typescript
// supabase/functions/llm-handler-together-mode/index.ts
import { checkLimit, incrementUsage } from './_shared/limitChecker.ts';

Deno.serve(async (req) => {
  const { chat_id, analyze, user_id } = await req.json();
  
  // Only check limit when @therai is invoked
  if (analyze === true && user_id) {
    // 1. Check if user can make this call
    const check = await checkLimit(supabase, user_id, 'therai_calls', 1);
    
    if (!check.allowed) {
      // User hit limit - show friendly message
      return json(200, {
        role: 'assistant',
        text: `You've used all ${check.limit} @therai calls this month. Upgrade to Premium for unlimited relationship insights! 💫`,
        meta: { limit_exceeded: true }
      });
    }
    
    // 2. User has access - proceed with analysis
    const response = await analyzeWithAI(...);
    
    // 3. Track this @therai call
    await incrementUsage(supabase, user_id, 'therai_calls', 1);
    
    return json(200, response);
  }
  
  // Regular peer-to-peer message (no limit check needed)
  return json(200, { saved: true });
});
```

**Done!** Feature is now limited. No migrations, no config files, just one function call.

---

## UI: Show User Their Limits

### Get All Limits and Usage
```typescript
// src/hooks/useSubscriptionLimits.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSubscriptionLimits() {
  const { user } = useAuth();
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchLimits = async () => {
      const { data, error } = await supabase.rpc('get_user_limits', {
        p_user_id: user.id
      });

      if (!error && data) {
        setLimits(data);
      }
      setLoading(false);
    };

    fetchLimits();
  }, [user]);

  return { limits, loading };
}
```

### Display in UI
```typescript
// src/components/settings/UsageDisplay.tsx
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';

export function UsageDisplay() {
  const { limits, loading } = useSubscriptionLimits();

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Voice Usage */}
      <UsageCard
        title="Voice Minutes"
        icon={<Mic />}
        usage={limits.usage.voice_seconds / 60}
        limit={limits.limits.voice_seconds ? limits.limits.voice_seconds / 60 : null}
        unit="minutes"
      />

      {/* @therai Calls */}
      {limits.limits.therai_calls !== null && (
        <UsageCard
          title="@therai Calls"
          icon={<Sparkles />}
          usage={limits.usage.therai_calls}
          limit={limits.limits.therai_calls}
          unit="calls"
        />
      )}

      {/* Image Generation */}
      <UsageCard
        title="Images Today"
        icon={<Image />}
        usage={limits.usage.images_today}
        limit={limits.limits.image_generation_daily}
        unit="images"
      />
    </div>
  );
}

function UsageCard({ title, icon, usage, limit, unit }) {
  const isUnlimited = limit === null;
  const percentage = isUnlimited ? 0 : (usage / limit) * 100;
  const isWarning = percentage > 80;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        {isUnlimited ? (
          <span className="text-sm text-gray-500">Unlimited ✨</span>
        ) : (
          <span className={`text-sm ${isWarning ? 'text-orange-500' : 'text-gray-500'}`}>
            {usage} / {limit} {unit}
          </span>
        )}
      </div>
      
      {!isUnlimited && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${isWarning ? 'bg-orange-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          {isWarning && (
            <p className="text-xs text-orange-600 mt-1">
              Running low! Upgrade for unlimited.
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

---

## Image Generation (Already Has Limits)

Current image generation already uses a limit (3/day), but it's checking manually. Let's make it use the new system:

### BEFORE ❌
```typescript
// supabase/functions/image-generate/index.ts

// Manual count query
const { count } = await supabase
  .from('image_generation_log')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user_id)
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

if (count && count >= 3) {
  return json(429, {
    error: 'Daily limit reached',
    limit: 3
  });
}
```

### AFTER ✅
```typescript
// supabase/functions/image-generate/index.ts
import { checkLimit } from './_shared/limitChecker.ts';

// Clean check using centralized system
const check = await checkLimit(supabase, user_id, 'image_generation', 1);

if (!check.allowed) {
  return json(429, {
    error: 'Daily image generation limit reached',
    limit: check.limit,
    remaining: check.remaining,
    message: check.is_unlimited 
      ? 'Premium users have unlimited images!'
      : `You've used ${check.limit} images today. ${check.remaining} remaining.`
  });
}

// Generate image...
// Log happens automatically via image_generation_log table
```

---

## Testing Your Limits

### Test in Supabase SQL Editor
```sql
-- Test Growth user hitting voice limit
SELECT check_feature_limit(
  'user-uuid-here'::uuid,
  'voice_seconds',
  700,  -- requesting 700 seconds
  NULL
);
-- Should return: { "allowed": false, "limit": 600, ... }

-- Test Premium user (unlimited)
SELECT check_feature_limit(
  'premium-user-uuid'::uuid,
  'voice_seconds',
  10000,  -- requesting huge amount
  NULL
);
-- Should return: { "allowed": true, "is_unlimited": true }

-- View all limits
SELECT * FROM plan_limits WHERE is_active = true;

-- View user's current usage
SELECT * FROM feature_usage WHERE user_id = 'user-uuid-here'::uuid;
```

### Test in Edge Function
```typescript
// Test limit checking
const testResult = await checkLimit(supabase, testUserId, 'voice_seconds', 100);
console.log('Limit check:', testResult);

// Test incrementing
await incrementUsage(supabase, testUserId, 'voice_seconds', 100);

// Verify increment worked
const afterCheck = await checkLimit(supabase, testUserId, 'voice_seconds', 0);
console.log('After increment:', afterCheck.current_usage); // Should be +100
```

---

## Quick Reference

### Common Operations

```typescript
// ✅ Check any feature limit
const check = await checkLimit(supabase, userId, featureType, amount);

// ✅ Get all user limits (for UI)
const data = await getUserLimits(supabase, userId);

// ✅ Track usage after successful feature use
await incrementUsage(supabase, userId, featureType, amount);

// ✅ Update limits (in SQL, no deployment!)
UPDATE plan_limits SET voice_seconds_limit = 900 WHERE plan_id = '10_monthly';
```

### Feature Types
- `'voice_seconds'` - Voice/STT usage (monthly)
- `'image_generation'` - Image creation (daily)
- `'therai_calls'` - @therai in Together Mode (monthly)
- `'insights'` - Report generation (monthly)

### Return Values
```typescript
{
  allowed: boolean,           // Can user access feature?
  limit: number | null,       // NULL = unlimited
  current_usage: number,      // Current period usage
  remaining: number,          // How much left
  is_unlimited: boolean,      // Premium feature
  reason?: string,            // Why denied
  error_code?: string         // Machine-readable code
}
```

---

## Migration Checklist

- [ ] Run migrations (20250208000000, 20250208000001)
- [ ] Verify plan_limits table populated
- [ ] Test check_feature_limit() in SQL editor
- [ ] Update google-whisper to use checkLimit()
- [ ] Update image-generate to use checkLimit()
- [ ] Add @therai limit in llm-handler-together-mode
- [ ] Update frontend to use getUserLimits()
- [ ] Remove old featureLimits.ts and featureGating.ts
- [ ] Test with free, Growth, and Premium users
- [ ] Update documentation

---

**That's it!** You now have a professional, database-driven limits system that's:
- ✅ Centralized (one place to check/update)
- ✅ Flexible (change limits without deployment)
- ✅ Consistent (same pattern everywhere)
- ✅ Scalable (add features in minutes)

Questions? Check `PRO_LIMITS_ARCHITECTURE.md` for deep dive!

