# Voice Tracking Simplification Summary

## Migration Complete: Google API as Source of Truth

### Changes Made

#### 1. New Modular Feature Usage Table
**Migration**: `supabase/migrations/20250207000000_modular_feature_usage.sql`

- **Old Design**: Multiple rows per user (one per feature type per period)
- **New Design**: Single row per user per period with feature columns
- **Benefits**:
  - Simple queries: `SELECT * FROM feature_usage WHERE user_id = X AND period = 'YYYY-MM'`
  - Intuitive: One row contains all usage for that period
  - Easy to extend: Add new feature columns
  - Atomic increments per feature

**Schema**:
```sql
CREATE TABLE feature_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  period TEXT NOT NULL, -- 'YYYY-MM'
  
  -- Feature columns
  voice_seconds INTEGER DEFAULT 0,
  insights_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period)
);
```

**Functions**:
- `increment_voice_seconds(user_id, seconds, period)` - Atomic voice usage increment
- `increment_insights_count(user_id, count, period)` - Atomic insights increment

#### 2. STT (Speech-to-Text) Tracking - Google API Duration
**File**: `supabase/functions/google-whisper/index.ts`

**Before**:
- Estimated duration from buffer size: `(buffer.length - 44) / 2 / 16000`
- Inaccurate for different formats/sample rates

**After**:
- Extracts duration from Google STT API response
- Uses `result.totalBilledTime` or `result.results[0].resultEndTime`
- **Source of truth**: Google's reported duration

**Code Change**:
```typescript
// Returns both transcript and duration from Google's response
async function transcribeWithGoogle(...): Promise<{ transcript: string; durationSeconds: number }> {
  const result = await resp.json();
  
  // Extract duration from Google's response (source of truth)
  let durationSeconds = 0;
  if (result.totalBilledTime) {
    const match = result.totalBilledTime.match(/(\d+(?:\.\d+)?)/);
    durationSeconds = match ? Math.ceil(parseFloat(match[1])) : 0;
  }
  
  return { transcript, durationSeconds };
}
```

**Tracking**:
```typescript
// Track using Google's reported duration
incrementFeatureUsage(supabase, authenticatedUserId, 'voice_seconds', durationSeconds)
```

#### 3. TTS (Text-to-Speech) Tracking - Text-Based Estimation
**File**: `supabase/functions/google-text-to-speech/index.ts`

**Added**:
- Simple duration estimation from text
- Average speech rate: ~150 words/min = 2.5 words/sec
- Formula: `wordCount / 2.5` (rounded up, minimum 1 second)

**Code**:
```typescript
function estimateTTSDuration(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  const durationSeconds = Math.ceil(wordCount / 2.5);
  return Math.max(1, durationSeconds);
}
```

**Tracking**:
```typescript
const estimatedDuration = estimateTTSDuration(text);

if (user_id && estimatedDuration > 0) {
  incrementFeatureUsage(supabase, user_id, 'voice_seconds', estimatedDuration);
  console.log(`[google-tts] Tracked ${estimatedDuration}s of TTS usage`);
}
```

#### 4. LLM Handler Updates
**Files**: 
- `supabase/functions/llm-handler-gemini/index.ts`
- `supabase/functions/llm-handler-chatgpt/index.ts`

**Change**: Pass `user_id` to TTS function for tracking
```typescript
body: JSON.stringify({ text: sanitizedTextForTTS, voice: selectedVoice, chat_id, user_id })
```

#### 5. Feature Gating Updates
**File**: `supabase/functions/_shared/featureGating.ts`

**Before**: Query filtered by `feature_type` (multiple rows)
```typescript
.select('usage_amount')
.eq('user_id', userId)
.eq('feature_type', featureType)
.eq('period', currentPeriod)
```

**After**: Query single row, extract specific column
```typescript
.select('voice_seconds, insights_count')
.eq('user_id', userId)
.eq('period', currentPeriod)
.maybeSingle()

const currentUsage = featureType === 'voice_seconds' 
  ? (usageData?.voice_seconds || 0)
  : (usageData?.insights_count || 0);
```

**Increment Function**: Routes to specific RPC based on feature type
```typescript
const rpcFunction = featureType === 'voice_seconds' 
  ? 'increment_voice_seconds'
  : 'increment_insights_count';

const rpcParams = featureType === 'voice_seconds'
  ? { p_user_id: userId, p_seconds: amount, p_period: currentPeriod }
  : { p_user_id: userId, p_count: amount, p_period: currentPeriod };

await supabase.rpc(rpcFunction, rpcParams);
```

#### 6. Get Feature Usage Endpoint
**File**: `supabase/functions/get-feature-usage/index.ts`

**Before**: Query multiple rows, filter by feature_type
```typescript
.select('feature_type, usage_amount')
.eq('user_id', user.id)
.eq('period', currentPeriod);

const voiceUsage = usageData?.find(u => u.feature_type === 'voice_seconds');
const insightsUsage = usageData?.find(u => u.feature_type === 'insights_count');
```

**After**: Query single row, extract columns
```typescript
.select('voice_seconds, insights_count')
.eq('user_id', user.id)
.eq('period', currentPeriod)
.maybeSingle();

const voiceUsed = usageData?.voice_seconds || 0;
const insightsUsed = usageData?.insights_count || 0;
```

### Summary of Improvements

1. **Simplified Queries**: One query returns all usage for a user/period
2. **Google API as Source of Truth**: 
   - STT: Uses `totalBilledTime` from Google's response
   - TTS: Simple text-based estimation (150 words/min)
3. **Intuitive Schema**: One row per user per period with clear columns
4. **Easy to Extend**: Add new feature columns without schema redesign
5. **Removed Complexity**: No more buffer size calculations or format-specific logic
6. **Atomic Operations**: Each feature has its own increment function

### Next Steps

1. Deploy the new migration: `supabase/migrations/20250207000000_modular_feature_usage.sql`
2. Delete the old table (or rename for backup)
3. Test voice chat to verify tracking works correctly
4. Monitor logs to ensure Google API returns duration correctly

### Verification Commands

```sql
-- Check usage for a user
SELECT * FROM feature_usage 
WHERE user_id = 'YOUR_USER_ID' 
AND period = '2025-02';

-- Test increment functions
SELECT increment_voice_seconds('user-id', 10, '2025-02');
SELECT increment_insights_count('user-id', 1, '2025-02');
```


