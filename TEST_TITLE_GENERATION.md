# Test: AI Title Generation

## Quick Test
1. Open browser console (F12)
2. Click "New Chat" or type in empty chat
3. Send first message: "What's the weather in Tokyo?"
4. Watch for logs:
   ```
   [ChatInput] Title generation failed (non-blocking)
   [MessageStore] 🔄 Conversation update received
   ```
5. Check sidebar - title should change from "New Chat" to AI-generated title in ~500ms

## Debug Steps

### 1. Check Unified Channel Subscription
In browser console:
```javascript
// Check if unified channel is active
window.__msgStoreListenerInstalled
// Should be: true
```

### 2. Enable Debug Logging
In `src/services/websocket/UnifiedChannelService.ts`, line 4, change:
```typescript
const DEBUG = true; // was false
```

This will log:
- `[UnifiedChannel] 📡 Subscribing to unified channel for user:`
- `[UnifiedChannel] ✅ Connected and listening`
- `[UnifiedChannel] 📥 Event received: { type: 'conversation-update' }`

### 3. Check Edge Function Logs
In Supabase Dashboard → Edge Functions → `generate-conversation-title`:
- Should see: `Generated title: "..."`
- Should see: `Broadcast sent for conversation ...`
- If error: `Broadcast failed: ...`

### 4. Manual Broadcast Test
Test broadcast manually in browser console:
```javascript
// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Subscribe to channel
const channel = supabase.channel(`user-realtime:${user.id}`);
channel.on('broadcast', { event: '*' }, (payload) => {
  console.log('📥 Received:', payload);
}).subscribe();

// Send test broadcast (from another tab or Supabase Functions)
```

## Expected Behavior

### Success Flow:
1. User sends first message
2. Conversation created with "New Chat"
3. ~200ms later: Title updates to AI-generated title
4. Sidebar refreshes automatically

### Failure Scenarios:

**Scenario 1: Gemini API fails**
- Fallback: Title remains "New Chat"
- Console: `[generate-conversation-title] Gemini API error:`

**Scenario 2: Broadcast fails**
- Fallback: Title updated in DB but UI doesn't refresh until page reload
- Console: `[generate-conversation-title] Broadcast failed:`

**Scenario 3: Unified channel not subscribed**
- Fallback: Title updated in DB but UI doesn't refresh until page reload
- Console: No logs in `[UnifiedChannel]`
- Fix: Refresh page to trigger subscription

## Common Issues

### Issue: Title not updating in UI
**Cause:** Unified channel not subscribed
**Fix:** Check auth state - subscription happens on sign-in
**Verify:** Look for `[UnifiedChannel] ✅ Connected and listening` in console

### Issue: Title is "New Chat" forever
**Cause:** Edge function failing or not being called
**Fix:** Check Supabase Edge Function logs
**Verify:** Look for edge function invocation in Supabase Dashboard

### Issue: Title updates on refresh but not immediately
**Cause:** Broadcast not reaching frontend
**Fix:** Enable DEBUG mode and check for `[UnifiedChannel] 📥 Event received`
**Verify:** Manually test broadcast with code above

## Production Monitoring

To monitor in production:
1. Supabase Dashboard → Edge Functions → `generate-conversation-title`
2. Check invocation count (should match new conversations)
3. Check error rate (should be <1%)
4. Check latency (should be <500ms)

If error rate is high:
- Check Gemini API quota
- Check Gemini API key validity
- Verify broadcast format matches frontend expectations




