// @ts-nocheck - Deno runtime, types checked at deployment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno&deno-std=0.224.0";
import { getSecureCorsHeaders } from "../_shared/secureCors.ts";

const respond = (body: any, status = 200, req: Request) => {
  const corsHeaders = getSecureCorsHeaders(req);
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    const corsHeaders = getSecureCorsHeaders(req);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token_hash, email, newPassword } = await req.json();

    if (!token_hash || !email || !newPassword) {
      return respond({
        success: false,
        error: 'Missing required parameters: token_hash, email, newPassword'
      }, 400, req);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[update-password] Updating password for email: ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);

    // Step 1: Verify the token with Supabase
    console.log(`[update-password] Verifying token with Supabase...`);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: token_hash,
      type: 'recovery'
    });

    if (error) {
      console.error(`[update-password] Token verification failed:`, error);
      return respond({
        success: false,
        error: 'Invalid or expired token'
      }, 400, req);
    }

    if (!data.user) {
      console.error(`[update-password] No user found after verification`);
      return respond({
        success: false,
        error: 'User not found'
      }, 404, req);
    }

    console.log(`[update-password] Token verified for user: ${data.user.id}`);

    // Step 2: Update the user's password
    console.log(`[update-password] Updating password...`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, {
      password: newPassword
    });

    if (updateError) {
      console.error(`[update-password] Password update failed:`, updateError);
      return respond({
        success: false,
        error: 'Failed to update password'
      }, 500, req);
    }

    // Step 3: Clean up the token mapping (optional)
    console.log(`[update-password] Cleaning up token mapping...`);
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('token_hash', token_hash);

    console.log(`[update-password] ✓ Password updated successfully`);

    return respond({
      success: true,
      message: 'Password updated successfully'
    }, 200, req);

  } catch (error) {
    console.error('[update-password] Unexpected error:', error);
    return respond({
      success: false,
      error: 'Internal server error'
    }, 500, req);
  }
});
