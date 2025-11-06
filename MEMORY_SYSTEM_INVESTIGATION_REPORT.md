# Memory System Investigation Report
**Status**: Memory extraction not working - 0 memories in database

**Date**: 2025-02-10

---

## Executive Summary

The memory system has been implemented with database schema, edge functions, and frontend components, but no memories are being created. This report outlines all potential failure points and investigation procedures.

---

## Investigation Checklist

### 1. Database Schema Verification ⚠️ CRITICAL

**Check if migrations were applied correctly:**

```sql
-- Run this comprehensive check
\i check_memory_system_status.sql

-- Or check manually:
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'conversations' AND column_name = 'profile_id'
) as profile_id_exists;

SELECT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'memory_type'
) as memory_type_enum_exists;

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'user_memory'
) as user_memory_table_exists;

-- Check RLS policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('user_memory', 'user_memory_weekly_summaries', 'user_memory_monthly_summaries');
```

**Expected Results:**
- ✅ `profile_id` column exists on `conversations`
- ✅ `memory_type` enum exists
- ✅ `user_memory` table exists with all columns
- ✅ RLS policies exist for all memory tables

**If Missing**: Run migrations in order:
1. `20250204000001_add_profile_id_to_conversations.sql`
2. `20250204000002_create_memory_type_enum.sql`
3. `20250204000003_create_user_memory_table.sql`
4. `20250204000004_create_weekly_summaries_table.sql`
5. `20250204000005_create_monthly_summaries_table.sql`
6. `20250204000006_add_memory_rls_policies.sql`

---

### 2. Profile ID on Conversations 🔍 HIGH PRIORITY

**Check if conversations have profile_id set:**

```sql
-- Check conversations with profile_id
SELECT 
  COUNT(*) as total_conversations,
  COUNT(profile_id) as conversations_with_profile_id,
  COUNT(*) FILTER (WHERE profile_id IS NOT NULL) as with_profile,
  COUNT(DISTINCT profile_id) as unique_profiles_linked
FROM conversations;

-- Sample conversations with profile_id
SELECT 
  id,
  user_id,
  profile_id,
  mode,
  title,
  created_at
FROM conversations
WHERE profile_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check if primary profiles exist
SELECT 
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE is_primary = true) as primary_profiles,
  COUNT(DISTINCT user_id) FILTER (WHERE is_primary = true) as users_with_primary
FROM user_profile_list;
```

**Expected Results:**
- At least some conversations have `profile_id` set
- Users have primary profiles (`is_primary = true`)

**If No profile_id**: This is the root cause. Investigate:
- ProfileSelector integration (Section 8)
- Conversation creation flow (Section 9)

---

### 3. Memory Extraction Trigger Verification 🔍 CRITICAL

**Check if chat-send is triggering memory extraction:**

**A. Check chat-send logs:**
```bash
# In Supabase Dashboard → Edge Functions → chat-send → Logs
# Look for these log entries:

# Should appear when message is sent:
{
  "event": "memory_extraction_started",
  "request_id": "...",
  ...
}

# Or if skipped:
{
  "event": "chat_send_response_returned",
  "memory_extraction_started": false
}
```

**B. Check if extract-user-memory is being called:**
```bash
# In Supabase Dashboard → Edge Functions → extract-user-memory → Logs
# Should see requests when memory extraction is triggered
```

**C. Add debug logging to chat-send:**
```typescript
// In supabase/functions/chat-send/index.ts around line 339-350
// Add detailed logging:

console.info(JSON.stringify({
  event: "memory_check_start",
  request_id,
  chat_id,
  shouldStartLLM,
  user_id
}));

const { data: convCheck, error: convError } = await supabase
  .from('conversations')
  .select('profile_id, user_id')
  .eq('id', chat_id)
  .single();

console.info(JSON.stringify({
  event: "memory_check_result",
  request_id,
  chat_id,
  profile_id: convCheck?.profile_id,
  conv_error: convError?.message,
  has_profile: !!convCheck?.profile_id
}));

// Then check if profile is primary
if (convCheck?.profile_id) {
  const { data: profileCheck } = await supabase
    .from('user_profile_list')
    .select('is_primary, user_id')
    .eq('id', convCheck.profile_id)
    .single();
  
  console.info(JSON.stringify({
    event: "profile_check_result",
    request_id,
    profile_id: convCheck.profile_id,
    is_primary: profileCheck?.is_primary,
    user_match: profileCheck?.user_id === user_id
  }));
  
  if (profileCheck?.is_primary && profileCheck.user_id === user_id) {
    shouldExtractMemory = true;
  }
}
```

