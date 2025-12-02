# Voice Tracking Simplification Summary

## Dedicated Voice Usage Billing Cycles

### What's New

#### 1. Standalone `voice_usage` Table
**Migration**: `supabase/migrations/20251111000000_create_voice_usage.sql`

- **Purpose**: Track per-user seconds with an explicit billing window instead of re-using `feature_usage`.
- **Schema Highlights**:
  ```sql
  CREATE TABLE voice_usage (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    seconds_used INTEGER NOT NULL DEFAULT 0,
    billing_cycle_start DATE NOT NULL,
    billing_cycle_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **Indexes & RLS**:
  - `idx_voice_usage_cycle_end` to query expiring cycles quickly.
  - Select policy ties rows to `auth.uid()`.
  - Service-role policy unlocks full management for backend jobs.

#### 2. Billing Cycle Helper
- `get_current_billing_cycle(p_user_id UUID)` derives the inclusive start and exclusive end for the active cycle.
- Pulls from `profiles.subscription_start_date` with a fallback to `profiles.created_at`.
- Handles uneven month lengths (e.g., February) by clamping the billing day.

#### 3. Automatic Increment + Reset
- `increment_voice_usage(p_user_id UUID, p_seconds INTEGER)` upsserts the current cycle row.
- Resets `seconds_used` when a new cycle starts, no manual cron required.
- Always refreshes `billing_cycle_start`, `billing_cycle_end`, and `updated_at`.

#### 4. Unified Limit Check
- `check_voice_limit(p_user_id UUID, p_requested_seconds INTEGER DEFAULT 0)` returns a JSON payload:
  - `allowed`, `remaining`, `seconds_used`, `limit`, `is_unlimited`, and optional failure `reason`.
- Pulls plan metadata from `plan_limits`, treats `NULL` as unlimited, and merges pending request seconds before approving.

### STT / TTS Integration Notes

#### Google Speech-to-Text (`supabase/functions/google-whisper/index.ts`)
- Still treats Google's `totalBilledTime` as the source of truth.
- After transcription succeeds:
  - Calls `check_voice_limit` to confirm the new chunk still fits within the cycle.
  - Calls `increment_voice_usage` with the billed seconds.
- Logging retains the same structure; only the RPC names changed.

#### Google Text-to-Speech (`supabase/functions/google-text-to-speech/index.ts`)
- Continues to estimate seconds from text length (150 words/minute baseline).
- For each synthesized request:
  - Runs `check_voice_limit` before queueing synth.
  - On success, records usage with `increment_voice_usage`.

### Shared Feature Gating (`supabase/functions/_shared/featureGating.ts`)
- `getVoiceUsage()` now queries `check_voice_limit` instead of selecting from `feature_usage`.
- `trackVoiceUsage()` invokes the two new RPCs (check + increment) and leaves insights usage untouched.
- Follows the same fail-fast pattern—rejects requests immediately when `allowed` is `false`.

### Get Usage Endpoint (`supabase/functions/get-feature-usage/index.ts`)
- Combines results from:
  - `voice_usage` + `check_voice_limit` for voice minutes.
  - Existing modular usage for insights and other metrics (unchanged).
- Response payload matches prior shape, so the dashboard UI required zero changes.

### Summary of Improvements

1. **Billing Awareness**: Every row records exact cycle boundaries for audits and resets.
2. **Fail-Fast Limits**: `check_voice_limit` gates work before expensive compute.
3. **Single Source of Truth**: Voice no longer depends on `feature_usage.period`.
4. **Automatic Resets**: Increment function handles rollovers without nightly jobs.
5. **Service Role Friendly**: Dedicated policy for backend management scripts.

### Next Steps

1. Confirm the migration is captured (`supabase/migrations/20251111000000_create_voice_usage.sql`).
2. Ensure any local scripts use the new RPC names (`increment_voice_usage`, `check_voice_limit`).
3. Monitor the first billing cycle rollovers to validate the reset path.

### Verification Commands

```sql
-- Quick sanity checks
SELECT * FROM voice_usage WHERE user_id = 'USER_ID_HERE';

SELECT * FROM get_current_billing_cycle('USER_ID_HERE');

SELECT check_voice_limit('USER_ID_HERE', 30);

SELECT increment_voice_usage('USER_ID_HERE', 15);
```

Everything else (STT duration parsing, TTS estimation, UI hooks) continues to operate exactly as before—only the persistence layer changed.






