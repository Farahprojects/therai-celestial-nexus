# Shared Link Authentication - Testing Guide

## Quick Test Scenarios

### Test 1: Shared Folder Link (Email/Password Auth)

**Steps:**
1. Open browser in **incognito mode** (to simulate unauthenticated user)
2. Navigate to a shared folder link: `https://yourapp.com/folder/:folderId`
3. **Expected:** You should be redirected to `/therai?redirect=%2Ffolders%2F:folderId`
4. **Expected:** Auth modal should appear
5. Sign in with email and password
6. **Expected:** After authentication, you should land on `/folders/:folderId`
7. **Expected:** You should see the folder contents
8. **Verify in console:** Look for `[ChatContainer] Found redirect path in URL params`

**Success Criteria:** ✅ User lands on the intended folder after authentication

---

### Test 2: Shared Folder Link (Google OAuth)

**Steps:**
1. Open browser in **incognito mode**
2. Navigate to a shared folder link: `https://yourapp.com/folder/:folderId`
3. **Expected:** Redirected to `/therai?redirect=%2Ffolders%2F:folderId`
4. Click "Continue with Google"
5. **Expected:** OAuth popup opens
6. Complete Google OAuth flow
7. **Expected:** After OAuth redirect, you land on `/folders/:folderId`
8. **Verify in Network tab:** OAuth `redirectTo` URL should include `?redirect=` param

**Success Criteria:** ✅ User lands on the intended folder after OAuth authentication

---

### Test 3: Shared Chat Link (Email/Password Auth)

**Steps:**
1. Open browser in **incognito mode**
2. Navigate to a shared chat link: `https://yourapp.com/join/:chatId`
3. **Expected:** Redirected to `/therai?redirect=%2Fc%2F:chatId`
4. Sign in with email/password
5. **Expected:** After authentication, you land on `/c/:chatId`
6. **Expected:** You see the chat conversation
7. **Verify:** You are added as a participant in the chat

**Success Criteria:** ✅ User lands on the intended chat and can see messages

---

### Test 4: Shared Chat Link (Apple OAuth)

**Steps:**
1. Open browser in **incognito mode**
2. Navigate to: `https://yourapp.com/join/:chatId`
3. Click "Continue with Apple"
4. Complete Apple OAuth
5. **Expected:** After OAuth, you land on `/c/:chatId`
6. **Verify in console:** Look for `[AuthManager] Preserving redirect through OAuth`

**Success Criteria:** ✅ User lands on the intended chat after Apple OAuth

---

### Test 5: New Tab Scenario (Critical Edge Case)

**Background:** This tests the most common failure scenario with localStorage-only approach

**Steps:**
1. Open browser in **incognito mode**
2. Navigate to: `https://yourapp.com/folder/:folderId`
3. **Expected:** Redirected with `?redirect=` param
4. Right-click "Sign in with Google" → Open in new tab (simulates some OAuth flows)
5. Complete OAuth in the new tab
6. **Expected:** Even in new tab, redirect param is preserved in URL
7. **Expected:** User lands on `/folders/:folderId`

**Success Criteria:** ✅ Redirect works even when auth happens in a different tab

---

### Test 6: Private Browsing Mode

**Steps:**
1. Open browser in **private/incognito mode** (localStorage may be restricted)
2. Navigate to: `https://yourapp.com/folder/:folderId`
3. Complete authentication (any method)
4. **Expected:** User lands on `/folders/:folderId`

**Success Criteria:** ✅ Works even with localStorage disabled

---

### Test 7: Already Authenticated User

**Steps:**
1. Sign in to your account first
2. Then click on a shared folder link: `https://yourapp.com/folder/:folderId`
3. **Expected:** JoinFolder checks if you're already authenticated
4. **Expected:** If you're not a participant, you're added automatically
5. **Expected:** You're immediately redirected to `/folders/:folderId`

**Success Criteria:** ✅ No auth prompt; immediate access if already signed in

---

### Test 8: Public Folder (No Auth Required)

**Steps:**
1. Create a public folder (set `is_public: true`)
2. Navigate to folder link while **not** authenticated
3. **Expected:** Folder contents load immediately without auth prompt