**Investigation Steps:**
1. Send a message in a conversation with a primary profile selected
2. Check chat-send logs for memory extraction trigger
3. Check extract-user-memory logs for any calls
4. If no calls, check if `shouldExtractMemory` is being set correctly

---

### 4. Memory Extraction Function Verification 🔍 CRITICAL

**Check if extract-user-memory is working:**

**A. Test the function directly:**
```bash
# Get a conversation_id and message_id from a recent conversation
# Then call the function:

curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/extract-user-memory \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID",
    "message_id": "YOUR_MESSAGE_ID",
    "user_id": "YOUR_USER_ID"
  }'
```

**B. Check extract-user-memory logs for errors:**
```bash
# In Supabase Dashboard → Edge Functions → extract-user-memory → Logs
# Look for:
# - "No profile selected" (profile_id not set)
# - "Not primary profile or user mismatch" (validation failed)
# - "No memories extracted" (LLM returned empty)
# - Gemini API errors
# - Database errors
```

**C. Verify function logic:**
Check `supabase/functions/extract-user-memory/index.ts`:
- Line 99-101: Should check `conv?.profile_id` exists
- Line 109-111: Should verify `profile.is_primary` and `user_id` match
- Line 114-124: Should fetch messages from conversation
- Line 169-171: Should handle empty memory arrays

**Common Issues:**
- ❌ Profile not primary → Returns "Not primary profile or user mismatch"
- ❌ No profile_id on conversation → Returns "No profile selected"
- ❌ LLM returns no memories → Returns "No memories extracted" (this is OK sometimes)
- ❌ Gemini API error → Check API key and quota

---

### 5. Profile Selection Integration 🔍 HIGH PRIORITY

**Check if ProfileSelector updates conversation profile_id:**

**A. Check ProfileSelector component:**
```typescript
// Location: src/components/shared/forms/ProfileSelector.tsx
// Current: handleSelect() only calls onProfileSelect(profile)
// Missing: Call to update_conversation_profile when is_primary=true
```

**B. Check where ProfileSelector is used:**
```bash
# Search for ProfileSelector usage:
grep -r "ProfileSelector" src/components --include="*.tsx" --include="*.ts"
```

**C. Add logging to ProfileSelector:**
```typescript
// In ProfileSelector.tsx, add to handleSelect:
const handleSelect = async (profile: SavedProfile) => {
  console.log('[ProfileSelector] Profile selected:', {
    profile_id: profile.id,
    profile_name: profile.profile_name,
    needs_is_primary_check: true
  });
  
  // TODO: Check if profile is primary and update conversation
  // TODO: Need current conversation_id context
  
  onProfileSelect(profile);
  setOpen(false);
};
```

**Investigation:**
1. Where is ProfileSelector used? (likely in AstroDataForm or chat components)
2. Does it have access to current `conversation_id`?
3. Is it calling `update_conversation_profile` when primary profile selected?

---

### 6. Conversation Creation Flow 🔍 HIGH PRIORITY

**Check if conversations are created with profile_id:**

**A. Check conversation-manager create_conversation:**
```typescript
// Location: supabase/functions/conversation-manager/index.ts
// Line 173: profile_id: profile_id || null
// This should be set when profile_mode=true or when profile_id is passed
```

**B. Check OnboardingModal:**
```typescript
// Location: src/components/onboarding/OnboardingModal.tsx
// Line 124: profile_id: createdProfile?.id
// This should set profile_id during onboarding
```

**C. Check AstroDataForm:**
```typescript
// Location: src/components/chat/AstroDataForm.tsx
// Does it pass profile_id when creating conversation?
// Does it use ProfileSelector to update existing conversation?
```

