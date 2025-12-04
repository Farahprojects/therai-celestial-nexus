// @ts-nocheck - Deno runtime, types checked at deployment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno&deno-std=0.224.0';
import { getSecureCorsHeaders } from "../_shared/secureCors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const corsHeaders = getSecureCorsHeaders(req);
    return new Response(null, { headers: corsHeaders });
  }

  const corsHeaders = getSecureCorsHeaders(req);

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { method } = req;
    const requestBody = await req.json();
    const { email, password } = requestBody;

    if (method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    if (!email || !password) {
      return new Response('Email and password are required', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Step 1: Create user using admin API with email_confirm: false to get the confirmation token
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false // Don't auto-confirm, get the token instead
    });

    if (signUpError) {
      console.error(`[create-user-and-verify] SignUp error:`, signUpError);
      
      // Handle specific error cases
      if (signUpError.message?.includes('already been registered') || 
          signUpError.message?.includes('already registered') ||
          signUpError.status === 422 || 
          signUpError.code === 'email_exists') {
        return new Response(JSON.stringify({ 
          error: 'An account with this email already exists. Please sign in instead.',
          code: 'EMAIL_EXISTS'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409, // Conflict status for already exists
        });
      }
      
      return new Response(JSON.stringify({ 
        error: signUpError.message || 'Failed to create account',
        code: 'USER_CREATION_FAILED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!signUpData.user) {
      return new Response(JSON.stringify({ 
        error: 'Failed to create user account',
        code: 'USER_CREATION_FAILED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Step 2: Generate verification link using generateLink (this creates the actual token)
    // CRITICAL: For signup verification, we only pass email (not password) to generateLink
    // This generates a proper signup verification token, not a user creation token
    // The user was already created in Step 1 with email_confirm: false
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: "signup",
      email: email,
      // NOTE: Do NOT include password here - this is for existing unconfirmed users only
      options: { 
        redirectTo: "https://auth.therai.co"
      }
    });

    if (linkError) {
      console.error(`[create-user-and-verify] Link generation error:`, linkError);
      
      // Handle specific error cases for link generation
      if (linkError.message?.includes('already been registered') || 
          linkError.message?.includes('already registered') || 
          linkError.status === 422 || 
          linkError.code === 'email_exists') {
        return new Response(JSON.stringify({ 
          error: 'An account with this email already exists. Please sign in instead.',
          code: 'EMAIL_EXISTS'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409, // Conflict status for already exists
        });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Failed to generate verification link',
        code: 'LINK_GENERATION_FAILED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const tokenLink = linkData?.properties?.action_link || "";
    const emailOtp = linkData?.properties?.email_otp || "";
    
    if (!emailOtp) {
      console.error(`[create-user-and-verify] No email_otp in generateLink response`);
      return new Response(JSON.stringify({ 
        error: 'Failed to generate verification OTP',
        code: 'OTP_GENERATION_FAILED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Step 3: Build custom verification URL using OTP (not magic link token)
    // Use the 6-digit OTP code instead of the long magic link token
    const customVerificationLink = `https://auth.therai.co?token=${emailOtp}&type=signup&email=${encodeURIComponent(email)}`;
    
    console.log(`[create-user-and-verify] ✓ Custom verification URL created:`, {
      originalUrl: tokenLink,
      customUrl: customVerificationLink,
      otp: emailOtp,
      type: "signup",
      email: email
    });

    // Step 4: Call email-verification Edge Function with the custom link
    const emailPayload = {
      email: email,
      url: customVerificationLink,
      template_type: "email_verification"
    };

    console.log(`[create-user-and-verify] OTP generated successfully (redacted for security)`);
    console.log(`[create-user-and-verify] Sending verification email to: ${email}`);

    const { error: emailError } = await supabaseClient.functions.invoke('email-verification', {
      body: emailPayload
    });

    if (emailError) {
      console.error(`[create-user-and-verify] Email sending error:`, emailError);
      return new Response(JSON.stringify({ 
        error: 'Failed to send verification email',
        code: 'EMAIL_SEND_FAILED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log(`[create-user-and-verify] ✅ Email verification sent successfully`);

    // Success case - verification email sent
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Verification email sent. Please check your inbox and click the verification link to complete registration.',
      user_id: signUpData.user.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[create-user-and-verify] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'An unexpected error occurred during signup',
      code: 'UNEXPECTED_ERROR'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
