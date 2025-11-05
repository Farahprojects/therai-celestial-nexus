# Image Generation Limit Fix

## Summary
Fixed image generation rate limiting to use `image_generation_log` as the **single source of truth**, preventing bypass via chat/message deletion.

## Changes Made

### 1. **Early Rate Limit Check** (`llm-handler-gemini/index.ts`)
- **Added**: `checkImageGenerationLimit()` function that queries `image_generation_log` table
- **Moved**: Rate limit check to happen **BEFORE** placeholder message creation
- **Result**: Users see error message immediately, no placeholder flash if limit exceeded

### 2. **Defense in Depth** (`image-generate/index.ts`)
- **Kept**: Existing rate limit check in `image-generate` function (defense in depth)
- **Added**: Final atomic check right before logging to catch race conditions
- **Result**: Double protection against concurrent requests

### 3. **Single Source of Truth**
- **Removed**: Any checks that query `messages` table for image counts
- **Verified**: Only `image_generation_log` table is used for rate limiting
- **Result**: Immutable audit log cannot be bypassed by deleting chats/messages

## Rate Limit Logic

### Primary Check (llm-handler-gemini)
```typescript
checkImageGenerationLimit(user_id)
  → Queries image_generation_log
  → Counts records from last 24 hours
  → Returns: { allowed: boolean, count: number, limit: 3 }
```

### Secondary Check (image-generate)
- Validates limit again before generating (defense in depth)
- Final check before logging (catches race conditions)

## Testing

Run `test_image_generation_limit.sql` in Supabase SQL Editor to verify:
1. 24-hour window calculation works correctly
2. Count queries return accurate results
3. RLS policies prevent unauthorized access
4. Orphaned logs persist (chat deletion doesn't affect limit)

## Benefits

✅ **Security**: Cannot bypass limit by deleting chats/messages  
✅ **UX**: Error shown immediately, no placeholder flash  
✅ **Reliability**: Double-check prevents race conditions  
✅ **Audit**: Immutable log tracks all image generations  

## Files Changed

- `supabase/functions/llm-handler-gemini/index.ts` - Added early limit check
- `supabase/functions/image-generate/index.ts` - Added final atomic check
- `test_image_generation_limit.sql` - Test queries for verification