**Investigation Query:**
```sql
-- Check recent conversations and their profile_id
SELECT 
  c.id,
  c.user_id,
  c.profile_id,
  c.mode,
  c.title,
  c.created_at,
  upl.profile_name,
  upl.is_primary,
  COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN user_profile_list upl ON c.profile_id = upl.id
LEFT JOIN messages m ON m.chat_id = c.id
WHERE c.created_at > NOW() - INTERVAL '7 days'
GROUP BY c.id, c.user_id, c.profile_id, c.mode, c.title, c.created_at, upl.profile_name, upl.is_primary
ORDER BY c.created_at DESC
LIMIT 20;
```

**Expected:**
- Recent conversations should have `profile_id` if they were created with a profile
- Profile should have `is_primary = true`

---

### 7. Memory Injection Verification 🔍 MEDIUM PRIORITY

**Check if memory injection is working (even if no memories exist yet):**

**A. Check llm-handler-gemini logs:**
```bash
# In Supabase Dashboard → Edge Functions → llm-handler-gemini → Logs
# Look for:
{
  "event": "request_received",
  ...
  "memories": 0  // Should show memory count
}
```

**B. Check memoryInjection.ts:**
```typescript
// Location: supabase/functions/_shared/memoryInjection.ts
// Line 38-40: Returns empty if no profile_id
// This is correct behavior - but check if profile_id is being passed
```

**C. Add debug logging:**
```typescript
// In memoryInjection.ts, add logging:
export async function fetchAndFormatMemories(...) {
  console.log('[memoryInjection] Fetching memories for chat:', chatId);
  
  const { data: conv } = await supabase
    .from('conversations')
    .select('profile_id, user_id')
    .eq('id', chatId)
    .single();

  console.log('[memoryInjection] Conversation check:', {
    chatId,
    profile_id: conv?.profile_id,
    user_id: conv?.user_id
  });

  if (!conv?.profile_id) {
    console.log('[memoryInjection] No profile_id, returning empty');
    return { memoryContext: '', memoryIds: [] };
  }
  
  // ... rest of function
}
```

---

### 8. Frontend Integration Check 🔍 MEDIUM PRIORITY

**A. Check if MemoryPanel is accessible:**
```typescript
// Location: src/components/settings/SettingsModal.tsx
// Verify Memory tab exists and MemoryPanel is imported
```

**B. Check useUserMemory hook:**
```typescript
// Location: src/hooks/useUserMemory.ts
// Verify it queries user_memory table correctly
```

**C. Test UI flow:**
1. Open Settings → Memory tab
2. Should show "No memories yet" if empty (this is expected)
3. Check browser console for any errors

---

### 9. End-to-End Test Flow 📝 CRITICAL

**Create a test scenario and verify each step:**

**Step 1: Create/Verify Primary Profile**
```sql
-- Check if user has primary profile
SELECT id, profile_name, is_primary, user_id
FROM user_profile_list
WHERE user_id = 'YOUR_USER_ID'
  AND is_primary = true;
```

**Step 2: Create Conversation with Profile**
```typescript
// Via UI or API:
// Create conversation and ensure profile_id is set
// Check conversation in database:
SELECT id, profile_id, user_id, mode
FROM conversations
WHERE id = 'YOUR_CONVERSATION_ID';
```

**Step 3: Send Message**
```typescript
// Send a message in the conversation
// Check chat-send logs for memory extraction trigger
```

**Step 4: Check Memory Extraction**
```sql
-- Should see memory created if extraction worked
SELECT *
FROM user_memory
WHERE conversation_id = 'YOUR_CONVERSATION_ID'
ORDER BY created_at DESC;
```

**Step 5: Check LLM Response**
```typescript
// Check if memory context was injected
// Check llm-handler-gemini logs for memory count
```

---

### 10. Common Failure Points Summary

| Issue | Symptom | Investigation | Fix |
|-------|---------|---------------|-----|
| **No profile_id on conversations** | Conversations have NULL profile_id | Check conversation creation flow | Ensure profile_id is passed/updated |
| **Profile not primary** | extract-user-memory returns "Not primary" | Check user_profile_list.is_primary | Set is_primary=true |
| **Memory extraction not triggered** | chat-send logs show memory_extraction_started=false | Check chat-send logic around line 339-350 | Fix shouldExtractMemory logic |
| **Extraction function not called** | No logs in extract-user-memory | Check chat-send fetch call | Verify function URL and auth |
| **LLM returns no memories** | extract-user-memory returns "No memories extracted" | Check Gemini API response | May be normal (low extraction rate) |
| **RLS blocking access** | Database errors in logs | Check RLS policies | Verify policies allow service role |

