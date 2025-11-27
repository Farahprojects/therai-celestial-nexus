# Options for Removing folder_documents Realtime Listener

**Current State:** 3 `postgres_changes` subscriptions (INSERT/UPDATE/DELETE) per folder view  
**Impact:** Contributes to 98% DB time on `realtime.list_changes`  
**Frequency:** Low (folders can be shared but infrequently)

---

## Option 1: Optimistic Updates + Manual Refresh ⭐ **RECOMMENDED**

**How it works:**
- User's own uploads update UI immediately (optimistic)
- Manual refresh button for shared folder scenarios
- No realtime subscriptions needed

**Pros:**
- ✅ Zero subscriptions (saves 3 per user)
- ✅ Fast UX for user's own actions
- ✅ Simple implementation
- ✅ No polling overhead

**Cons:**
- ❌ Shared folder users need to click refresh
- ❌ Folder AI updates require refresh

**Implementation:**
```typescript
// In FolderView.tsx
const handleDocumentUpload = async (file: File) => {
  // 1. Optimistically add to UI
  const optimisticDoc = {
    id: `temp-${Date.now()}`,
    file_name: file.name,
    upload_status: 'pending',
    // ... other fields
  };
  setDocuments(prev => [optimisticDoc, ...prev]);
  
  // 2. Upload document
  const document = await uploadDocument(userId, folderId, file);
  
  // 3. Replace optimistic with real
  setDocuments(prev => prev.map(d => 
    d.id === optimisticDoc.id ? document : d
  ));
};

// Add refresh button
<Button onClick={async () => {
  const docs = await getDocuments(folderId);
  setDocuments(docs);
}}>
  Refresh Documents
</Button>
```

**Best for:** Most use cases (90%+ of folders are single-user)

---

## Option 2: Optimistic Updates + On-Focus Refresh

**How it works:**
- User's own uploads update UI immediately
- Refresh documents when user returns to tab/folder
- No realtime subscriptions needed

**Pros:**
- ✅ Zero subscriptions
- ✅ Automatic refresh for shared folders (when user returns)
- ✅ Good UX balance

**Cons:**
- ❌ Not real-time (only refreshes on focus)
- ❌ Folder AI updates require tab focus

**Implementation:**
```typescript
// In FolderView.tsx
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Refresh documents when tab becomes visible
      refreshDocuments();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [folderId]);

const refreshDocuments = async () => {
  const docs = await getDocuments(folderId);
  setDocuments(docs);
};
```

**Best for:** Shared folders with occasional multi-user activity

---

## Option 3: Optimistic Updates + Lightweight Polling (Shared Only)

**How it works:**
- User's own uploads update UI immediately
- Poll every 30-60 seconds ONLY if folder is shared
- No realtime subscriptions needed

**Pros:**
- ✅ Zero subscriptions for single-user folders
- ✅ Automatic updates for shared folders
- ✅ Configurable polling interval

**Cons:**
- ❌ Polling overhead (minimal - only when shared)
- ❌ 30-60 second delay for shared updates

**Implementation:**
```typescript
// In FolderView.tsx
const [isShared, setIsShared] = useState(false);

useEffect(() => {
  // Check if folder is shared
  checkIfShared();
}, [folderId]);

useEffect(() => {
  if (!isShared) return; // No polling for single-user folders
  
  const interval = setInterval(async () => {
    const docs = await getDocuments(folderId);
    setDocuments(docs);
  }, 30000); // Poll every 30 seconds
  
  return () => clearInterval(interval);
}, [folderId, isShared]);

const checkIfShared = async () => {
  const folder = await getFolderWithProfile(folderId);
  setIsShared(folder?.is_public || false); // Or check participants
};
```

**Best for:** Folders that are frequently shared

---

## Option 4: Broadcast Events (Phase 2 Migration)

**How it works:**
- User's own uploads update UI immediately
- Edge functions broadcast events when documents change
- Subscribe to unified channel (already exists)
- No `postgres_changes` subscriptions

