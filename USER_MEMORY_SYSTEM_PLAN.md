# User Memory System Implementation Plan

## Core Design: Profile Selection Triggers Memory

**Key Rule**: Memory is ONLY created when user explicitly selects "My Main Profile" (`is_primary=true`) for a conversation.

**Logic**:
- Add `profile_id` column to `conversations` table (nullable) - tracks owner's profile selection
- For shared/together mode: Each participant's memory is tracked separately via their own `user_id` + `profile_id`
- When user selects their primary profile (via existing ProfileSelector), store `profile_id` on conversation
- Memory extraction checks: `conversation.profile_id IS NOT NULL AND selected_profile.is_primary = true AND profile.user_id = message.user_id`
- Works in all modes (chat, astro, together/shared) - each user's messages tracked separately
- Generic chats without profile selection = no memory created
- Swiss mode: Default no memory unless user explicitly toggles on

**Primary Profile Switching Policy**:
- When user reassigns `is_primary=true` to a different profile:
  - Existing memories remain linked to their original `profile_id` (historical accuracy)
  - New memories will use the new primary profile
  - User can view memories by profile in Settings if needed
  - No automatic migration/deletion to preserve historical context

## Database Schema

### Migration: Add profile_id to conversations
```sql
ALTER TABLE conversations 
ADD COLUMN profile_id UUID REFERENCES user_profile_list(id);

CREATE INDEX idx_conversations_profile_id ON conversations(profile_id);
CREATE INDEX idx_conversations_user_profile ON conversations(user_id, profile_id) 
WHERE profile_id IS NOT NULL;

-- Ensure only one primary profile per user
ALTER TABLE user_profile_list
ADD CONSTRAINT unique_primary_per_user 
UNIQUE (user_id) 
WHERE is_primary = true;
```

### Migration: Create memory_type ENUM
```sql
CREATE TYPE memory_type AS ENUM ('fact', 'emotion', 'goal', 'pattern', 'relationship');
```

### Migration: Create user_memory table
```sql
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profile_list(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  turn_index INTEGER,
  memory_text TEXT NOT NULL,
  memory_type memory_type NOT NULL,
  confidence_score NUMERIC(4,3) DEFAULT 0.800 CHECK (confidence_score BETWEEN 0 AND 1),
  astrological_context JSONB,
  origin_mode TEXT, -- chat|astro|profile|together|swiss
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_referenced_at TIMESTAMPTZ,
  reference_count SMALLINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX idx_user_memory_user_profile_active 
ON user_memory(user_id, profile_id, is_active, last_referenced_at DESC) 
WHERE is_active = true;

CREATE INDEX idx_user_memory_created ON user_memory(created_at DESC);

CREATE INDEX idx_user_memory_reference 
ON user_memory(reference_count DESC, last_referenced_at DESC);

-- Full-text search for keyword search in Settings
CREATE INDEX user_memory_fts 
ON user_memory USING gin (to_tsvector('english', coalesce(memory_text,'')));
```

### Migration: Create user_memory_weekly_summaries table
```sql
CREATE TABLE user_memory_weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profile_list(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  week_number SMALLINT NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  emotional_summary TEXT NOT NULL,
  key_themes TEXT[],
  dominant_patterns TEXT[],
  conversation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, profile_id, year, week_number)
);

CREATE INDEX idx_weekly_summaries_user 
ON user_memory_weekly_summaries(user_id, year DESC, week_number DESC);
```

### Migration: Create user_memory_monthly_summaries table
```sql
CREATE TABLE user_memory_monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profile_list(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month >= 1 AND month <= 12),
  emotional_summary TEXT NOT NULL,
  cognitive_summary TEXT,
  key_themes TEXT[],
  dominant_transits JSONB,
  planetary_influences JSONB,
  conversation_count INTEGER DEFAULT 0,
  weekly_summaries_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, profile_id, year, month)
);

CREATE INDEX idx_monthly_summaries_user 
ON user_memory_monthly_summaries(user_id, year DESC, month DESC);
```

### RLS Policies (Critical for Security)
```sql
-- Enable RLS on memory tables
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_monthly_summaries ENABLE ROW LEVEL SECURITY;

-- Users can only access their own memories
CREATE POLICY "Users can manage their own memories"
ON user_memory FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own weekly summaries"
ON user_memory_weekly_summaries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own monthly summaries"
ON user_memory_monthly_summaries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: In together/shared mode, each participant's memories are separate
-- Never expose other participants' memories - RLS ensures isolation
```

## Edge Functions

