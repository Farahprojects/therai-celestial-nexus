# Security Configuration

## Lovable IDE Requirements

**IMPORTANT**: This project uses **hardcoded Supabase credentials** in specific files for Lovable IDE compatibility. This is intentional and safe.

See [`LOVABLE_IDE_CREDENTIALS.md`](./LOVABLE_IDE_CREDENTIALS.md) for detailed explanation.

### Files with Hardcoded Credentials (Safe)

- ✅ `src/integrations/supabase/client.ts` - Anon key (safe to expose, protected by RLS)
- ✅ `src/integrations/supabase/config.ts` - Anon key fallback (safe to expose, protected by RLS)

**Why?** Lovable IDE requires hardcoded credentials to function. The anon key is designed for frontend use and protected by Row Level Security (RLS).

## Environment Variables (Optional)

For production deployments, you can use environment variables. The code will use env vars when available, falling back to hardcoded values for Lovable IDE.

Create a `.env.local` file (not committed to git) with:

```bash
# Supabase Configuration (Optional - hardcoded values work for Lovable IDE)
VITE_SUPABASE_URL=https://api.therai.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# API Keys (Optional - for local development)
VITE_OPENAI_API_KEY=sk-your-openai-key-here
VITE_DEEPGRAM_API_KEY=your-deepgram-key-here
VITE_ELEVENLABS_API_KEY=your-elevenlabs-key-here

# Provider Configuration
VITE_STT_PROVIDER=local
VITE_LLM_PROVIDER=local
VITE_TTS_PROVIDER=local

# Feature Flags
VITE_ENABLE_VOICE_INPUT=true
VITE_ENABLE_TEXT_INPUT=true
```

**Note**: Copy `.env.example` to `.env.local` and fill in your values. The `.env` file is gitignored.

## Security Status

✅ **Hardcoded anon key in client.ts** - Safe (required for Lovable IDE, protected by RLS)
✅ **Hardcoded anon key in config.ts** - Safe (fallback for Lovable IDE, protected by RLS)
✅ **.env files are gitignored** - Never committed
✅ **Service role key** - Never in frontend code (uses secure edge functions)
✅ **Database functions** - Use environment variables (no hardcoded credentials)
✅ **Scripts** - Require environment variables (no hardcoded credentials)
✅ **iOS app** - Uses local config file (not in git)

## Security Best Practices

1. **Never commit real credentials to git**
2. **Use environment variables for all sensitive data**
3. **The anon key is safe to expose in frontend** (it's designed for public use)
4. **Service role keys should NEVER be in frontend code**
5. **Use RLS policies to secure data access**

## Next Steps

1. Set up your `.env.local` file with real credentials
2. Add RLS policies to secure database tables
3. Review and audit any remaining hardcoded values
