# Plus Plan A/B Test Implementation

## Summary
Successfully implemented the Plus plan ($8/month) as an A/B test alternative to the Growth plan ($10/month). Users can be assigned to see either Plus or Growth, allowing for price/feature testing.

## Plus Plan ($8/month) - Features

| Feature | Allowance |
|---------|-----------|
| **Core AI Chat** | ✅ Unlimited |
| **Together Mode** | ✅ Included (2-person sessions) |
| **AI Memory & History** | ✅ Enabled & Unlimited |
| **My Folders** | ✅ Unlimited creation & sharing |
| **Sharing Threads** | ✅ Unlimited |
| **Image Generation** | 🎨 1 Image per day (~30/month) |
| **Voice Mode (Premium HD)** | 🎤 5 Minutes per month (300 seconds) |

## Cost Analysis

### Plus Plan Monthly Costs (per power user)

| Feature | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| Voice (STT) | 5 minutes | ~$0.006/min | $0.03 |
| Voice (TTS) | ~5 minutes | ~$0.016/min | $0.08 |
| Images | 1/day = 30/month | ~$0.02/image | $0.60 |
| LLM tokens | ~variable, light use | Estimated avg | $0.50 |
| **Total Estimated Cost** | | | **~$1.21/month** |

**Margin**: $8 - $1.21 = **$6.79 per user** (~85% margin)

### Comparison with Growth Plan

| Metric | Plus ($8) | Growth ($10) | Premium ($18) |
|--------|-----------|--------------|---------------|
| **Voice/Month** | 5 min | 10 min | Unlimited |
| **Images/Day** | 1 | 3 | Unlimited |
| **Est. Cost** | $1.21 | $2.02 | Variable |
| **Margin** | $6.79 (85%) | $7.98 (80%) | ~$15+ (83%) |
| **Value Prop** | Budget-friendly | Balanced | Power users |

## Implementation Details

### 1. Database Migration
**File**: `supabase/migrations/20251112040000_add_plus_plan_ab_test.sql`

Added:
- `ab_test_group` column to `profiles` table (TEXT, nullable)
- Plus plan (`8_monthly`) to `plan_limits` table:
  - `voice_seconds_limit`: 300 (5 minutes)
  - `image_generation_daily_limit`: 1
  - `therai_calls_limit`: NULL (unlimited)
  - `insights_limit`: NULL (unlimited)
- Plus plan to `price_list` table:
  - Stripe Price ID: `price_1SSizlJ1YhE4Ljp0ldtlN0j6`
  - Unit price: $8.00
- Helper function `assign_ab_test_group()` for random 50/50 assignment

### 2. UI Components Updated

#### Subscription Cards
**Files**:
- `src/components/paywall/SubscriptionCard.tsx`
- `src/pages/SubscriptionPaywall.tsx`
- `src/pages/Pricing.tsx`

Changes:
- Added `Plus` to plan tier types
- Added Plus plan features (5 min voice, 1 image/day)
- Implemented A/B test filtering logic:
  - Users with `ab_test_group = 'plus_plan'` → see Plus, hidden Growth
  - Users with `ab_test_group = 'growth_plan'` → see Growth, hidden Plus
  - Users with no group → see Growth by default

#### Settings Panel
**File**: `src/components/settings/panels/BillingPanel.tsx`

Changes:
- Updated `getPlanName()` to recognize `8_monthly` as "Plus"

### 3. Feature Gating (Automatic)

The existing limit checking system automatically handles Plus plan limits:

**Voice Limits** (`supabase/functions/google-whisper/index.ts`):
- Uses `check_voice_limit` RPC function
- Pulls limit from `plan_limits` table
- Plus users: 300 seconds (5 minutes) per month

**Image Limits** (`supabase/functions/image-generate/index.ts`):
- Uses `checkLimit` from `limitChecker.ts`
- Queries `plan_limits.image_generation_daily_limit`
- Plus users: 1 image per day (rolling 24-hour window)

