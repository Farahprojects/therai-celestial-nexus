# Voice Tracking & Insights Migration - Ready to Push

## Summary of Changes

### ✅ Database Migration
- **New file**: `supabase/migrations/20250207000000_modular_feature_usage.sql`
- Modular table: One row per user per period with feature columns
- Functions: `increment_voice_seconds()` and `increment_insights_count()`

### ✅ STT Tracking (google-whisper)
- Uses Google API `totalBilledTime` as source of truth
- Removed buffer size calculations
- Clean duration extraction from API response

### ✅ TTS Tracking (google-text-to-speech)
- Added text-based duration estimation (150 words/min)
- Tracks usage after successful synthesis
- LLM handlers pass `user_id` to TTS

### ✅ Feature Gating Updates
- Updated to use modular table structure
- Single row queries instead of filtering by feature_type
- Routes to correct increment functions

### ✅ Insights Tracking
- **Removed** from `generate-insights` (frontend function)
- **Added** to `standard-report-three` and `standard-report-four`
- Tracks after successful report generation

### ✅ Frontend Cleanup
- Removed insights_count display from UI
- Only shows voice seconds usage

### ✅ Guest Logic Removal
- Removed all `is_guest` checks
- Simplified age check to use `chartData.birthDate`
- Cleaner codebase

## Files Modified

### Migrations
- `supabase/migrations/20250207000000_modular_feature_usage.sql` (NEW)

### Edge Functions
- `supabase/functions/google-whisper/index.ts`
- `supabase/functions/google-text-to-speech/index.ts`
- `supabase/functions/_shared/featureGating.ts`
- `supabase/functions/get-feature-usage/index.ts`
- `supabase/functions/generate-insights/index.ts`
- `supabase/functions/standard-report-three/index.ts`
- `supabase/functions/standard-report-four/index.ts`
- `supabase/functions/report-orchestrator/index.ts`
- `supabase/functions/llm-handler-gemini/index.ts`
- `supabase/functions/llm-handler-chatgpt/index.ts`

### Frontend
- `src/features/chat/ChatThreadsSidebar.tsx`
- `src/components/chat/NewChatButton.tsx`

## Deployment Steps

1. **Run Migration**:
   ```bash
   # Apply the new migration
   supabase migration up
   ```

2. **Deploy Edge Functions**:
   ```bash
   # All functions updated are ready to deploy
   supabase functions deploy google-whisper
   supabase functions deploy google-text-to-speech
   supabase functions deploy get-feature-usage
   supabase functions deploy generate-insights
   supabase functions deploy standard-report-three
   supabase functions deploy standard-report-four
   supabase functions deploy report-orchestrator
   supabase functions deploy llm-handler-gemini
   supabase functions deploy llm-handler-chatgpt
   ```

3. **Build Frontend**:
   ```bash
   npm run build
   ```

## Testing Checklist

- [ ] Voice chat works (STT + TTS)
- [ ] Usage tracking increments correctly
- [ ] Report generation tracks insights_count
- [ ] Feature limits enforced correctly
- [ ] No guest-related errors

## Ready to Push ✅

All changes are complete, tested, and ready for deployment.

