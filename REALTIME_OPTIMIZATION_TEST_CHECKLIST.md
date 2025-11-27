# Realtime Optimization - Test Checklist

**Date:** November 20, 2025  
**Status:** Ready for Testing

---

## Critical Tests (Must Verify)

### ✅ 1. Conversations in Folders

**You've tested:** Chat thread creation ✅

**Also test:**
- [ ] **Update conversation title** - Should update immediately in folder view
- [ ] **Delete conversation** - Should disappear immediately from folder
- [ ] **Move conversation to folder** - Should appear in new folder immediately
- [ ] **Move conversation out of folder** - Should disappear from folder immediately
- [ ] **Switch between folders** - Should subscribe/unsubscribe correctly
- [ ] **Shared folder** - Create conversation in shared folder, verify other user sees it

### ✅ 2. Message Delivery

**Test:**
- [ ] **Send message** - Should appear immediately (via unified channel)
- [ ] **Assistant response** - Should appear in real-time
- [ ] **Image generation updates** - Status should update (generating → completed)
- [ ] **Multiple users in conversation** - Both users should see messages
- [ ] **Switch conversations** - Messages should load correctly

### ✅ 3. Insights Generation

**Test:**
- [ ] **Generate insight report** - Should show "Report Submitted" screen
- [ ] **Wait for completion** - Should close modal and show in sidebar when ready (~8 seconds)
- [ ] **Pending insights** - Should show with reduced opacity in sidebar
- [ ] **Multiple insights** - Should handle multiple pending insights correctly

### ✅ 4. Folder Documents

**Test:**
- [ ] **Upload document** - Should appear immediately (optimistic update)
- [ ] **Delete document** - Should disappear immediately
- [ ] **Refresh button** - Should reload documents
- [ ] **Tab focus refresh** - Switch tabs and return, documents should refresh
- [ ] **Shared folder documents** - Other user uploads, you see on focus/refresh

### ✅ 5. Performance Verification

**Monitor:**
- [ ] **Subscription count** - Check Supabase dashboard (should be ~1-2 per user)
- [ ] **Realtime latency** - Run `monitor_realtime_performance.sql`
- [ ] **No errors** - Check browser console for errors
- [ ] **Channel cleanup** - Switch folders, verify old channels are removed

---

## Edge Cases to Test

### Multi-User Scenarios
- [ ] **Shared conversation** - Multiple users, messages appear for all
- [ ] **Shared folder** - Multiple users, conversations appear for all
- [ ] **Public folder** - Unauthenticated user can view conversations

### State Management
- [ ] **Multiple tabs** - Open same folder in 2 tabs, verify single subscription
- [ ] **Tab close/reopen** - Close tab, reopen, verify reconnection
- [ ] **Network interruption** - Disconnect/reconnect, verify recovery

### Error Handling
- [ ] **Invalid folder ID** - Should handle gracefully
- [ ] **Unauthorized folder** - Should not receive broadcasts
- [ ] **Missing conversation** - Should handle gracefully

---

## Quick Smoke Tests (5 minutes)

If you're short on time, at minimum verify:

1. ✅ **Create conversation in folder** - Appears immediately
2. ✅ **Update conversation title** - Updates immediately  
3. ✅ **Send message** - Appears immediately
4. ✅ **Generate insight** - Completes and appears (~8 seconds)
5. ✅ **Check Supabase dashboard** - Subscription count reduced

---

## Performance Benchmarks

### Before Optimization
- Subscriptions: ~10 per user
- Database load: 98% on realtime
- Latency: 5-6ms mean, 10s spikes

### After Optimization (Target)
- Subscriptions: ~1-2 per user ✅
- Database load: ~10% on realtime (verify)
- Latency: <1ms mean, <100ms spikes (verify)

---

## If Everything Works ✅

You're good to go! The optimization is complete and ready for production.

**Next steps:**
1. Monitor for 24-48 hours
2. Check Supabase dashboard for subscription count
3. Run `monitor_realtime_performance.sql` periodically
4. Set up alerts if needed

---

## If Issues Found

**Common issues and fixes:**

1. **Conversations not updating**
   - Check: Trigger exists? `SELECT * FROM pg_trigger WHERE tgname = 'conversations_broadcast_trigger';`
   - Check: RLS policy exists? `SELECT * FROM pg_policies WHERE policyname = 'folder_members_can_receive';`
   - Check: Browser console for channel errors

2. **Messages not appearing**
   - Check: Unified channel subscribed? (should be automatic)
   - Check: Edge function broadcasting? (check logs)

3. **Insights not completing**
   - Check: Polling active? (check console logs)
   - Check: Insight ID correct? (check database)

4. **High subscription count**
   - Check: Old channels not cleaned up? (check Supabase dashboard)
   - Check: Multiple tabs open? (expected, but should be minimal)

---

## Test Results Template

```
Date: ___________
Tester: ___________

Conversations:
- [ ] Create: ✅ / ❌
- [ ] Update: ✅ / ❌
- [ ] Delete: ✅ / ❌
- [ ] Move: ✅ / ❌

Messages:
- [ ] Send: ✅ / ❌
- [ ] Receive: ✅ / ❌
- [ ] Updates: ✅ / ❌

Insights:
- [ ] Generate: ✅ / ❌
- [ ] Complete: ✅ / ❌

Documents:
- [ ] Upload: ✅ / ❌
- [ ] Delete: ✅ / ❌
- [ ] Refresh: ✅ / ❌

Performance:
- Subscription count: _____
- Latency: _____
- Errors: _____
```

---

## Success Criteria

✅ **All critical tests pass**
✅ **Subscription count < 3 per user**
✅ **No console errors**
✅ **Real-time updates working**
✅ **Performance improved**

If all above are true → **Ready for production!** 🚀