No code changes needed—database-driven limits!

### 4. FAQ & Support Content
**File**: `src/constants/supportContent.ts`

Updated FAQ entries:
- `bill-1`: Added Plus to plan offerings
- `bill-2`: Explained Plus vs Growth vs Premium differences
- `bill-3`: Added Plus to subscription options
- `bill-4`: Included Plus in upgrade/downgrade flows
- `feat-4`: Added Plus to voice mode availability

## A/B Testing Strategy

### Assignment Logic

Users can be assigned to A/B test groups via:

1. **Manual Assignment** (Recommended for testing):
```sql
-- Assign specific user to Plus plan test
UPDATE profiles 
SET ab_test_group = 'plus_plan' 
WHERE id = 'USER_ID_HERE';

-- Assign to Growth plan test
UPDATE profiles 
SET ab_test_group = 'growth_plan' 
WHERE id = 'USER_ID_HERE';
```

2. **Automatic Random Assignment**:
```sql
-- Use the built-in function
SELECT assign_ab_test_group();
-- Returns: 'plus_plan' or 'growth_plan' (50/50)
```

3. **Cohort Assignment** (e.g., new users only):
```sql
-- Assign all new signups after certain date
UPDATE profiles 
SET ab_test_group = assign_ab_test_group()
WHERE created_at >= '2025-11-12'
  AND ab_test_group IS NULL;
```

### Display Logic

The pricing pages check `profiles.ab_test_group`:
- `plus_plan` → Show Plus ($8), hide Growth ($10)
- `growth_plan` → Show Growth ($10), hide Plus ($8)
- `NULL` or unset → Show Growth ($10) by default

Premium ($18) is always shown to all users.

### Tracking Conversions

Query to analyze A/B test performance:

```sql
-- Conversion rates by A/B test group
SELECT 
  ab_test_group,
  COUNT(DISTINCT id) as total_users,
  COUNT(DISTINCT CASE WHEN subscription_active THEN id END) as subscribed_users,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN subscription_active THEN id END) / COUNT(DISTINCT id), 2) as conversion_rate,
  COUNT(DISTINCT CASE WHEN subscription_plan = '8_monthly' THEN id END) as plus_subscribers,
  COUNT(DISTINCT CASE WHEN subscription_plan = '10_monthly' THEN id END) as growth_subscribers,
  ROUND(AVG(CASE WHEN subscription_active THEN 
    CASE 
      WHEN subscription_plan = '8_monthly' THEN 8.00
      WHEN subscription_plan = '10_monthly' THEN 10.00
      WHEN subscription_plan = '18_monthly' THEN 18.00
      ELSE 0
    END
  END), 2) as avg_revenue_per_user
FROM profiles
WHERE ab_test_group IN ('plus_plan', 'growth_plan')
GROUP BY ab_test_group;
```

### Revenue Impact

```sql
-- Monthly recurring revenue by A/B group
SELECT 
  ab_test_group,
  COUNT(*) as active_subs,
  SUM(CASE 
    WHEN subscription_plan = '8_monthly' THEN 8.00
    WHEN subscription_plan = '10_monthly' THEN 10.00
    WHEN subscription_plan = '18_monthly' THEN 18.00
  END) as monthly_revenue
FROM profiles
WHERE subscription_active = true
  AND ab_test_group IS NOT NULL
GROUP BY ab_test_group;
```

## Enabling the A/B Test

### Step 1: Run the Migration
```bash
# Apply the migration to add Plus plan and ab_test_group column
supabase db push
```

### Step 2: Assign Test Groups

**Option A: Manual assignment for specific users**
```sql
UPDATE profiles 
SET ab_test_group = 'plus_plan' 
WHERE email IN ('user1@example.com', 'user2@example.com');
```

**Option B: Random assignment for new signups**
```sql
-- For all new users created after Nov 12, 2025
UPDATE profiles 
SET ab_test_group = assign_ab_test_group()
WHERE created_at >= '2025-11-12 00:00:00'
  AND ab_test_group IS NULL
  AND subscription_active = false; -- Only assign to free users
```

