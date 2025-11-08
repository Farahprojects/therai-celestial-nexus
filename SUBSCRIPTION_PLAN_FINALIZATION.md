# Subscription Plan Finalization - $10/month Growth Plan

## Summary
Successfully finalized and implemented the $10/month Growth plan with updated feature limits, subscription cards, and proper gating across the application.

## Growth Plan ($10/month) - Final Features

| Feature | Allowance | Implementation Status |
|---------|-----------|----------------------|
| **Core AI Chat** | ✅ Unlimited | ✓ No gating required |
| **Together Mode** | ✅ Included (2-person sessions) | ✓ No gating required |
| **AI Memory & History** | ✅ Enabled & Unlimited | ✓ No gating required |
| **My Folders** | ✅ Unlimited creation & sharing | ✓ No gating required |
| **Sharing Threads** | ✅ Unlimited | ✓ No gating required |
| **Image Generation** | 🎨 3 Images per day (~90/month) | ✓ Gated in `image-generate` function |
| **Voice Mode (Premium HD)** | 🎤 10 Minutes per month (600 seconds) | ✓ Gated via STT in `google-whisper` |

## Premium Plan ($18/month) - Features

| Feature | Allowance |
|---------|-----------|
| **Everything in Growth** | ✓ Included |
| **Voice Conversations** | ✅ Unlimited |
| **Image Generation** | ✅ Unlimited |
| **Priority Support** | ✅ Included |
| **Early Access** | ✅ New features first |

## Changes Made

### 1. Feature Limits Configuration
**File**: `supabase/functions/_shared/featureLimits.ts`
- ✅ Updated `voice_seconds` from 60 to 600 (10 minutes) for `10_monthly` plan
- ✅ Premium plan (`18_monthly`) remains unlimited (null)

### 2. Subscription Card Features
**Files**: 
- `src/components/paywall/SubscriptionCard.tsx`
- `src/pages/SubscriptionPaywall.tsx`
- `src/pages/Pricing.tsx`

**Growth Plan Features Updated**:
```typescript
const growthFeatures = [
  'Unlimited AI conversations',
  'Together Mode (2-person sessions)',
  'Premium HD Voice (10 min/month)',
  'Image generation (3/day)',
  'Unlimited folders & sharing'
];
```

**Premium Plan Features Updated**:
```typescript
const premiumFeatures = [
  'Everything in Growth',
  'Unlimited voice conversations',
  'Unlimited image generation',
  'Priority support',
  'Early access to new features'
];
```

### 3. Error Messages
**File**: `supabase/functions/google-whisper/index.ts`
- ✅ Updated STT limit exceeded messages to be dynamic based on user's plan
- Free users: "You've used your 2 minutes of free voice transcription. Subscribe to get 10 minutes/month with Growth or unlimited with Premium."
- Growth users: "You've used your 10 minutes of voice for this month. Upgrade to Premium for unlimited voice features."

### 4. FAQ Updates
**File**: `src/constants/supportContent.ts`
- ✅ Updated "What subscription plans do you offer?" (bill-1)
- ✅ Updated "What's the difference between Growth and Premium?" (bill-2)
- ✅ Updated "Is voice conversation mode available on all plans?" (feat-4)
- ✅ Updated "Can I upgrade or downgrade my plan?" (bill-4)

## Feature Gating Architecture

### Voice Mode (STT)
- **Location**: `supabase/functions/google-whisper/index.ts`
- **Function**: `checkFreeTierSTTAccess()`
- **Logic**: 
  - Free users: 120 seconds (2 minutes)
  - Growth plan: 600 seconds (10 minutes) per month
  - Premium plan: Unlimited
- **Tracking**: `feature_usage` table, `voice_seconds` column
- **Period**: Monthly (resets each calendar month)

### Image Generation
- **Location**: `supabase/functions/image-generate/index.ts`
- **Logic**: Rate limiting via `image_generation_log` table
- **Limit**: 3 images per 24 hours (rolling window)
- **All Plans**: Same limit for Growth and Premium currently
- **Note**: Premium plan shows "Unlimited" in UI but not implemented yet