---

### 11. Debugging Queries

**Check recent activity:**
```sql
-- Recent conversations with profile_id
SELECT 
  c.id,
  c.title,
  c.profile_id,
  c.created_at,
  upl.profile_name,
  upl.is_primary,
  (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) as msg_count
FROM conversations c
LEFT JOIN user_profile_list upl ON c.profile_id = upl.id
WHERE c.created_at > NOW() - INTERVAL '24 hours'
ORDER BY c.created_at DESC;

-- Check if any memory extraction attempts happened
SELECT 
  COUNT(*) as total_messages,
  COUNT(DISTINCT chat_id) as conversations_with_messages
FROM messages
WHERE role = 'assistant'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Check extract-user-memory function calls (if logged)
-- This would be in edge function logs, not SQL
```

---

### 12. Recommended Investigation Order

1. **Start with Database** (5 min)
   - Run `check_memory_system_status.sql`
   - Verify all tables/columns/policies exist

2. **Check Profile ID on Conversations** (10 min)
   - Query recent conversations
   - See if any have profile_id set

3. **Check Primary Profiles** (5 min)
   - Verify users have primary profiles
   - Check is_primary flag

4. **Test Memory Extraction Trigger** (15 min)
   - Send a test message
   - Check chat-send logs
   - Verify shouldExtractMemory is set

5. **Check extract-user-memory Function** (15 min)
   - Review function logs
   - Test function directly via API
   - Check for validation failures

6. **Verify ProfileSelector Integration** (20 min)
   - Check if ProfileSelector updates conversation
   - Add logging to ProfileSelector
   - Test profile selection flow

7. **Check Conversation Creation** (15 min)
   - Verify profile_id is passed during creation
   - Check OnboardingModal and AstroDataForm

8. **End-to-End Test** (30 min)
   - Create conversation with profile
   - Send messages
   - Verify memory extraction
   - Check database for memories

---

### 13. Quick Fixes to Try First

**Fix 1: Add is_primary check to chat-send**
```typescript
// In supabase/functions/chat-send/index.ts around line 341-350
// Replace the profile_id check with:

if (shouldStartLLM) {
  const { data: convCheck } = await supabase
    .from('conversations')
    .select('profile_id')
    .eq('id', chat_id)
    .single();
  
  if (convCheck?.profile_id) {
    // Verify profile is primary
    const { data: profileCheck } = await supabase
      .from('user_profile_list')
      .select('is_primary, user_id')
      .eq('id', convCheck.profile_id)
      .single();
    
    if (profileCheck?.is_primary && profileCheck.user_id === user_id) {
      shouldExtractMemory = true;
    }
  }
}
```

**Fix 2: Add ProfileSelector callback**
```typescript
// In ProfileSelector component, need conversation_id context
// Then call update_conversation_profile when primary selected
```

**Fix 3: Ensure profile_id in conversation creation**
```typescript
// Verify OnboardingModal and AstroDataForm pass profile_id
// Check conversation-manager handles it correctly
```

---

### 14. Testing Checklist

After fixes, test:

- [ ] Create primary profile (via onboarding or manually)
- [ ] Create conversation (should have profile_id if created with profile)
- [ ] Select primary profile in existing conversation (ProfileSelector)
- [ ] Send message in conversation with profile_id
- [ ] Check chat-send logs for memory extraction trigger
- [ ] Check extract-user-memory logs for function call
- [ ] Verify memory created in database
- [ ] Check LLM response includes memory context
- [ ] Verify memory IDs in message meta
- [ ] Check Settings → Memory tab shows memories

---

## Next Steps

1. **Immediate**: Run database verification queries
2. **Priority 1**: Check if conversations have profile_id
3. **Priority 2**: Verify memory extraction trigger logic
4. **Priority 3**: Test extract-user-memory function directly
5. **Priority 4**: Fix ProfileSelector integration
6. **Priority 5**: End-to-end test with fixes

---

## Contact & Support

If issues persist, provide:
- Database verification results
- Edge function logs (chat-send, extract-user-memory)
- Sample conversation_id and message_id
- User_id for testing
- Any error messages from logs