**Pros:**
- ✅ Real-time updates
- ✅ No `postgres_changes` overhead
- ✅ Uses existing unified channel infrastructure
- ✅ Scales better

**Cons:**
- ❌ Requires edge function changes
- ❌ Requires database triggers
- ❌ More complex implementation

**Implementation:**
```typescript
// 1. Database trigger (migration)
CREATE OR REPLACE FUNCTION notify_folder_document_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'folder_document_change',
    json_build_object(
      'folder_id', NEW.folder_id,
      'event', TG_OP,
      'document_id', NEW.id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER folder_document_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON folder_documents
FOR EACH ROW EXECUTE FUNCTION notify_folder_document_change();

// 2. Edge function broadcasts
// In upload/update functions, broadcast to unified channel

// 3. Frontend listens to unified channel
unifiedChannel.on('folder-document-change', (payload) => {
  if (payload.folder_id === folderId) {
    refreshDocuments();
  }
});
```

**Best for:** Long-term solution (Phase 2)

---

## Option 5: Hybrid Approach (Recommended for Now)

**How it works:**
- **Optimistic updates** for user's own actions
- **On-focus refresh** for shared folders
- **Manual refresh button** always available
- Remove all `postgres_changes` subscriptions

**Pros:**
- ✅ Zero subscriptions (immediate impact)
- ✅ Good UX for most cases
- ✅ Simple to implement
- ✅ Can migrate to broadcast later

**Cons:**
- ❌ Not fully real-time for shared folders
- ❌ Folder AI updates require refresh

**Implementation:**
```typescript
// In FolderView.tsx

// 1. Remove postgres_changes subscriptions (lines 438-473)

// 2. Add optimistic updates
const handleDocumentUpload = async (file: File) => {
  // Optimistic update
  const tempId = `temp-${Date.now()}`;
  setDocuments(prev => [{
    id: tempId,
    file_name: file.name,
    upload_status: 'pending',
    // ... other fields
  }, ...prev]);
  
  try {
    const document = await uploadDocument(userId, folderId, file);
    // Replace optimistic with real
    setDocuments(prev => prev.map(d => 
      d.id === tempId ? document : d
    ));
  } catch (error) {
    // Remove optimistic on error
    setDocuments(prev => prev.filter(d => d.id !== tempId));
  }
};

// 3. Add on-focus refresh
useEffect(() => {
  const handleFocus = () => {
    refreshDocuments();
  };
  
  window.addEventListener('focus', handleFocus);
  return () => window.removeEventListener('focus', handleFocus);
}, [folderId]);

// 4. Add manual refresh button
<Button onClick={refreshDocuments} variant="ghost" size="sm">
  <RefreshCw className="h-4 w-4" />
  Refresh
</Button>
```

**Best for:** Immediate fix (Phase 1.5)

---

## Recommendation

**For Phase 1.5 (Now):** Use **Option 5 (Hybrid Approach)**
- Immediate impact: -3 subscriptions per user
- Simple implementation
- Good UX for 90%+ of cases
- Can migrate to broadcast later

**For Phase 2 (Later):** Migrate to **Option 4 (Broadcast Events)**
- Full real-time updates
- Uses existing unified channel
- Best long-term solution

---

## Implementation Steps

1. **Remove postgres_changes subscriptions** (lines 438-473 in FolderView.tsx)
2. **Add optimistic updates** for uploads
3. **Add on-focus refresh** for shared folders
4. **Add manual refresh button** (optional but recommended)
5. **Test:** Single-user uploads, shared folder scenarios, Folder AI updates

---

## Expected Impact

**Before:**
- 3 `postgres_changes` subscriptions per folder view
- ~10 subscriptions per user total

**After:**
- 0 `postgres_changes` subscriptions for documents
- ~7 subscriptions per user total (30% reduction)
- Database load: 98% → ~85% on realtime (estimated)

---

## Migration Path

1. **Phase 1.5 (Now):** Remove realtime, use hybrid approach
2. **Phase 2 (Later):** Add broadcast events for full real-time
3. **Phase 3 (Future):** Optimize conversations realtime too



