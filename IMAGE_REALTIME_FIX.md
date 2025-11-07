# Image Real-time Updates Fix

**Issue:** Images weren't appearing in real-time after generation - required manual page refresh to see them.

**Root Cause:** The `image-generate` edge function was missing WebSocket broadcasts. When we optimized the WebSocket architecture to use the unified channel, image generation was overlooked and didn't broadcast updates.

---

## What Was Fixed

### 1. Edge Function Broadcasts (image-generate/index.ts)

**Added two real-time broadcasts:**

1. **Message Update Broadcast** - Notifies the chat view that the message now has an image
   ```typescript
   supabase.channel(`user-realtime:${user_id}`).send({
     type: 'broadcast',
     event: 'message-update',
     payload: { chat_id, message: updatedMessage }
   });
   ```

2. **Image Insert Broadcast** - Notifies the image gallery of the new image
   ```typescript
   supabase.channel(`user-realtime:${user_id}`).send({
     type: 'broadcast',
     event: 'image-insert',
     payload: { image: newUserImage }
   });
   ```

### 2. Frontend Listener (ImageGallery.tsx)

**Added real-time subscription** to the unified channel when gallery is open:
- Listens for `image-insert` events
- Automatically prepends new images to the gallery
- Cleans up subscription when gallery closes

### 3. Event Type Definition (UnifiedChannelService.ts)

**Added `'image-insert'` event type** to the EventType union for type safety.

---

## How It Works Now

### Image Generation Flow (Real-time):

```
1. User requests image generation
2. llm-handler-gemini creates placeholder message:
   - INSERT message with meta.status = 'generating'
   - Broadcast 'message-insert' → Frontend shows skeleton loader
3. llm-handler-gemini calls image-generate edge function (async)
4. image-generate generates image via Imagen API
5. Image uploaded to Supabase Storage
6. Database operations (Promise.all):
   - Insert to image_generation_log
   - Update messages table with image URL
   - Insert to user_images table
7. Broadcasts (unified channel):
   - message-update → Chat view replaces skeleton with image
   - image-insert → Gallery adds new image
8. Frontend receives broadcasts:
   - Chat: message-update listener updates the message
   - Gallery (if open): image-insert listener adds image to list
```

### Loading State Detection

Frontend detects loading state via:
```typescript
const isGenerating = message.meta?.status === 'generating' && 
                     message.meta?.message_type === 'image';
```
(See: `src/features/chat/MessageList.tsx` line 227)

### Before vs After

**Before:**
- ❌ Image generated but no broadcast
- ❌ Chat relied on postgres_changes (old system)
- ❌ Gallery had no real-time updates at all
- ❌ Required manual refresh to see images

**After:**
- ✅ Image generation broadcasts to unified channel
- ✅ Chat receives `message-update` event
- ✅ Gallery receives `image-insert` event (if open)
- ✅ Both update instantly without refresh

---

## Files Changed

1. **supabase/functions/llm-handler-gemini/index.ts** ⭐ NEW
   - Changed placeholder INSERT to `.select().single()` to get message data
   - Added broadcast for `message-insert` event with placeholder (loading state)
   - Sends immediately after placeholder creation

2. **supabase/functions/image-generate/index.ts**
   - Added `.select().single()` to database operations to get returned data
   - Added broadcast for `message-update` event (final image)
   - Added broadcast for `image-insert` event (gallery)

3. **src/components/chat/ImageGallery.tsx**
   - Imported `unifiedChannel` service
   - Added `useEffect` hook to listen for `image-insert` events
   - Auto-prepends new images to gallery when received

4. **src/services/websocket/UnifiedChannelService.ts**
   - Added `'image-insert'` to EventType union

---

## Testing Checklist

- [ ] Generate an image in chat
- [ ] **Verify skeleton/loading state appears immediately** ⭐ NEW
- [ ] Verify image replaces skeleton when generation completes
- [ ] Verify no page refresh needed
- [ ] Open image gallery while generating an image
- [ ] Verify new image appears in gallery without refresh
- [ ] Check browser console for broadcast logs (in dev mode):
  - `[image-start] Broadcast placeholder` (llm-handler-gemini)
  - `image_generate_message_broadcast_sent` (image-generate)
  - `image_generate_image_broadcast_sent` (image-generate)
- [ ] Verify no duplicate images appear

---

## Deployment

### Deploy Edge Functions:
```bash
supabase functions deploy llm-handler-gemini
supabase functions deploy image-generate
```

### Deploy Frontend:
```bash
npm run build
# Deploy via your hosting provider
```

---

**Status:** ✅ Complete  
**Impact:** Images now appear in real-time without requiring page refresh  
**Aligned with:** WebSocket optimization architecture (unified channel)

