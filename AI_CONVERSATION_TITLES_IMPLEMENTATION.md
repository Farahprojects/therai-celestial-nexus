# AI-Generated Conversation Titles Implementation

## Overview
Implemented automatic conversation title generation from first message using Gemini 2.0 Flash. Titles are generated asynchronously after conversation creation, providing better context than generic "New Chat" labels.

## Implementation Details

### 1. Edge Function: `generate-conversation-title`
**Location:** `supabase/functions/generate-conversation-title/index.ts`

**What it does:**
- Receives conversation_id, message, and user_id
- Calls Gemini 2.0 Flash API to generate a 3-4 word title
- Updates conversation title in database
- Broadcasts update via unified channel for instant UI update
- Falls back to "New Chat" if generation fails

**API Model:** Gemini 2.0 Flash Exp
- Fast: ~200ms response time
- Cheap: $0.000075 per 1K tokens
- Max 20 output tokens (keeps titles concise)

**Prompt:**
```
Generate a concise 3-4 word title for a conversation that starts with this message. Only return the title, nothing else.

Message: "{user_message}"

Title:
```

### 2. Frontend Integration: ChatInput.tsx
**Location:** `src/features/chat/ChatInput.tsx` (lines 141-153)

**Flow:**
1. User sends first message when no chat_id exists
2. Creates conversation with "New Chat" title
3. **Fire-and-forget:** Calls `generate-conversation-title` edge function
4. Message send proceeds immediately (no blocking)
5. Title updates in sidebar ~200-500ms later

**Code:**
```typescript
// Fire-and-forget: Generate better title from first message
const messageForTitle = text.trim();
queueMicrotask(() => {
  supabase.functions.invoke('generate-conversation-title', {
    body: {
      conversation_id: newChatId,
      message: messageForTitle,
      user_id: user.id
    }
  }).catch((error) => {
    console.log('[ChatInput] Title generation failed (non-blocking):', error);
  });
});
```

### 3. Real-time UI Updates
**Location:** `src/stores/messageStore.ts` (lines 422-447)

The existing unified channel listener already handles conversation updates:
- Listens for `conversation-update` events
- Forwards to `useChatStore.updateConversation()`
- Updates sidebar immediately when title changes

## Key Features

✅ **Non-blocking:** Title generation doesn't delay message sending
✅ **Fire-and-forget:** Failures don't affect user experience  
✅ **Instant feedback:** UI updates via WebSocket broadcast
✅ **Cost-effective:** Uses cheapest/fastest Gemini model
✅ **Graceful fallback:** Returns "New Chat" on any error
✅ **Concise titles:** Limited to 3-4 words, max 50 chars

## Testing

### Manual Test Steps:
1. Click "New Chat" or start typing without existing conversation
2. Send first message (e.g., "What's the weather in Tokyo?")
3. Observe sidebar: title changes from "New Chat" to AI-generated title
4. Expected result: Title like "Tokyo Weather Inquiry" or similar

### Edge Cases Handled:
- Empty/short messages → Fallback to "New Chat"
- Gemini API failure → Fallback to "New Chat"  
- Network timeout → Fallback to "New Chat"
- User navigates away → No impact (fire-and-forget)

## Cost Analysis

**Per title generation:**
- Input: ~50 tokens (prompt + message)
- Output: ~10 tokens (3-4 word title)
- Total cost: ~$0.0000045 per title

**Monthly projection (10,000 new conversations):**
- Total cost: ~$0.045/month

**Comparison to manual renaming:**
- User time saved: ~3-5 seconds per conversation
- Better first impression: Immediate context in sidebar
- Reduced cognitive load: No need to manually name chats

## Deployment

Edge function deployed to: `generate-conversation-title`

**Environment variables required:**
- `GEMINI_API_KEY` ✅ (already configured)
- `SUPABASE_URL` ✅ (auto-configured)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (auto-configured)

## Future Enhancements

**Potential improvements:**
1. Multi-language support (detect user language)
2. Context-aware titles (use conversation mode)
3. Update title after more messages if initial was generic
4. User preference to disable auto-titling

## Files Modified

1. **New:** `supabase/functions/generate-conversation-title/index.ts`
2. **Modified:** `src/features/chat/ChatInput.tsx` (lines 141-153)

**No breaking changes.** Existing conversation creation flow unchanged.


