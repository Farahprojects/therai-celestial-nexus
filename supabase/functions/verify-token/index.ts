// @ts-nocheck - Deno runtime, types checked at deployment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno&deno-std=0.224.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const respond = (body: any, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return respond({ 
        success: false, 
        error: 'Missing required parameter: token' 
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[verify-token] Verifying token: ${token}`);

    // Look up email from token_hash mapping (stored when link was generated)
    console.log(`[verify-token] Looking up email for token_hash...`);
    const { data: mappingData, error: mappingError } = await supabase
      .from('password_reset_tokens')
      .select('email, expires_at, token_hash')
      .eq('token_hash', token)
      .single();

    if (mappingError || !mappingData) {
      console.error(`[verify-token] Token not found in mapping:`, mappingError);
      console.error(`[verify-token] Token received: ${token}`);
      
      // Check if token exists but doesn't match exactly (for debugging)
      const { data: allTokens } = await supabase
        .from('password_reset_tokens')
        .select('token_hash, email, expires_at')
        .limit(5);
      console.error(`[verify-token] Sample tokens in DB:`, allTokens?.map(t => ({
        token_hash: t.token_hash?.substring(0, 10) + '...',
        email: t.email
      })));
      
      return respond({ 
        success: false, 
        error: 'Invalid or expired token' 
      }, 400);
    }

    // Check if token has expired
    if (new Date() > new Date(mappingData.expires_at)) {
      console.error(`[verify-token] Token has expired`);
      return respond({ 
        success: false, 
        error: 'Token has expired' 
      }, 400);
    }

    const email = mappingData.email;
    console.log(`[verify-token] Found email for token: ${email}`);

    // Just return success - we'll verify the OTP later when user submits the form
    console.log(`[verify-token] ✓ Token lookup successful, ready for password form`);

    return respond({
      success: true,
      message: 'Token verified successfully',
      email: email
    });

  } catch (error) {
    console.error('[verify-token] Unexpected error:', error);
    return respond({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});