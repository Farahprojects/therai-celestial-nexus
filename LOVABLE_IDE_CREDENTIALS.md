# Lovable IDE Credentials Configuration

## Overview

This project uses **hardcoded Supabase credentials** in specific files to work with Lovable IDE. This is intentional and safe.

## Why Hardcoded Credentials?

**Lovable IDE Requirement**: The Lovable IDE needs hardcoded credentials in the following files to function properly:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/config.ts`

## Security: Is This Safe?

**YES** - The anon key is **safe to expose** because:

1. **Designed for Frontend Use**: The anon key is specifically designed to be used in client-side code
2. **Protected by RLS**: Row Level Security (RLS) policies protect your data - the anon key cannot bypass them
3. **Limited Permissions**: The anon key only has permissions granted by your RLS policies
4. **Industry Standard**: This is how Supabase is designed to work - the anon key is meant to be public

## What Should NEVER Be Hardcoded

❌ **Service Role Key** - This bypasses RLS and should NEVER be in frontend code
❌ **API Keys** - OpenAI, Deepgram, etc. should use environment variables
❌ **Database Passwords** - Never hardcode database credentials

## Files with Hardcoded Credentials

### ✅ Safe to Have Hardcoded

1. **`src/integrations/supabase/client.ts`**
   - Contains: Supabase URL and anon key
   - Reason: Required for Lovable IDE
   - Security: Safe - anon key is protected by RLS

2. **`src/integrations/supabase/config.ts`**
   - Contains: Supabase URL and anon key (as fallbacks)
   - Reason: Required for Lovable IDE, uses env vars in production
   - Security: Safe - anon key is protected by RLS

### ❌ Should NOT Have Hardcoded Credentials

- Admin app (uses secure edge functions)
- Database migrations (uses environment variables)
- Scripts (requires environment variables)
- iOS app (uses local config file)

## Environment Variables

For production deployments, use environment variables:

```bash
# .env file (not committed to git)
VITE_SUPABASE_URL=https://api.therai.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

The code will use environment variables when available, falling back to hardcoded values for Lovable IDE compatibility.

## Setup Instructions

1. **For Local Development**:
   - Copy `.env.example` to `.env`
   - Fill in your actual credentials
   - The `.env` file is gitignored

2. **For Lovable IDE**:
   - No setup needed - hardcoded credentials in `client.ts` work automatically

3. **For Production (Vercel)**:
   - Set environment variables in Vercel dashboard
   - Code will use env vars instead of hardcoded values

## Git Configuration

- ✅ `.env` is in `.gitignore` (never committed)
- ✅ `.env.example` is tracked (template with placeholders)
- ✅ Hardcoded credentials in `client.ts` and `config.ts` are tracked (required for Lovable)

## Security Checklist

- ✅ Anon key is safe to expose (protected by RLS)
- ✅ Service role key is never in frontend code
- ✅ `.env` files are gitignored
- ✅ Sensitive API keys use environment variables
- ✅ Admin operations use secure edge functions
- ✅ Database functions use environment variables

## Questions?

**Q: Why not use environment variables everywhere?**  
A: Lovable IDE requires hardcoded credentials to function. The anon key is safe to expose.

**Q: Is the anon key really safe?**  
A: Yes - it's designed for frontend use and protected by RLS. It cannot bypass your security policies.

**Q: What if someone steals the anon key?**  
A: They still cannot access data protected by RLS. Your RLS policies are the security layer, not the key itself.

**Q: Should I rotate the anon key?**  
A: Only if you suspect it's been compromised. Since it's public-facing, rotation is less critical than service role keys.