**Success Criteria:** ✅ Public folders accessible without authentication

---

### Test 9: Invalid/Expired Link

**Steps:**
1. Navigate to a non-existent folder: `https://yourapp.com/folder/invalid-id-12345`
2. **Expected:** Redirected to `/therai` with error handling
3. **Expected:** No infinite redirect loop

**Success Criteria:** ✅ Graceful error handling for invalid links

---

### Test 10: Mobile Browser (Safari iOS)

**Steps:**
1. Open Safari on iPhone in private mode
2. Navigate to shared folder link
3. Complete OAuth flow (Apple recommended for iOS)
4. **Expected:** User lands on intended destination

**Success Criteria:** ✅ Mobile OAuth flows preserve redirect parameter

---

## Console Verification Points

When testing, watch browser console for these log messages:

### JoinFolder Flow
```
[JoinFolder] Starting loadFolder
[JoinFolder] Folder fetched: { id: '...', name: '...', is_public: false }
[JoinFolder] Private folder, user not authenticated - preserving redirect
[AuthManager] Preserving redirect through OAuth: /folders/...
```

### ChatContainer Post-Auth
```
[ChatContainer] Found redirect path in URL params: /folders/...
[ChatContainer] Handling folder redirect { folderId: '...', userId: '...' }
[ChatContainer] Is participant: false
[ChatContainer] Adding as participant
[ChatContainer] Successfully added as participant
[ChatContainer] Redirecting to: /folders/...
```

### OAuth Flow
```
[AuthManager] Web OAuth: google
[AuthManager] Preserving redirect through OAuth: /folders/...
[AuthManager] Preserving pending join state: { ..., redirectTo: 'https://app.com/therai?redirect=...' }
```

---

## Network Tab Verification

### Check OAuth Redirect URL

1. Open DevTools → Network tab
2. Filter for "auth" or "oauth"
3. Find the OAuth initiation request
4. Check the `redirectTo` parameter
5. **Verify:** It includes `?redirect=/folders/:id` or `?redirect=/c/:id`

Example:
```
redirectTo: https://yourapp.com/therai?redirect=%2Ffolders%2Fabc123
```

---

## Known Issues to Watch For

### ❌ If redirect fails:
1. **Check URL bar:** Is the `?redirect=` param present?
2. **Check console:** Look for `[ChatContainer] Found redirect path`
3. **Check localStorage:** Fallback should still work

### ❌ If OAuth loses context:
1. **Verify:** OAuth `redirectTo` includes redirect param
2. **Check:** AuthManager logs show "Preserving redirect"

### ❌ If infinite redirect loop:
1. Check for missing error handling in JoinFolder/JoinConversation
2. Verify `clearRedirectPath()` is called after redirect

---

## Automated Test Script (Optional)

For developers, here's a quick Playwright test:

```typescript
test('shared folder link preserves destination through OAuth', async ({ page, context }) => {
  // Start unauthenticated
  await context.clearCookies();
  
  // Click shared folder link
  await page.goto('http://localhost:5173/folder/test-folder-id');
  
  // Verify redirect param in URL
  await expect(page).toHaveURL(/redirect=%2Ffolders%2Ftest-folder-id/);
  
  // Sign in (mock OAuth or use test account)
  await page.click('button:has-text("Continue with Google")');
  // ... complete OAuth ...
  
  // Verify final destination
  await expect(page).toHaveURL(/\/folders\/test-folder-id/);
  
  // Verify folder contents loaded
  await expect(page.locator('[data-testid="folder-content"]')).toBeVisible();
});
```

---

## Rollback Plan

If issues arise in production:

1. **Immediate:** The system still uses localStorage as fallback
2. **Quick Fix:** Can temporarily disable URL param logic in `ChatContainer.tsx`
3. **Full Rollback:** Revert changes to restore localStorage-only behavior

---

## Success Metrics

After deployment, monitor:

- **Conversion Rate:** % of shared link clicks that result in successful access
- **Auth Completion Rate:** % of auth flows that preserve destination
- **Error Rate:** Track failed redirects in analytics
- **User Complaints:** Monitor support tickets about "lost destination" issues

Expected improvement: **30-50% reduction** in "lost destination" issues.