### extract-user-memory
- Triggered async after AI responds in profile-based chat
- **Idempotency**: Use `conversation_id + source_message_id` as deduplication key
- Check if extraction already ran for this message ID to prevent duplicates on retries
- Validates: `conversation.profile_id IS NOT NULL AND profile.is_primary = true AND profile.user_id = message.user_id`
- If valid, analyzes conversation turn using LLM
- LLM prompt outputs strict JSON format:
  ```json
  {
    "memories": [
      {"type":"goal","text":"...","confidence":0.86,"astro_context":{"transits":[...]}},
      {"type":"pattern","text":"...","confidence":0.78}
    ]
  }
  ```
- Include few-shot examples of what NOT to save (opinions about AI, ephemeral logistics)
- Simple deduplication: Check text similarity (>0.85) before insert
- If duplicate found, increment `reference_count` instead of creating new
- Guardrails: Skip medical/financial claims or store with low confidence
- Rate limit: 60 extractions per user per minute
- **Retention Limits**: 
  - Cap: 1000 active memories per user per profile (archived memories don't count)
  - Background task: Archive memories older than 2 years if not referenced in last 6 months
  - User can opt-in to long-term storage in Settings
- Extracts 0-3 memories per turn (target: 0.5-2.0 per 10 turns, not per conversation)
- Stores in `user_memory` table with:
  - `profile_id` from conversation
  - `source_message_id` and `turn_index` for traceability
  - `origin_mode` from conversation.mode
- Gets profile birth chart data from `user_profile_list` using `profile_id`

### Hierarchical Summary System

The memory system uses a layered approach for better pattern recognition:

**4-Turn Summaries** (existing `llm-summarizer`):
- Triggered every 4 turns (change `SUMMARY_INTERVAL` from 12 to 4)
- Stores conversation context in `conversation_summaries` table
- Used for ongoing chat context compression
- 100-200 tokens per summary

**Weekly Summaries** (`generate-weekly-summaries`):
- Cron job (runs weekly, e.g., Sunday night)
- Collects all 4-turn summaries from the past week for each user's profile-based conversations
- Uses LLM to synthesize weekly energy summary capturing:
  - Dominant emotional patterns
  - Key themes and concerns
  - Energy shifts throughout the week
- Stores in `user_memory_weekly_summaries` table (new)
- **User-specific timezones**: Use `timezone` from `user_profile_list`

**Monthly Summaries** (`generate-monthly-summaries`):
- Cron job (runs 1st of each month)
- **Changed approach**: Collects weekly summaries (not raw memories) from the past month
- For each user, compute month boundaries using their profile timezone
- Uses LLM to synthesize monthly summary from weekly summaries
- Captures emotional/cognitive summaries with astrological context
- Stores in `user_memory_monthly_summaries`
- **Backfill handling**:
  - Include partial months for new users
  - Manual trigger endpoint: `POST /functions/v1/generate-monthly-summaries?action=backfill&year=2024&month=10`
  - Can regenerate a specific month if cron job missed a run

**Flow:**
```
Every turn (with profile) → extract-user-memory → user_memory (individual memories)
Every 4 turns → llm-summarizer → conversation_summaries (conversation context)
Weekly → generate-weekly-summaries → weekly energy summary
Monthly → generate-monthly-summaries (from weekly summaries) → user_memory_monthly_summaries
```

### compare-yearly-patterns
- Called on-demand when viewing monthly summary
- Compares current month with same month last year
- Uses LLM to generate growth/evolution insights
- Compose from stored summaries (don't re-query all memories)

## Integration Points

### chat-send/index.ts
- After saving assistant message, check if conversation has `profile_id`
- Verify selected profile has `is_primary=true`
- If both conditions met, trigger `extract-user-memory` async (fire-and-forget)

### LLM Handlers (llm-handler-chatgpt, llm-handler-gemini)
- Before generating response, check if conversation has `profile_id` where `is_primary=true`
- **Memory Selection Strategy** (explicit):
  - Retrieve memories with filters: `is_active=true AND profile_id=current_profile`
  - Type weighting: goal (1.5x), pattern (1.5x), relationship (1.3x), fact (1.0x), emotion (0.8x)
  - Scoring: `(type_weight * confidence * recency_factor) + (reference_count * 0.1)`
  - Recency factor: `1 / (1 + days_since_last_ref)` capped at 30 days
  - **Hard limit: 10 memories maximum** (prevents context overflow)
  - If more than 10 candidates, take top 10 by score
- Summarize selected memories into compact context block (<400-600 tokens)
- **Prompt Usage Metrics**: Log token count, memory count, and whether memories improved response (A/B tracking)
- Inject into system prompt as context
- Track which memories were used (store memory IDs in message meta)
- Return memory IDs used in response for UI display
- Update `last_referenced_at` and `reference_count` for used memories

### conversation-manager/index.ts
- Add `update_conversation_profile` action to set `profile_id` when user selects profile
- Validate that selected profile belongs to user and has `is_primary=true`
- Store `profile_id` on conversation when profile is selected
- For profile mode during onboarding, automatically link to created primary profile

## Frontend Components

### Profile Selection Integration
- Use existing ProfileSelector component from astro form (already exists in `src/components/shared/forms/ProfileSelector.tsx`)
- When user selects "My Main Profile" (is_primary=true), call `conversation-manager` to update conversation `profile_id`
- Show visual indicator (memory icon) in chat header when primary profile is active and memory building
- Works in all conversation modes including shared/together mode
- No new UI component needed - leverage existing ProfileSelector

### Settings UI
- Add "Memory" tab to `SettingsModal` component
- **Clear explanation**: "Memories are only created when you select 'My Main Profile' for a conversation. Generic chats without profile selection are never stored."
- Memory overview card (counts, status)
- Recent memories list (last 30 days) with:
  - Per-type filters (show only goals, patterns, etc.)
  - Keyword search (FTS-based)
  - Show which conversation each memory came from
  - Filter by profile (if user has multiple profiles)
- Monthly summary archive
- Memory controls:
  - Pause memory building
  - Delete individual memories
  - Clear all memories (with confirmation)
  - **Export memory archive** (JSON/CSV with all fields for portability) - **Priority: Phase 1.5**
  - Opt-in to long-term storage (disables automatic archiving)

### Memory Context Hook
- `useUserMemory.ts` - React hook for fetching/displaying memories
- Real-time updates via Supabase subscriptions

### UX Enhancements

**Inline Memory Chips:**
- Show in assistant message footer: "Used: [M-143 goal], [M-097 pattern]"
- Hover → preview memory text
- Click → open Settings > Memory anchored to that item

**Transparency:**
- "This was saved" toast with Undo button (soft-delete)
- Plain language onboarding: "When you talk from your Main Profile, I can remember goals and patterns to personalize insights. You control and can erase this anytime."

**Per-conversation toggle:**
- "Remember in this chat" toggle in header
- Default based on profile selection
- Only affects conversations where primary profile is selected

## Privacy & Transparency

### Onboarding Flow
- Plain language copy explaining memory building
- Modal on first profile-based chat
- Link to settings for management

### Visual Indicators
- Memory icon in chat header when primary profile is selected and memory building is active
- Gray out icon for generic (non-profile) chats

## Success Metrics

- Memory creation rate (target: 0.5-2.0 per 10 turns, not per conversation)
- Memory reference rate (target: 30%+ of AI responses use memories)
- Reference uplift: Response helpfulness score when memories injected vs. not (A/B test)
- User engagement with memory dashboard (target: 20% monthly)
- Retention impact: Churn delta for users with ≥N active memories (target: +15% for users with 50+ memories)
- Memory quality: Duplicate rate <10% via deduplication

## Implementation Phases

### Phase 1: Basic Memory (Week 1-2)
- Database migrations (with RLS policies, indexes, constraints)
- Profile selection integration with existing ProfileSelector
- extract-user-memory function (with deduplication, rate limiting)
- Memory injection into LLM prompts (with retrieval limits)
- Read-only memory view in settings

### Phase 1.5: Quick Wins (Fast follow)
- Inline "Used memories" chips in assistant messages
- Undo toast when memory is saved
- Per-conversation toggle: "Remember in this chat" (default based on profile selection)
- **Export memory archive** (JSON/CSV) - fulfill self-discovery ownership promise early

### Phase 2: Hierarchical Summaries (Week 3-4)
- Weekly summaries table and function
- Monthly summaries table and function (updated to use weekly summaries)
- Cron jobs setup (timezone-aware for both weekly and monthly)
- Change `SUMMARY_INTERVAL` from 12 to 4 in llm-handler-gemini
- Weekly and monthly summary UI in settings

### Phase 3: User Controls (Week 5)
- Delete/pause/export functionality (JSON/CSV export)
- Memory search/filter (keyword/FTS search - can upgrade to semantic later)
- Settings UI polish
- Per-type filters (show only goals, patterns, etc.)
- Delete All with confirmation
- Export includes all fields for portability

### Phase 4: Year-Over-Year (Week 6)
- Comparison function
- UI for viewing comparisons
- Pattern highlighting

## Testing & Observability

### Unit/Integration Tests (Critical Areas)
- **Edge function tests**:
  - `extract-user-memory`: Test `is_primary` guardrails, deduplication, rate limiting
  - `llm-handler-*`: Test memory injection logic, context size limits, selection algorithm
  - `generate-monthly-summaries`: Test timezone handling, backfill logic
- **Database tests**:
  - RLS policy enforcement (users can't access others' memories)
  - Unique primary profile constraint
  - Memory retention limits

### Observability & Monitoring
- **Instrument edge functions**:
  - Log memory generation volume (per user, per day)
  - Track errors (extraction failures, LLM errors)
  - Monitor latency (extraction time, injection overhead)
  - Memory usage metrics (counts, storage size)
- **Supabase logs**: Configure alerts for high error rates
- **External telemetry** (optional): Track memory effectiveness metrics
- **Dashboards**: 
  - Memory creation rate over time
  - Top memory types
  - User engagement with memory features
  - Error rates and latency percentiles

## Files to Create/Modify

**New Files**:
- `supabase/migrations/YYYYMMDD_add_profile_id_to_conversations.sql`
- `supabase/migrations/YYYYMMDD_create_memory_type_enum.sql`
- `supabase/migrations/YYYYMMDD_create_user_memory_tables.sql`
- `supabase/migrations/YYYYMMDD_create_weekly_summaries_table.sql`
- `supabase/migrations/YYYYMMDD_add_memory_rls_policies.sql`
- `supabase/functions/extract-user-memory/index.ts`
- `supabase/functions/generate-weekly-summaries/index.ts` (weekly cron job)
- `supabase/functions/generate-monthly-summaries/index.ts` (with backfill action, uses weekly summaries)
- `supabase/functions/compare-yearly-patterns/index.ts`
- `src/components/settings/panels/MemoryPanel.tsx`
- `src/hooks/useUserMemory.ts`
- `supabase/functions/archive-old-memories/index.ts` (background task for retention)
- `tests/edge-functions/extract-user-memory.test.ts`
- `tests/edge-functions/memory-injection.test.ts`

**Modified Files**:
- `supabase/functions/chat-send/index.ts` - Trigger memory extraction
- `supabase/functions/llm-handler-chatgpt/index.ts` - Inject memory context, return memory IDs used
- `supabase/functions/llm-handler-gemini/index.ts` - Inject memory context, return memory IDs used, **change SUMMARY_INTERVAL from 12 to 4**
- `supabase/functions/conversation-manager/index.ts` - Add update_conversation_profile action
- `src/components/settings/SettingsModal.tsx` - Add Memory tab
- `src/integrations/supabase/types.ts` - Type updates (memory_type enum, new columns, weekly summaries)
- `src/components/shared/forms/ProfileSelector.tsx` - Add callback to update conversation profile_id when primary profile selected
- `src/components/chat/AstroDataForm.tsx` - Integrate profile selection with conversation update
- Message display components - Add inline memory chips showing used memories

## Notes & Architecture Decisions

### What We're NOT Adding (Over-Engineering for v1)
- Embedding-based deduplication (start with text similarity, can upgrade later)
- Vector embeddings column (can add later if needed)
- Relationship memory table (together mode tracks each user separately - no need)
- Complex scoring formulas (start simple, optimize later)
- Semantic search (start with keyword/FTS search, upgrade later)

### Architecture Notes
- ProfileSelector already exists - no new UI component needed
- Together mode uses `conversations_participants` - each user's memory tracked separately
- Swiss mode: Default no memory unless user explicitly toggles on
- Each participant in shared conversations has their own memory (isolated by RLS)

## Edge Cases & Policies

- **Multiple primary profiles**: DB constraint prevents this (`UNIQUE (user_id) WHERE is_primary = true`)
- **Swiss quick snapshots**: Default no memory unless user explicitly toggles on in header
- **Shared/together mode**: Each participant tracks their own memory separately via `user_id`; RLS ensures isolation
- **Primary profile switching**: Existing memories remain with original profile_id; new memories use new primary
- **Import/export**: JSON (all fields), CSV (flattened); include simple re-import path for portability
- **Deleted memories**: Use `deleted_at` for GDPR compliance, `is_active` for fast filtering
- **Retention**: Archive memories >2 years old if not referenced in 6 months (unless user opts in to long-term storage)
- **Memory limits**: 1000 active memories per user per profile; oldest archived when limit reached
- **Cron job failures**: Manual backfill endpoint available to regenerate missed months

