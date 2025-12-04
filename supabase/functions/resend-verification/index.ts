// @ts-nocheck - Deno runtime, types checked at deployment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno&deno-std=0.224.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResendVerificationRequest {
  email: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResendVerificationRequest = await req.json();

    console.log('[resend-verification] Request for email:', email.replace(/(.{2})(.*)(@.*)/, '$1***$3'));

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find unconfirmed user by email using auth admin API
    const { data: users, error: listError } = await supabase.auth.admin.listUsers({
      email: email
    });

    if (listError || !users?.users?.length) {
      console.error('[resend-verification] Error fetching users or no users found:', listError);
      return new Response(
        JSON.stringify({ error: 'No account found with this email address' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = users.users.find(u => u.email === email && !u.email_confirmed_at);

    if (!user) {
      console.log('[resend-verification] User already verified for email:', email.replace(/(.{2})(.*)(@.*)/, '$1***$3'));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This email address is already verified',
          code: 'already_verified',
          message: 'Your email is already verified. Please try logging in.',
          shouldRedirectToLogin: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[resend-verification] Generating new verification link for existing unverified user:', email.replace(/(.{2})(.*)(@.*)/, '$1***$3'));

    // Generate email verification link for existing unverified user
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      options: {
        redirectTo: 'https://auth.therai.co'
      }
    });

    if (error) {
      console.error('[resend-verification] Error generating verification link:', error);

      // Handle specific error cases gracefully
      if (error.message?.includes('already been registered') || error.code === 'email_exists') {
        console.log('[resend-verification] User already registered, suggesting login instead');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'User already registered',
            code: 'email_exists',
            message: 'This email is already registered. Please try logging in instead.',
            shouldRedirectToLogin: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to generate verification link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.properties?.action_link) {
      console.error('[resend-verification] No action link in response:', data);
      return new Response(
        JSON.stringify({ error: 'Failed to generate verification link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenLink = data.properties.action_link;
    const emailOtp = data.properties.email_otp || "";

    console.log('[resend-verification] Generated verification link successfully');

    // Extract OTP from generateLink response (not magic link token)
    const emailOtp = linkData?.properties?.email_otp || "";

    if (!emailOtp) {
      console.error('[resend-verification] No email_otp in generateLink response');
      return new Response(JSON.stringify({
        error: 'Failed to generate verification OTP',
        code: 'OTP_GENERATION_FAILED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Build custom verification URL using OTP (not magic link token)
    const customVerificationLink = `https://auth.therai.co?token=${emailOtp}&type=signup&email=${encodeURIComponent(email)}`;

    console.log('[resend-verification] ✓ Custom verification URL created (redacted for security)');

    // Call email-verification Edge Function with the custom link (same as create-user-and-verify)
    const emailPayload = {
      email: email,
      url: customVerificationLink,
      template_type: "email_verification"
    };

    console.log('[resend-verification] Final payload prepared for email service');

    const { error: emailError } = await supabase.functions.invoke('email-verification', {
      body: emailPayload
    });

    if (emailError) {
      console.error('[resend-verification] Email sending error:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send verification email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[resend-verification] ✅ Email verification sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification email has been resent. Please check your inbox.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[resend-verification] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});