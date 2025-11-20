/// <reference lib="deno.ns" />
// GitHub OAuth Callback Handler for Supabase Edge Functions
// Handles OAuth flow, exchanges code for token, and stores GitHub account connection

import { SupabaseClient, createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
} as Record<string, string>;

const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL")!,
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  GITHUB_CLIENT_ID: Deno.env.get("GITHUB_CLIENT_ID")!,
  GITHUB_CLIENT_SECRET: Deno.env.get("GITHUB_CLIENT_SECRET")!,
  GITHUB_OAUTH_CALLBACK_URL: Deno.env.get("GITHUB_OAUTH_CALLBACK_URL") || 
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/github-oauth-callback`,
  FRONTEND_URL: Deno.env.get("FRONTEND_URL") || "http://localhost:5173",
};

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}
if (!ENV.GITHUB_CLIENT_ID || !ENV.GITHUB_CLIENT_SECRET) {
  console.warn("⚠️ Missing GitHub OAuth credentials. OAuth flow will not work.");
}

const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

// Simple encryption helper (in production, use Supabase Vault or KMS)
function simpleEncrypt(text: string, key: string): string {
  return text; // TODO: Implement proper encryption with Supabase Vault
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Helper function to create popup-compatible response
  const createPopupResponse = (success: boolean, message: string) => {
    const action = success ? 'github-oauth-success' : 'github-oauth-error';
    const redirectUrl = success 
      ? `${ENV.FRONTEND_URL}/#/settings?github=connected`
      : `${ENV.FRONTEND_URL}/#/settings?github=error&message=${encodeURIComponent(message)}`;
    
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>${success ? 'GitHub Connection Successful' : 'GitHub Connection Error'}</title>
</head>
<body>
  <script>
    if (window.opener) {
      // Popup window - send message to parent
      window.opener.postMessage({ 
        type: '${action}',
        ${success ? '' : `message: ${JSON.stringify(message)},`}
      }, '*');
      window.close();
    } else {
      // Regular window - redirect
      window.location.href = ${JSON.stringify(redirectUrl)};
    }
  </script>
  <p>${success ? 'GitHub connection successful! This window should close automatically.' : `Error: ${message}. This window should close automatically.`}</p>
</body>
</html>`,
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "text/html" },
      }
    );
  };

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("[github-oauth-callback] GitHub OAuth error:", error);
      return createPopupResponse(false, error);
    }

    if (!code) {
      return createPopupResponse(false, "Missing authorization code");
    }

    if (!state) {
      console.warn("[github-oauth-callback] ⚠️ No state parameter provided");
      return createPopupResponse(false, "Invalid state parameter");
    }

    // Extract user_id from state (format: "user_id:xxx")
    let userId: string | null = null;
    try {
      if (state.includes(":")) {
        const parts = state.split(":");
        if (parts.length === 2 && parts[0] === "user_id") {
          userId = parts[1];
        }
      }
    } catch (e) {
      console.warn("[github-oauth-callback] Failed to parse user_id from state:", e);
    }

    if (!userId) {
      return createPopupResponse(false, "Invalid state parameter");
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: ENV.GITHUB_CLIENT_ID,
        client_secret: ENV.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: ENV.GITHUB_OAUTH_CALLBACK_URL,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[github-oauth-callback] GitHub token exchange failed:", errorText);
      return createPopupResponse(false, "Failed to exchange token");
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("[github-oauth-callback] GitHub OAuth error:", tokenData.error_description || tokenData.error);
      return createPopupResponse(false, tokenData.error_description || tokenData.error);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return createPopupResponse(false, "No access token received");
    }

    // Fetch GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "therai-celestial-nexus",
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("[github-oauth-callback] GitHub user fetch failed:", errorText);
      return createPopupResponse(false, "Failed to fetch GitHub user");
    }

    const githubUser = await userResponse.json();

    // Verify user exists in profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("[github-oauth-callback] User not found:", profileError);
      return createPopupResponse(false, "User not found");
    }

    // Store/update GitHub account connection
    const encryptedToken = simpleEncrypt(accessToken, ENV.SUPABASE_SERVICE_ROLE_KEY);
    
    const { error: upsertError } = await supabase
      .from("github_accounts")
      .upsert({
        user_id: userId,
        github_user_id: githubUser.id,
        login: githubUser.login,
        avatar_url: githubUser.avatar_url || null,
        html_url: githubUser.html_url || null,
        access_token_encrypted: encryptedToken,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (upsertError) {
      console.error("[github-oauth-callback] Failed to store GitHub account:", upsertError);
      return createPopupResponse(false, "Failed to store GitHub connection");
    }

    // Success!
    return createPopupResponse(true, "GitHub account connected successfully");

  } catch (error) {
    console.error("[github-oauth-callback] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return createPopupResponse(false, errorMessage);
  }
});

