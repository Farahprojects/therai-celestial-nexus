// @ts-nocheck - Deno runtime
// List GitHub repositories for the currently authenticated user
// Uses the stored github_accounts access token and returns a lightweight repo list

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
} as Record<string, string>;

const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL")!,
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
};

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing required Supabase environment variables for github-list-repos",
  );
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      ENV.SUPABASE_URL,
      ENV.SUPABASE_SERVICE_ROLE_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[github-list-repos] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Get GitHub access token for this user
    const { data: githubAccount, error: accountError } = await supabase
      .from("github_accounts")
      .select("access_token_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (accountError || !githubAccount?.access_token_encrypted) {
      console.error("[github-list-repos] No GitHub account/token found:", accountError);
      return new Response(
        JSON.stringify({ error: "GitHub account not connected" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const accessToken = githubAccount.access_token_encrypted;

    // Fetch repositories from GitHub
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "base.therai",
      Authorization: `Bearer ${accessToken}`,
    };

    const url = "https://api.github.com/user/repos?per_page=100&sort=updated";
    console.log("[github-list-repos] Fetching repos from:", url);
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[github-list-repos] GitHub API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch repositories from GitHub" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const repos = await response.json();

    const mapped = (repos || []).map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login,
      htmlUrl: repo.html_url,
      description: repo.description,
      private: !!repo.private,
      language: repo.language,
      stargazersCount: repo.stargazers_count,
      updatedAt: repo.updated_at,
    }));

    return new Response(
      JSON.stringify({ repos: mapped }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[github-list-repos] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});



