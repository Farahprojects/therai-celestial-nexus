# Architecture Cleanup: user_id → chat_id Migration

## Problem
The previous architecture was confusing because it mixed `user_id` and `chat_id` concepts:
- `translator_logs` and `report_logs` saved `user_id`
- But for astro mode, each conversation should have separate data tied to `chat_id`
- For insights, data should be tied to `report_id`
- This made debugging difficult and the flow unclear

## Solution
Renamed `user_id` → `chat_id` throughout the system to represent the **context** of the request:
- **Astro mode**: `chat_id = conversation.id`
- **Profile flow**: `chat_id = user.id`
- **Insights**: `chat_id = report_id`
- **Guest reports**: `chat_id = guest_report_id`

## Changes Made

### 1. Database Migration
**File**: `supabase/migrations/20250102000000_rename_user_id_to_chat_id.sql`
- Renamed `translator_logs.user_id` → `translator_logs.chat_id`
- Renamed `report_logs.user_id` → `report_logs.chat_id`
- Updated indexes accordingly
- Added column comments for clarity

### 2. Edge Functions Updated

#### `initiate-auth-report/index.ts`
- Now passes `chat_id: actualChatId` to translator-edge (instead of complex logic with user_id/context_id)
- Simplified payload structure

#### `translator-edge/index.ts`
- Schema: `user_id` → `chat_id`
- Variable: `userId` → `chatId`
- `logTranslator` function signature and calls updated
- Context-injector call updated to pass correct `chat_id`

#### `context-injector/index.ts`
- Query updated to use `chat_id` instead of `user_id`

#### `get-report-data/index.ts`
- Queries updated to use `chat_id` instead of `user_id` for both tables

#### `standard-report/index.ts`, `standard-report-two/index.ts`, `standard-report-three/index.ts`, `standard-report-four/index.ts`
- `logAndSignalCompletion` updated to insert `chat_id` (with fallback to `user_id` for backward compatibility)

### 3. Frontend Fixed
**File**: `src/components/chat/AstroDataForm.tsx`
- Line 198: Changed from `buildAuthReportPayload(data, finalContextId)` to `buildAuthReportPayload(data, currentChatId)`
- This ensures the newly created `chat_id` is passed (not the stale `finalContextId`)

## Benefits

### 1. Clarity
- Single consistent identifier throughout the system
- Easy to understand: "What's the chat_id for this request?"

### 2. Debuggability
- Logs now clearly show the actual conversation/report/user context
- No more confusion between user_id and chat_id

### 3. Correctness
- Astro mode properly saves data per conversation
- Each conversation has its own form data and translator logs
- No more mixing data between different conversations of the same user

### 4. Architecture
- `initiate-auth-report`: Verifies `chat_id` belongs to authenticated user
- Passes `chat_id` to `translator-edge`
- `translator-edge`: Saves to `chat_id` column
- Everything flows cleanly with one identifier

## Testing Checklist
- [ ] Astro mode form submission creates correct chat_id and passes it through
- [ ] translator_logs saves with correct chat_id (conversation id)
- [ ] report_logs saves with correct chat_id
- [ ] Profile flow still works (chat_id = user_id)
- [ ] Insights flow still works (chat_id = report_id)
- [ ] Guest reports still work (backward compatibility with user_id fallback)
- [ ] context-injector retrieves correct Swiss data for the conversation
- [ ] Multiple conversations by same user have separate data

## Migration Notes
- **Backward compatibility**: Standard report functions use `reportData.chat_id || reportData.user_id` as fallback
- **Database migration**: Run the migration to rename columns and update indexes
- **No data loss**: Column rename preserves all existing data

