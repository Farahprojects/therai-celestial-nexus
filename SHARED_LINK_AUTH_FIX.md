# Shared Link Authentication Fix

## Problem Statement

When users clicked on shared folder or chat links without being authenticated:
- They were redirected to sign in
- The intended destination (chat_id or folder_id) was stored in **localStorage only**
- After OAuth authentication, the destination was often **lost** due to:
  - OAuth redirects clearing localStorage
  - New tabs/windows not sharing localStorage
  - Browser privacy modes blocking localStorage

This resulted in users completing authentication but landing on the home page instead of the shared resource they intended to access.

## Solution Architecture

Implemented a **URL parameter-based redirect preservation** system that:
1. Encodes the target URL in query parameters (`?redirect=/folders/abc123`)
2. Preserves these parameters through the entire auth flow (including OAuth)
3. Uses localStorage as a **fallback only** for backward compatibility
4. Provides explicit, debuggable redirect handling

### Key Benefits

- ✅ **Survives OAuth redirects** - URL params are preserved through external OAuth flows
- ✅ **Works across tabs/windows** - URL params travel with the link
- ✅ **Privacy-mode compatible** - Doesn't depend on localStorage
- ✅ **Explicit and debuggable** - Clear redirect parameter in URL
- ✅ **Standard pattern** - Used by major web applications

## Implementation Details

### 1. New Utility Module (`src/utils/redirectUtils.ts`)

Created centralized redirect handling utilities:

```typescript
// Encode/decode redirect paths for URL params
encodeRedirectPath(path: string): string
decodeRedirectPath(encodedPath: string): string

// Store redirect (URL params + localStorage fallback)
setRedirectPath(path: string): string

// Get redirect (checks URL params first, then localStorage)
getRedirectPath(searchParams: URLSearchParams): string | null

// Clean up redirect state
clearRedirectPath(): void

// Extract ID and type from redirect path
extractIdFromPath(path: string): { type: 'folder' | 'chat' | 'unknown', id: string | null }
```

### 2. Updated Join Pages

**JoinFolder.tsx** and **JoinConversation.tsx**:
- Now pass redirect parameter when navigating to auth: `/therai?redirect=/folders/:id`
- Still store in localStorage as fallback
- Enhanced error handling with try-catch blocks

### 3. Updated ChatContainer

**ChatContainer.tsx**:
- **Priority 1**: Check URL params for redirect (`getRedirectPath(searchParams)`)
- **Priority 2**: Fallback to localStorage (backward compatibility)
- Handles both folder and chat redirects with proper participant management
- Cleans up redirect params after successful navigation

### 4. OAuth Flow Updates

**authManager.ts**:
- Preserves redirect parameter through OAuth flow
- Extracts redirect from current URL and includes it in OAuth `redirectTo`
- Example: `redirectTo: https://app.com/therai?redirect=/folders/abc123`

### 5. Auth Page Updates

Updated all authentication pages to respect redirect params:

**Login.tsx**:
- Checks redirect param before navigating after login
- Priority: URL param > location state > default

**AuthPage.tsx**:
- Preserves redirect param when redirecting to signup
- Navigates to redirect destination after email verification

**Signup.tsx**:
- Checks redirect param when user is already logged in
- Redirects to intended destination after signup

## Flow Diagrams

### Before (localStorage only)

```
User clicks: /folder/:id
  ↓
Not authenticated
  ↓
Store in localStorage: pending_join_folder_id
  ↓
Navigate to /therai
  ↓
User signs in with OAuth
  ↓
OAuth redirect may clear localStorage ❌
  ↓
User lands on /therai (destination lost) ❌
```

### After (URL params + localStorage fallback)

```
User clicks: /folder/:id
  ↓
Not authenticated
  ↓
Store in URL + localStorage: /therai?redirect=/folders/:id
  ↓
User signs in with OAuth
  ↓
OAuth redirectTo includes: ?redirect=/folders/:id ✅
  ↓
After auth, ChatContainer reads redirect param ✅
  ↓
User lands on /folders/:id (destination preserved) ✅
```

## Testing Checklist

### Shared Folder Link
- [ ] Unauthenticated user clicks `/folder/:id`
- [ ] User is redirected to `/therai?redirect=/folders/:id`
- [ ] Auth modal opens
- [ ] User signs in with email/password
- [ ] After auth, user lands on `/folders/:id`
- [ ] User is added as folder participant

### Shared Folder Link (OAuth)
- [ ] Unauthenticated user clicks `/folder/:id`
- [ ] User clicks "Sign in with Google"
- [ ] OAuth flow opens (redirect param preserved)
- [ ] After OAuth completion, user lands on `/folders/:id`
- [ ] User is added as folder participant

### Shared Chat Link
- [ ] Unauthenticated user clicks `/join/:chatId`
- [ ] User is redirected to `/therai?redirect=/c/:chatId`
- [ ] Auth modal opens
- [ ] User signs in
- [ ] After auth, user lands on `/c/:chatId`
- [ ] User is added as chat participant

### Edge Cases
- [ ] User opens auth in new tab (URL param preserved)
- [ ] User in private browsing mode (doesn't depend on localStorage)
- [ ] User refreshes during auth flow (URL param persists)
- [ ] Invalid redirect param (fails gracefully)

## Backward Compatibility

The implementation maintains **full backward compatibility**:

1. **localStorage fallback**: Still checks localStorage if URL param is missing
2. **Existing flows unchanged**: Non-shared-link auth flows work identically
3. **Graceful degradation**: If both methods fail, users land on default page

## Files Modified

1. ✅ `src/utils/redirectUtils.ts` (NEW)
2. ✅ `src/pages/JoinFolder.tsx`
3. ✅ `src/pages/JoinConversation.tsx`
4. ✅ `src/pages/ChatContainer.tsx`
5. ✅ `src/services/authManager.ts`
6. ✅ `src/pages/Login.tsx`
7. ✅ `src/pages/AuthPage.tsx`
8. ✅ `src/pages/Signup.tsx`

## Monitoring and Debugging

Enhanced console logging throughout:
- `[JoinFolder]` - Folder join flow
- `[JoinConversation]` - Chat join flow
- `[ChatContainer]` - Post-auth redirect handling
- `[AuthManager]` - OAuth redirect preservation

Search for these tags in browser console to trace redirect flow.

## Future Improvements

Potential enhancements (not required for MVP):
1. Add redirect parameter validation/sanitization
2. Implement redirect parameter expiration (security)
3. Add analytics tracking for shared link conversion rates
4. Create unified redirect service for other auth flows






