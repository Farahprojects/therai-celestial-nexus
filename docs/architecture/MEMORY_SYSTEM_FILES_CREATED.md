# Memory System - Files Created & Modified

## New SQL Migration Files ✅

1. `supabase/migrations/20250204000001_add_profile_id_to_conversations.sql`
2. `supabase/migrations/20250204000002_create_memory_type_enum.sql`
3. `supabase/migrations/20250204000003_create_user_memory_table.sql`
4. `supabase/migrations/20250204000004_create_weekly_summaries_table.sql`
5. `supabase/migrations/20250204000005_create_monthly_summaries_table.sql`
6. `supabase/migrations/20250204000006_add_memory_rls_policies.sql`

## New Edge Functions ✅

1. `supabase/functions/extract-user-memory/index.ts` - Memory extraction from conversations
2. `supabase/functions/generate-weekly-summaries/index.ts` - Weekly energy summaries
3. `supabase/functions/generate-monthly-summaries/index.ts` - Monthly summaries + backfill
4. `supabase/functions/compare-yearly-patterns/index.ts` - Year-over-year analysis
5. `supabase/functions/archive-old-memories/index.ts` - Memory retention enforcement
6. `supabase/functions/_shared/memoryInjection.ts` - Shared memory fetching/scoring logic

## Modified Edge Functions ✅

1. `supabase/functions/chat-send/index.ts`
   - Triggers `extract-user-memory` after AI response
   - Checks for profile_id on conversation

2. `supabase/functions/llm-handler-gemini/index.ts`
   - Changed `SUMMARY_INTERVAL` from 12 to 4
   - Added memory variables (partial - needs manual patch)

3. `supabase/functions/conversation-manager/index.ts`
   - Added `update_conversation_profile` handler
   - Added `profile_id` parameter to `create_conversation`

## Memory Injection Patch Files 📝

1. `supabase/functions/llm-handler-gemini-memory.patch.ts` - Instructions to integrate memory
2. `supabase/functions/llm-handler-chatgpt-memory.patch.ts` - Instructions to integrate memory

**⚠️ These patches need to be manually applied to the respective LLM handler files.**

## New Frontend Components ✅

1. `src/components/settings/panels/MemoryPanel.tsx` - Memory dashboard UI
2. `src/hooks/useUserMemory.ts` - React hook for fetching memories

## Modified Frontend Files ✅

1. `src/components/settings/SettingsModal.tsx`
   - Added Brain icon import
   - Added Memory tab to tabs list
   - Added MemoryPanel import and TabsContent

2. `src/components/onboarding/OnboardingModal.tsx`
   - Fetches profile_id after profile creation
   - Passes profile_id to conversation creation

## Documentation Files ✅

1. `USER_MEMORY_SYSTEM_PLAN.md` - Comprehensive system plan
2. `MEMORY_SYSTEM_SQL_MIGRATIONS.md` - Migration file list
3. `MEMORY_SYSTEM_DEPLOYMENT.md` - Deployment & testing guide
4. `MEMORY_SYSTEM_FILES_CREATED.md` - This file
5. `src/components/onboarding/OnboardingModal.integration.notes.md` - Integration notes

## Remaining Manual Tasks 📋

### High Priority

1. **Apply memory injection patches:**
   - Apply `llm-handler-gemini-memory.patch.ts` to `llm-handler-gemini/index.ts`
   - Apply `llm-handler-chatgpt-memory.patch.ts` to `llm-handler-chatgpt/index.ts`

2. **Update conversation-manager insert:**
   - Add `profile_id` to the conversation insert in `create_conversation`

3. **Run SQL migrations in order**

### Medium Priority

4. **Configure cron jobs** in Supabase Dashboard:
   - `generate-weekly-summaries` - Weekly (Monday 2 AM)
   - `generate-monthly-summaries` - Monthly (1st, 3 AM)
   - `archive-old-memories` - Daily (4 AM)

5. **Test end-to-end flow:**
   - Create profile → conversation has profile_id
   - Chat → memories extracted
   - Memories visible in Settings → Memory
   - Memory injection in LLM responses

### Future Enhancements (v2)

- Inline memory chips in chat
- Undo toast after memory creation
- Per-conversation memory toggle
- ProfileSelector callback integration
- Relationship memory for Together mode
- A/B testing framework
- Advanced deduplication with embeddings

