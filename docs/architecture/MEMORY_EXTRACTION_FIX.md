# Memory Extraction Fix - Profile ID Implementation

## Problem Identified

Memory extraction was **silently failing** because:
1. Conversations were created without a `profile_id`
2. The memory extractor requires `profile_id` to link memories to profiles
3. When `profile_id` was null, extraction was skipped with message: "No profile selected"
4. No visibility into why extraction was failing

## Root Cause

The `extract-user-memory` function validates:
```typescript
if (!conv.profile_id) {
  return json(200, { message: "No profile selected", skipped: true });
}
```

But conversations were being created with `profile_id: null` in multiple places:
- `src/services/conversations.ts` - `createConversation()`
- `src/components/onboarding/OnboardingModal.tsx` - Onboarding chat creation
- `supabase/functions/create-conversation-with-title/index.ts` - Smart title generation

## Solution Implemented

### 1. Added Helper Function for Profile Lookup
**File:** `src/services/conversations.ts`

```typescript
export const getPrimaryProfileId = async (userId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profile_list')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle();

    if (error) {
      console.error('[Conversations] Error fetching primary profile:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('[Conversations] Error fetching primary profile:', error);
    return null;
  }
};
```

### 2. Updated `createConversation()` to Fetch and Pass Profile ID
**File:** `src/services/conversations.ts`

- Fetches primary profile before creating conversation
- Passes `profile_id` to conversation-manager
- Logs profile_id for debugging

### 3. Updated OnboardingModal
**File:** `src/components/onboarding/OnboardingModal.tsx`

- Fetches primary profile after profile creation (line ~211-216)
- Passes `profile_id` when creating starter conversation (line ~229)
- Logs profile_id for debugging

### 4. Updated create-conversation-with-title Edge Function
**File:** `supabase/functions/create-conversation-with-title/index.ts`

- Fetches primary profile before inserting conversation (line ~129-137)
- Includes `profile_id` in conversation data (line ~144)
- Logs profile_id for debugging

### 5. Enhanced Logging in Memory Extractor
**File:** `supabase/functions/extract-user-memory/index.ts`

Added comprehensive logging at each step:
- Request received (conversation_id, message_id, user_id)
- Message lookup result
- **Conversation lookup with profile_id visibility**
- **Profile lookup with is_primary flag**
- All checks passed message before extraction starts
- Memory saved successfully with full details
- All skip/error conditions with context

## Future Multi-Profile Architecture

This implementation supports future multi-profile features:

### Current State
- All conversations automatically link to the **primary profile**
- All memories are stored under the user's primary profile

### Future Enhancement Path
When implementing partner/kid/family profiles:

1. **UI Selection:** Add profile selector in conversation creation
2. **Pass Explicit Profile ID:** Update calls to pass selected profile_id instead of primary
3. **Memory Isolation:** Memories automatically segregated by profile_id
4. **Memory Injection:** Filter memories by conversation's profile_id

**Example future call:**
```typescript
const conversation = await createConversation(
  userId,
  'chat',
  'Chat with Partner Data',
  undefined,
  partnerProfileId // Pass specific profile
);
```

## Testing Instructions

### 1. Check Existing Conversations
```sql
-- See if conversations now have profile_id
SELECT 
  id,
  title,
  mode,
  profile_id,
  user_id,
  created_at
FROM conversations
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Create New Conversation
1. Start a new chat
2. Check Supabase logs for:
   ```
   [Conversations] Creating conversation with profile_id: <uuid>
   ```

### 3. Trigger Memory Extraction
1. Have a meaningful conversation (3+ messages)
2. Check Supabase edge function logs:
   ```
   [extract-user-memory] Request received: {...}
   [extract-user-memory] Conversation lookup: { profile_id: "<uuid>", ... }
   [extract-user-memory] Profile lookup: { found: true, is_primary: true }
   [extract-user-memory] All checks passed - starting extraction
   [extract-user-memory] Memory saved successfully: {...}
   ```

### 4. Verify Memory Storage
```sql
-- Check if memories are being created
SELECT 
  id,
  profile_id,
  memory_text,
  memory_type,
  confidence_score,
  created_at
FROM user_memory
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

## Key Logging Points

Monitor these logs to verify the fix:

### Success Path
```
[Conversations] Creating conversation with profile_id: <uuid>
[extract-user-memory] Conversation lookup: { profile_id: "<uuid>", mode: "chat", found: true }
[extract-user-memory] Profile lookup: { found: true, is_primary: true }
[extract-user-memory] All checks passed - starting extraction
[extract-user-memory] Memory saved successfully
```

### Failure Path (Old Issue)
```
[extract-user-memory] Conversation lookup: { profile_id: null, ... }
[extract-user-memory] No profile_id on conversation - memory extraction skipped
```

## Files Modified

1. ✅ `src/services/conversations.ts` - Added getPrimaryProfileId() and updated createConversation()
2. ✅ `src/components/onboarding/OnboardingModal.tsx` - Fetch and pass profile_id in onboarding
3. ✅ `supabase/functions/create-conversation-with-title/index.ts` - Fetch and include profile_id
4. ✅ `supabase/functions/extract-user-memory/index.ts` - Enhanced logging throughout

## Impact

### Before Fix
- ❌ Memory extraction silently skipped for all conversations
- ❌ No visibility into why extraction was failing
- ❌ No profile linkage for memories

### After Fix
- ✅ All conversations automatically linked to primary profile
- ✅ Memory extraction works correctly
- ✅ Comprehensive logging for debugging
- ✅ Foundation for future multi-profile support

## Deployment

No database migrations required - the `profile_id` column already exists on the `conversations` table.

Simply deploy the updated code:
1. Edge functions will auto-deploy
2. Frontend will update on next build/deploy

## Rollback Plan

If issues arise, simply revert the 4 modified files. The system will continue to work, but memory extraction will be skipped again.

