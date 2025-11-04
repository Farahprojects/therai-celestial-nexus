# Memory System - Deployment Guide

## SQL Migrations (Run in Order)

```bash
# Navigate to project
cd /Users/peterfarrah/therai-celestial-nexus

# Apply migrations
supabase/migrations/20250204000001_add_profile_id_to_conversations.sql
supabase/migrations/20250204000002_create_memory_type_enum.sql
supabase/migrations/20250204000003_create_user_memory_table.sql
supabase/migrations/20250204000004_create_weekly_summaries_table.sql
supabase/migrations/20250204000005_create_monthly_summaries_table.sql
supabase/migrations/20250204000006_add_memory_rls_policies.sql
```

## Edge Functions Deployed

✅ Core Functions:
- `extract-user-memory` - Extracts memories from profile-based conversations
- `generate-weekly-summaries` - Creates weekly energy summaries (cron: weekly)
- `generate-monthly-summaries` - Creates monthly summaries (cron: monthly) + backfill endpoint
- `compare-yearly-patterns` - Year-over-year pattern analysis
- `archive-old-memories` - Memory retention enforcement (cron: daily)

✅ Modified Functions:
- `chat-send` - Triggers memory extraction
- `llm-handler-gemini` - SUMMARY_INTERVAL changed to 4
- `conversation-manager` - Added `update_conversation_profile` action

⚠️ Manual Patches Required:
Apply memory injection to LLM handlers:
- `llm-handler-gemini-memory.patch.ts` → `llm-handler-gemini/index.ts`
- `llm-handler-chatgpt-memory.patch.ts` → `llm-handler-chatgpt/index.ts`

Shared module created:
- `_shared/memoryInjection.ts`

## Frontend Components

✅ Created:
- `src/components/settings/panels/MemoryPanel.tsx`
- `src/hooks/useUserMemory.ts`

✅ Modified:
- `src/components/settings/SettingsModal.tsx` - Added Memory tab

⚠️ Manual Integration Needed:
- Link profile to conversation in `OnboardingModal.tsx` after profile creation
- Add callback in `ProfileSelector.tsx` to call `update_conversation_profile`

## Cron Jobs to Configure

Set up in Supabase Dashboard:

```yaml
# Weekly summaries - Every Monday at 2 AM
- name: generate-weekly-summaries
  schedule: "0 2 * * 1"
  
# Monthly summaries - 1st of each month at 3 AM
- name: generate-monthly-summaries
  schedule: "0 3 1 * *"
  
# Archive old memories - Daily at 4 AM
- name: archive-old-memories
  schedule: "0 4 * * *"
```

## Manual Backfill

If needed to regenerate monthly summaries:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/generate-monthly-summaries \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "backfill",
    "year": 2025,
    "month": 1
  }'
```

## Testing Checklist

- [ ] Migrations applied successfully
- [ ] Edge functions deployed
- [ ] Memory extraction triggers after AI response
- [ ] Memories appear in Settings > Memory
- [ ] Memory injection works in LLM handlers
- [ ] Weekly/monthly summaries generate correctly
- [ ] Cron jobs configured
- [ ] Profile linking works in onboarding
- [ ] RLS policies enforce user isolation
- [ ] Export functionality works
- [ ] Delete (soft delete) works

## Observability

Monitor in Supabase Logs:
- `[extract-user-memory]` - Memory extraction events
- `[memoryInjection]` - Memory fetching and usage updates
- `memories_used` - Count in LLM handler logs
- `memory_extraction_started` - Trigger events in chat-send

## Next Steps (Future v2)

- Relationship memory for Together mode
- UI: Inline memory chips
- UI: Undo toast after extraction
- UI: Per-conversation memory toggle
- A/B testing for memory impact
- Advanced deduplication (embeddings)
- Memory decay algorithm

