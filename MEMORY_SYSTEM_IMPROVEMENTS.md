# Memory System Improvements - Advice Review

## Valuable Additions to Plan

### 1. Database Schema Enhancements

**Add memory_type ENUM:**
```sql
CREATE TYPE memory_type AS ENUM ('fact', 'emotion', 'goal', 'pattern', 'relationship');
```

**Enhanced user_memory table columns:**
- `source_message_id UUID` - Trace which message created the memory
- `turn_index INTEGER` - Track conversation turn
- `origin_mode TEXT` - Track where memory came from (chat|astro|profile|together|swiss)
- `deleted_at TIMESTAMPTZ` - For GDPR compliance (soft delete)
- `confidence_score NUMERIC(4,3)` - More precision, add CHECK constraint (0-1)
- Use `SMALLINT` for `reference_count` and year/month to save space

**Better indexes:**
- Composite index: `(user_id, profile_id, is_active, last_referenced_at DESC) WHERE is_active = true`
- FTS index: `USING gin (to_tsvector('english', memory_text))` for keyword search
- Index on `(reference_count DESC, last_referenced_at DESC)` for retrieval ranking

**Constraints:**
- Unique primary profile: `UNIQUE (user_id) WHERE is_primary = true` on user_profile_list

### 2. Security & Privacy

**RLS Policies (Critical):**
- Enable RLS on all memory tables
- Policy: Users can only read/write their own memories
- In together/shared mode: Never expose other participants' memories
- Only owner can access their data

### 3. Memory Quality & Deduplication

**Simple deduplication (v1):**
- Check text similarity before insert (>0.85 similarity)
- If duplicate found, increment `reference_count` instead of creating new
- Can upgrade to embedding-based later if needed

**Guardrails:**
- Skip medical/financial claims or store with low confidence
- Rate limit: 60 extractions per user per minute

**LLM Output:**
- Strict JSON format with confidence scores
- Include few-shot examples of what NOT to save

### 4. Retrieval Optimization

**Memory injection limits:**
- Retrieve max 10-15 memories
- Prefer types: goal, pattern, relationship (heavier weight)
- Filter: `is_active=true AND profile_id=current_profile`
- Rank by: recency + confidence + reference_count
- Summarize into compact context block (<400-600 tokens)

**Track usage:**
- Store which memory IDs were used in response meta
- Return memory IDs for UI display

### 5. Monthly Summaries

**Timezone awareness:**
- Use Australia/Melbourne timezone for date boundaries
- Compute month windows server-side with tz-aware timestamps
- Backfill: Include partial months for new users

**Performance:**
- Persist LLM input hash to skip recompute if memories unchanged

### 6. UX Improvements

**Inline memory chips:**
- Show in assistant message footer: "Used: [M-143 goal], [M-097 pattern]"
- Hover → preview memory text
- Click → open Settings > Memory anchored to that item

**Transparency:**
- "This was saved" toast with Undo button (soft-delete)
- Plain language onboarding: "When you talk from your Main Profile, I can remember goals and patterns to personalize insights. You control and can erase this anytime."

**Per-conversation toggle:**
- "Remember in this chat" toggle in header
- Default based on profile selection

### 7. Settings & Controls

**Enhanced Settings UI:**
- Per-type filters (show only goals, patterns, etc.)
- Semantic + FTS keyword search
- Export: JSON/CSV with all fields for portability
- Delete All with confirmation
- Pause memory building

### 8. Metrics & Targets

**Adjusted targets:**
- Memory creation rate: 0.5-2.0 per 10 turns (not per conversation)
- Reference uplift: A/B test response helpfulness with/without memories
- Churn delta: Track retention for users with ≥N active memories
- Memory quality: Duplicate rate <10% via deduplication

### 9. Implementation Phases

**Add Phase 1.5 (Quick Wins):**
- Inline memory chips
- Undo toast
- Per-conversation toggle

**Phase 3 enhancements:**
- Semantic search (can start simple, upgrade later)
- Full export functionality

## What NOT to Add (Over-Engineering for v1)

- Embedding-based deduplication (start with text similarity)
- Vector embeddings column (can add later if needed)
- Relationship memory table (can add in Phase 5)
- Complex scoring formulas (start simple, optimize later)
- Semantic search (start with keyword search, upgrade later)

## Notes

- ProfileSelector already exists - no new UI component needed
- Together mode uses conversations_participants - each user's memory tracked separately
- Swiss mode: Default no memory unless user explicitly toggles on