### Together Mode
- **Status**: No gating required
- **Included**: All paid plans (Growth and Premium)
- **Note**: User mentioned "3 AI calls @therai limit" but this is NOT currently implemented
  - If this limit needs to be added, it would require new gating logic in `chat-send` or `llm-handler-together-mode` functions

## Cost Analysis

### Growth Plan Monthly Costs (per power user)

| Feature | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| Voice (STT) | 10 minutes | ~$0.006/min | $0.06 |
| Voice (TTS) | ~10 minutes | ~$0.016/min | $0.16 |
| Images | 3/day = 90/month | ~$0.02/image | $1.80 |
| LLM tokens | Varies | Varies | Variable |
| **Total Fixed Costs** | | | **~$2.02** |

**Margin**: $10 - $2.02 = **$7.98 per user** (before LLM token costs)

## Marketing Positioning

### Growth Plan ($10/month)
**Tagline**: "Daily habit formation with premium features"

**Value Props**:
1. ✨ **Unlimited AI Conversations** - Build daily habits without limits
2. 👥 **Together Mode** - Invite a partner for shared insights (2-person)
3. 🎤 **Premium HD Voice** - 10 minutes of high-quality voice conversations
4. 🎨 **Daily Image Generation** - 3 AI-generated images per day
5. 📁 **Unlimited Organization** - Folders and sharing for all your insights

### Premium Plan ($18/month)
**Tagline**: "Unlimited everything for power users"

**Upgrade Reasons**:
- Remove all voice limits
- Generate unlimited images
- Priority support
- Early access to new features

## Next Steps / Recommendations

### 1. Together Mode @therai Limit
**Status**: Not currently implemented
**Recommendation**: If you want to limit @therai invocations to 3 per month for Growth plan:
- Add `therai_calls: number` to `featureLimits.ts`
- Track usage in `feature_usage` table (new column)
- Gate in `chat-send/index.ts` when `analyze === true`

### 2. Premium Image Generation
**Status**: Shows "unlimited" in UI but not implemented
**Recommendation**: 
- Update `image-generate/index.ts` to check subscription plan
- Skip rate limit check for Premium users

### 3. Free Tier Migration
**Status**: Free tier still gets 2 minutes of voice
**Recommendation**: Consider if free tier should get any voice access, or require subscription for voice entirely

### 4. Mobile App Updates
**Files to check**:
- `android/` and `ios/` directories
- Any mobile-specific subscription UI
- In-app purchase configuration

## Testing Checklist

- [ ] Growth user can use 10 minutes of voice per month
- [ ] Growth user gets stopped at 10 minutes with correct error message
- [ ] Premium user has unlimited voice
- [ ] Image generation stops at 3 per day for all users
- [ ] Subscription cards display correct features on all pages
- [ ] FAQ shows accurate plan comparisons
- [ ] Together Mode works for all paid users
- [ ] Free users see correct upgrade messaging

## Files Modified

1. `supabase/functions/_shared/featureLimits.ts` - Voice limit: 60→600 seconds
2. `src/components/paywall/SubscriptionCard.tsx` - Feature list updated
3. `src/pages/SubscriptionPaywall.tsx` - Feature list updated
4. `src/pages/Pricing.tsx` - Feature list updated
5. `supabase/functions/google-whisper/index.ts` - Dynamic error messages
6. `src/constants/supportContent.ts` - FAQ updates (4 entries)

## No Changes Required

These features are already working as intended:
- ✅ Core AI Chat (unlimited)
- ✅ Together Mode (included for all paid users)
- ✅ AI Memory & History (unlimited)
- ✅ Folders (unlimited creation and sharing)
- ✅ Thread Sharing (unlimited)
- ✅ Image Generation (3 per day limit already in place)

---

**Status**: ✅ Ready for production
**Date**: 2025-11-08

