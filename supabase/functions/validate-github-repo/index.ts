/// <reference lib="deno.ns" />
// GitHub Repository Validation Edge Function
// Quick validation check to verify repo exists before starting full ingestion

import { SupabaseClient, createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as Record<string, string>;

const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL")!,
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  GITHUB_PAT: Deno.env.get("GITHUB_PAT"), // Fallback PAT for public repos
};

const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

// Simple decryption helper (matches other functions)
function simpleDecrypt(encrypted: string, key: string): string {
  return encrypted; // TODO: Implement proper decryption with Supabase Vault
}

// Get GitHub access token (prefer user's token, fallback to app PAT)
async function getGitHubToken(userId: string): Promise<string | null> {
  try {
    // Try to get user's GitHub account token
    const { data: githubAccount, error } = await supabase
      .from("github_accounts")
      .select("access_token_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && githubAccount?.access_token_encrypted) {
      return simpleDecrypt(githubAccount.access_token_encrypted, ENV.SUPABASE_SERVICE_ROLE_KEY);
    }
  } catch (error) {
    console.warn("[validate-github-repo] Failed to get user token:", error);
  }

  // Fallback to app-level PAT
  return ENV.GITHUB_PAT || null;
}

// Parse GitHub URL to extract owner and repo
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  console.log("[validate-github-repo] Request received:", req.method, req.url);
  
  // Handle CORS
  if (req.method === "OPTIONS") {
    console.log("[validate-github-repo] CORS preflight");
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    console.log("[validate-github-repo] Method not allowed:", req.method);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    console.log("[validate-github-repo] Auth header present:", !!authHeader);
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log("[validate-github-repo] Auth failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.log("[validate-github-repo] User authenticated:", user.id);

    // Parse request body
    const body = await req.json();
    const { githubUrl } = body;
    console.log("[validate-github-repo] GitHub URL:", githubUrl);

    if (!githubUrl) {
      return new Response(
        JSON.stringify({ error: "Missing githubUrl" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Parse GitHub URL
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
      console.log("[validate-github-repo] Invalid URL format");
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid GitHub URL format" }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.log("[validate-github-repo] Parsed:", parsed);

    // Get GitHub token
    const githubToken = await getGitHubToken(user.id);
    console.log("[validate-github-repo] GitHub token available:", !!githubToken);

    // Fetch repo metadata to validate it exists
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "therai-celestial-nexus",
    };

    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    // Add timeout to validation (5 seconds max)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      console.log("[validate-github-repo] Fetching repo from GitHub API...");
      const response = await fetch(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
        { headers, signal: controller.signal }
      );

      clearTimeout(timeoutId);

      console.log("[validate-github-repo] GitHub API response:", response.status);

      if (response.status === 404) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: `Repository "${parsed.owner}/${parsed.repo}" not found. Please check the URL and try again.`,
          }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 401 || response.status === 403) {
        const errorText = await response.text();
        console.log("[validate-github-repo] Access denied:", response.status);
        if (response.status === 403 || errorText.includes("private")) {
          if (!githubToken) {
            return new Response(
              JSON.stringify({
                valid: false,
                error: "This repository appears to be private. Please connect your GitHub account first.",
                isPrivate: true,
              }),
              { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({
              valid: false,
              error: "Access denied to this repository. It may be private or you don't have permission.",
            }),
            { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            valid: false,
            error: "Unable to access repository. Please check permissions.",
          }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log("[validate-github-repo] GitHub API error:", response.status, errorText.substring(0, 100));
        return new Response(
          JSON.stringify({
            valid: false,
            error: `GitHub API error (${response.status}). Please try again.`,
          }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const repoData = await response.json();
      console.log("[validate-github-repo] ✅ Repository valid:", repoData.name, repoData.private ? "(private)" : "(public)");

      return new Response(
        JSON.stringify({
          valid: true,
          isPrivate: repoData.private || false,
          repoName: repoData.name,
          description: repoData.description,
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        console.log("[validate-github-repo] ❌ Validation timeout");
        return new Response(
          JSON.stringify({
            valid: false,
            error: "Validation timed out. Please check your connection and try again.",
          }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error("[validate-github-repo] Error:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: error.message || "Failed to validate repository. Please try again.",
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

