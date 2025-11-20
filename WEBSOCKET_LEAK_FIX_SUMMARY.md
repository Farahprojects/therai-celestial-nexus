# WebSocket Leak Fix - Implementation Summary

## Problem Identified

1. **Effect Dependencies Causing Re-subscriptions**: `FolderView.tsx` had `upsertConversation` and `removeConversationById` in effect dependencies, causing re-subscriptions on every render
2. **Multiple Channels Per Folder**: Separate channels for conversations and documents
3. **Always-On Subscriptions**: Subscriptions active even when not needed (no folder creation or document upload happening)
4. **No Queuing System**: No mechanism to defer subscription until needed

## Solution Implemented

### 1. Created Unified Folder Service (`UnifiedFolderService.ts`)

**Key Features:**
- **Lazy Subscription Pattern**: Subscriptions are queued, not established immediately
- **Unified Channel**: Single channel per folder handling both conversations and documents
- **On-Demand Activation**: WebSocket connection only established when:
  - User creates a new folder
  - User uploads a document
  - User creates a conversation in folder
- **Queue Management**: Handles subscription queue until connection is needed
- **Proper Cleanup**: Tracks and cleans up subscriptions properly

### 2. Fixed Effect Dependencies in `FolderView.tsx`

**Before:**
```typescript
useEffect(() => {
  // ... subscription setup
}, [folderId, upsertConversation, removeConversationById]); // ❌ Causes re-subscriptions
```

**After:**
```typescript
// Use refs to avoid dependencies
const upsertConversationRef = useRef(...);
const removeConversationByIdRef = useRef(...);

useEffect(() => {
  // ... subscription setup using refs
}, [folderId]); // ✅ Only folderId in dependencies
```

### 3. Implemented Lazy Subscription Pattern

**Before:**
- Subscription established immediately on component mount
- Always connected, even when not needed

**After:**
- Subscription queued on mount (no WS connection yet)
- Connection established only when:
  - `handleNewChat()` - Creating conversation
  - `handleDocumentUploaded()` - Uploading document
  - Future: Folder creation flow

### 4. Unified Conversations and Documents

**Before:**
- Separate channels for conversations and documents
- Multiple subscriptions per folder

**After:**
- Single channel per folder: `folder:${folderId}`
- Unified event handlers for both conversations and documents
- Reduces connection count by 50% per folder

## Files Changed

### New Files
- `src/services/websocket/UnifiedFolderService.ts` - Unified folder subscription service

### Modified Files
- `src/components/folders/FolderView.tsx`
  - Replaced direct Supabase channel with unified service
  - Fixed effect dependencies using refs
  - Implemented lazy subscription pattern
  - Removed refreshDocuments dependency issue

## Connection Optimization

### Before
- **Per Folder**: 1-2 channels (conversations + documents)
- **Always Active**: Even when idle
- **Re-subscription**: On every render due to dependencies

### After
- **Per Folder**: 1 channel (unified)
- **Lazy**: Only active when needed (creating/uploading)
- **Stable**: No re-subscriptions from dependencies

## Usage Pattern

```typescript
// Component mounts - queue subscription (no WS connection)
useEffect(() => {
  unifiedFolderService.subscribe(folderId, handlers, false); // Queue, don't establish
}, [folderId]);

// User creates conversation - establish WS connection
const handleNewChat = async () => {
  await unifiedFolderService.triggerSubscription(folderId); // Establish now
  // ... create conversation
};

// User uploads document - establish WS connection
const handleDocumentUploaded = async () => {
  await unifiedFolderService.triggerSubscription(folderId); // Establish now
  // ... handle upload
};
```

## Benefits

1. **Reduced Connections**: Only active when needed, not always-on
2. **No Leaks**: Proper cleanup and no re-subscriptions
3. **Better Performance**: Fewer WebSocket connections = lower server load
4. **Unified Architecture**: Single service manages all folder subscriptions
5. **Scalable**: Can handle many folders without connection exhaustion

## Testing Checklist

- [ ] Folder view loads without establishing WS connection
- [ ] Creating conversation establishes WS connection
- [ ] Uploading document establishes WS connection
- [ ] Conversation updates received in real-time after connection
- [ ] Document updates received in real-time after connection
- [ ] Component unmount properly cleans up subscription
- [ ] Switching folders properly cleans up old subscription
- [ ] No duplicate subscriptions on re-render
- [ ] Monitor Supabase Realtime dashboard for connection count

## Next Steps

1. **Add folder creation trigger**: Update `createFolder()` to trigger subscription
2. **Monitor connections**: Track connection count in Supabase dashboard
3. **Add metrics**: Log subscription lifecycle events for monitoring
4. **Audit other subscriptions**: Apply same pattern to other components if needed

## Monitoring

Monitor these metrics:
- Supabase Dashboard → Realtime → Connections (should be lower)
- Browser console → Look for `[UnifiedFolderService]` logs
- Network tab → WebSocket connections (should only appear when needed)

