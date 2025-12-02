# Backend Security: Subscription Verification

## Summary

Added **server-side subscription verification** to prevent client-side manipulation and code injection attacks.

## Security Issues Fixed

### 1. **chat-send Edge Function**
- ❌ **Before**: No authentication, no subscription checks, accepts user_id from request body
- ✅ **After**: 
  - Verifies JWT token from Authorization header
  - Validates user_id matches authenticated user
  - Checks subscription status before allowing messages
  - Requires premium plan for voice chat

### 2. **conversation-manager Edge Function**
- ❌ **Before**: Only JWT verification, no subscription checks
- ✅ **After**:
  - Verifies subscription before creating conversations
  - Requires premium plan for voice conversations

## Implementation

### New Shared Utility: `subscriptionCheck.ts`
- `checkSubscriptionAccess()` - Verifies user has active subscription or credits
- `checkPremiumAccess()` - Verifies user has premium plan (for voice features)
- Supports both CREDIT and SUBSCRIPTION billing modes

### Security Checks Added

1. **Message Sending** (`chat-send`):
   - ✅ JWT token verification
   - ✅ User ID validation (prevents spoofing)
   - ✅ Subscription status check
   - ✅ Premium plan check for voice chat

2. **Conversation Creation** (`conversation-manager`):
   - ✅ Subscription status check
   - ✅ Premium plan check for voice conversations

## How to Bypass Protection (for testing)

Even with these checks, a determined attacker could:
1. **Modify client code** - But this won't help since backend rejects requests
2. **Use valid JWT tokens** - But they still need active subscription
3. **Direct API calls** - Still blocked by subscription checks

## Best Practices Implemented

✅ **Never trust client-side checks alone**
✅ **Verify subscription on server-side**
✅ **Validate user_id matches authenticated user**
✅ **Check premium plan for premium features**
✅ **Return clear error messages without exposing internals**

## Environment Variables Required

Add to Supabase edge function secrets:
- `BILLING_MODE` (optional, defaults to "SUBSCRIPTION")
- `SUPABASE_ANON_KEY` (for JWT verification)

## Testing

To test security:
1. Try sending message without subscription → Should return 403
2. Try creating conversation without subscription → Should return 403
3. Try voice chat without premium → Should return 403
4. Try modifying user_id in request → Should return 403

These checks prevent all client-side manipulation attacks.

