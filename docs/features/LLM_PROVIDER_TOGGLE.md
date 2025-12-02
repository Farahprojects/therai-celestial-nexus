# LLM Provider Toggle System

## Overview

This system allows you to easily switch between **Gemini** and **ChatGPT** LLM providers by simply flipping a boolean flag in the database. No code changes or redeployments required!

## How It Works

### Database Configuration

The `system_config` table stores the LLM provider preference:

```sql
SELECT * FROM system_config WHERE key = 'llm_provider';

-- Returns:
-- key: 'llm_provider'
-- value: {"use_gemini": true}  -- true = Gemini, false = ChatGPT
```

### Backend (Edge Functions)

All edge functions that call the LLM handler use the shared `llmConfig.ts` helper:
- `chat-send`
- `google-whisper` (STT)
- `openai-whisper` (STT)

The helper:
1. Fetches the config from `system_config` table
2. Caches it for 1 minute
3. Returns either `"llm-handler-gemini"` or `"llm-handler-chatgpt"`
4. Edge functions dynamically call the correct handler

### Frontend (Optional)

The frontend can also check the current LLM provider:

```typescript
import { getLLMProvider, getLLMProviderName } from '@/services/llmConfig';

// Get boolean
const useGemini = await getLLMProvider(); // true or false

// Get display name
const providerName = await getLLMProviderName(); // "Gemini" or "ChatGPT"
```

## How to Switch LLM Providers

### Method 1: SQL Editor (Recommended)

Run this in your Supabase SQL Editor:

**Switch to Gemini:**
```sql
UPDATE system_config 
SET value = '{"use_gemini": true}'::jsonb,
    updated_at = NOW()
WHERE key = 'llm_provider';
```

**Switch to ChatGPT:**
```sql
UPDATE system_config 
SET value = '{"use_gemini": false}'::jsonb,
    updated_at = NOW()
WHERE key = 'llm_provider';
```

**Check current setting:**
```sql
SELECT key, value, updated_at 
FROM system_config 
WHERE key = 'llm_provider';
```

### Method 2: Supabase Dashboard

1. Go to Table Editor
2. Open `system_config` table
3. Find row where `key = 'llm_provider'`
4. Edit the `value` column:
   - For Gemini: `{"use_gemini": true}`
   - For ChatGPT: `{"use_gemini": false}`
5. Save

### Method 3: API Call (Advanced)

```typescript
import { supabase } from '@/integrations/supabase/client';

// Switch to Gemini
await supabase
  .from('system_config')
  .update({ 
    value: { use_gemini: true },
    updated_at: new Date().toISOString()
  })
  .eq('key', 'llm_provider');

// Switch to ChatGPT
await supabase
  .from('system_config')
  .update({ 
    value: { use_gemini: false },
    updated_at: new Date().toISOString()
  })
  .eq('key', 'llm_provider');
```

## Caching Behavior

### Backend (Edge Functions)
- Cache TTL: **1 minute**
- After updating the config, it may take up to 1 minute for edge functions to pick up the change
- Each edge function instance has its own cache

### Frontend
- Cache TTL: **5 minutes**
- Auto-loads on app initialization
- To force immediate refresh: `clearLLMConfigCache()`

## Default Behavior

If the config fetch fails or the table doesn't exist:
- **Default: Gemini** (`use_gemini: true`)
- This ensures the system continues working even if there's a DB issue

## Testing the Switch

1. **Check current provider:**
   ```sql
   SELECT value FROM system_config WHERE key = 'llm_provider';
   ```

2. **Switch provider** (use Method 1 above)

3. **Wait 1 minute** for cache to expire

4. **Send a test message** in the app

5. **Check logs** in Supabase Functions:
   ```
   [chat-send] ⏱️  Firing llm-handler-gemini
   OR
   [chat-send] ⏱️  Firing llm-handler-chatgpt
   ```

## Benefits

✅ **No code changes** - flip a boolean in the database  
✅ **No deployments** - takes effect immediately (after cache TTL)  
✅ **Works everywhere** - chat, voice, all entry points  
✅ **Safe fallback** - defaults to Gemini if config unavailable  
✅ **Cached** - minimal performance impact  

## Use Cases

### Testing
Switch to ChatGPT to test a specific model behavior, then back to Gemini.

### Cost Management
If Gemini usage is high, temporarily switch to ChatGPT.

### Feature Comparison
A/B test different providers with real users.

### Debugging
Isolate issues to a specific provider.

### Gradual Migration
Roll out new LLM handlers without touching the codebase.

## Files Modified

### Created:
- `supabase/migrations/20251028120000_add_llm_provider_config.sql`
- `supabase/functions/_shared/llmConfig.ts`
- `src/services/llmConfig.ts`
- `LLM_PROVIDER_TOGGLE.md` (this file)

### Updated:
- `supabase/functions/chat-send/index.ts`
- `supabase/functions/google-whisper/index.ts`
- `supabase/functions/openai-whisper/index.ts`

## Migration

Already applied! The default setting is **Gemini** (`use_gemini: true`).

---

**Quick Reference:**

```sql
-- Switch to Gemini
UPDATE system_config SET value = '{"use_gemini": true}'::jsonb WHERE key = 'llm_provider';

-- Switch to ChatGPT
UPDATE system_config SET value = '{"use_gemini": false}'::jsonb WHERE key = 'llm_provider';

-- Check current
SELECT value FROM system_config WHERE key = 'llm_provider';
```