**Option C: Add to signup flow**
You can modify the signup process to automatically assign A/B groups by calling `assign_ab_test_group()` when creating new profiles.

### Step 3: Monitor Results

Track key metrics:
- Conversion rate (free → paid)
- Average revenue per user (ARPU)
- Plan distribution (Plus vs Growth vs Premium)
- Feature usage (voice minutes, images generated)
- Churn rate by plan

### Step 4: Switch Plans Easily

If you want to switch the default plan shown to users without an A/B group:

**Current behavior**: Shows Growth by default
**To show Plus by default**: Update both pricing pages:

```typescript
// In SubscriptionPaywall.tsx and Pricing.tsx
// Change this:
if (userAbTestGroup === 'plus_plan') {
  filteredPlans = filteredPlans.filter(plan => plan.id !== '10_monthly');
} else {
  // Default: show Growth, hide Plus
  filteredPlans = filteredPlans.filter(plan => plan.id !== '8_monthly');
}

// To this:
if (userAbTestGroup === 'growth_plan') {
  filteredPlans = filteredPlans.filter(plan => plan.id !== '8_monthly');
} else {
  // Default: show Plus, hide Growth
  filteredPlans = filteredPlans.filter(plan => plan.id !== '10_monthly');
}
```

## Testing Checklist

- [ ] Plus plan visible in pricing pages for `ab_test_group = 'plus_plan'` users
- [ ] Growth plan visible for `ab_test_group = 'growth_plan'` users
- [ ] Users can successfully subscribe to Plus plan via Stripe
- [ ] Plus users limited to 5 minutes of voice per month
- [ ] Plus users limited to 1 image per day
- [ ] Plus users can upgrade to Growth or Premium
- [ ] Billing panel shows "Plus" for `8_monthly` subscribers
- [ ] FAQ shows Plus plan in all relevant entries
- [ ] A/B test assignment function works correctly
- [ ] Analytics queries return correct conversion data

## Rollback Plan

If you need to disable the Plus plan:

```sql
-- 1. Deactivate Plus plan (users keep access, but no new signups)
UPDATE plan_limits SET is_active = false WHERE plan_id = '8_monthly';
DELETE FROM price_list WHERE id = '8_monthly';

-- 2. Migrate existing Plus subscribers to Growth
UPDATE profiles 
SET subscription_plan = '10_monthly'
WHERE subscription_plan = '8_monthly';

-- 3. Clear A/B test groups (optional)
UPDATE profiles SET ab_test_group = NULL;
```

## Next Steps

1. **Deploy Migration**: Run `supabase db push` to apply changes
2. **Test Locally**: Verify Plus plan shows up correctly with different A/B groups
3. **Start Small**: Assign 10-20% of new signups to `plus_plan` group
4. **Monitor for 2 weeks**: Track conversion rates and revenue
5. **Scale or Iterate**: 
   - If Plus converts better: Make it the default
   - If Growth converts better: Keep current setup
   - If mixed: Consider showing both plans to all users

## Files Modified

1. ✅ `supabase/migrations/20251112040000_add_plus_plan_ab_test.sql` - New migration
2. ✅ `src/components/paywall/SubscriptionCard.tsx` - Plus plan features
3. ✅ `src/pages/SubscriptionPaywall.tsx` - A/B test logic
4. ✅ `src/pages/Pricing.tsx` - A/B test logic
5. ✅ `src/components/settings/panels/BillingPanel.tsx` - Plan name recognition
6. ✅ `src/constants/supportContent.ts` - FAQ updates

## Files NOT Modified (Automatic)

- ✅ Voice limit checking - already uses `plan_limits` table
- ✅ Image limit checking - already uses `plan_limits` table
- ✅ Feature gating functions - database-driven

---

**Status**: ✅ Ready for deployment
**Date**: 2025-11-12
**Estimated Margin**: 85% ($6.79 profit per Plus user)

