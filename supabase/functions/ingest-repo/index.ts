/// <reference lib="deno.ns" />
// GitHub Repository Ingestion Edge Function
// Fetches GitHub repo metadata, README, file tree, runs AI analysis (Gemini only), and updates project

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
  GEMINI_API_KEY: Deno.env.get("GEMINI_API_KEY"),
  GEMINI_MODEL: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash",
};

const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  pushed_at: string;
  html_url: string;
  private: boolean;
}

interface GitHubFileTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

// Simple decryption helper (matches callback function)
function simpleDecrypt(encrypted: string, key: string): string {
  return encrypted; // TODO: Implement proper decryption with Supabase Vault
}

// Get GitHub access token (prefer user's token, fallback to app PAT)
async function getGitHubToken(userId: string): Promise<string | null> {
  try {
    const { data: githubAccount, error } = await supabase
      .from("github_accounts")
      .select("access_token_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && githubAccount?.access_token_encrypted) {
      return simpleDecrypt(githubAccount.access_token_encrypted, ENV.SUPABASE_SERVICE_ROLE_KEY);
    }
  } catch (error) {
    console.warn("[ingest-repo] Failed to get user token:", error);
  }

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

// Fetch GitHub repo data
async function fetchGitHubRepo(
  owner: string,
  repo: string,
  token: string | null
): Promise<GitHubRepo | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "therai-celestial-nexus",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Repository not found or private");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Repository access denied. Connect your GitHub account for private repos.");
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return await response.json();
}

// Fetch README content
async function fetchReadme(
  owner: string,
  repo: string,
  token: string | null
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "therai-celestial-nexus",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
    { headers }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    console.warn("[ingest-repo] Failed to fetch README:", response.status);
    return null;
  }

  const data = await response.json();
  if (data.content && data.encoding === "base64") {
    return atob(data.content.replace(/\s/g, ""));
  }

  return null;
}

// Fetch file tree (simplified structure)
async function fetchFileTree(
  owner: string,
  repo: string,
  token: string | null
): Promise<GitHubFileTreeItem[] | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "therai-celestial-nexus",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // First, get the default branch
  const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoResponse.ok) {
    return null;
  }
  const repoData = await repoResponse.json();
  const defaultBranch = repoData.default_branch || "main";

  // Get the tree
  const treeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers }
  );

  if (!treeResponse.ok) {
    console.warn("[ingest-repo] Failed to fetch file tree:", treeResponse.status);
    return null;
  }

  const treeData = await treeResponse.json();
  return treeData.tree || [];
}

// Simplify file tree to key structure
function simplifyFileTree(tree: GitHubFileTreeItem[]): Record<string, any> {
  const result: Record<string, any> = {};
  const keyPaths = [
    /^src\//,
    /^app\//,
    /^pages\//,
    /^components\//,
    /^lib\//,
    /^utils\//,
    /^functions\//,
    /^supabase\//,
    /^public\//,
    /package\.json$/,
    /tsconfig\.json$/,
    /vite\.config\./,
    /next\.config\./,
    /\.env\./,
    /README\./,
    /LICENSE/,
  ];

  const dirs = new Set<string>();
  const files: string[] = [];

  for (const item of tree) {
    if (item.type === "tree") {
      dirs.add(item.path);
    } else if (item.type === "blob") {
      const isKey = keyPaths.some((pattern) => pattern.test(item.path));
      if (isKey) {
        files.push(item.path);
      }
    }
  }

  const topDirs = Array.from(dirs).filter((dir) => !dir.includes("/"));
  const topFiles = files.filter((file) => !file.includes("/"));

  return {
    directories: topDirs.slice(0, 20),
    keyFiles: files.slice(0, 50),
    totalFiles: tree.filter((i) => i.type === "blob").length,
    totalDirs: Array.from(dirs).length,
  };
}

// Analyze repo with Gemini AI only
async function analyzeRepo(
  repoData: GitHubRepo,
  readme: string | null,
  fileTree: Record<string, any>
): Promise<{
  summary: string;
  tech_stack: string[];
  categories: string[];
  health_score: number;
}> {
  if (!ENV.GEMINI_API_KEY) {
    console.warn("[ingest-repo] No Gemini API key, using fallback analysis");
    return generateFallbackAnalysis(repoData, readme, fileTree);
  }

  const readmePreview = readme
    ? readme.slice(0, 2000) + (readme.length > 2000 ? "..." : "")
    : "No README available";

  const fileTreeStr = JSON.stringify(fileTree, null, 2);

  const prompt = `Analyze this GitHub repository and provide a structured JSON response:

Repository: ${repoData.full_name}
Description: ${repoData.description || "No description"}
Language: ${repoData.language || "Unknown"}
Stars: ${repoData.stargazers_count}

README Preview:
${readmePreview}

File Structure:
${fileTreeStr}

Please analyze this repository and return a JSON object with exactly these fields:
1. "summary": A 2-sentence hook describing what this project actually does (be specific and engaging)
2. "tech_stack": An array of detected frameworks, libraries, and services (e.g., ["Next.js", "Supabase", "Tailwind CSS", "TypeScript"])
3. "categories": An array of category tags (choose from: "Edge Function", "Boilerplate", "Schema", "Prompt", "Full Stack", "API", "CLI", "Library", "Tool", "Example")
4. "health_score": A number from 0-100 representing overall repository health based on:
   - Documentation quality (README, comments, examples)
   - Project structure and organization
   - Best practices and maintainability

Return ONLY valid JSON, no markdown, no explanation. Example format:
{"summary": "This project does X and Y.", "tech_stack": ["React", "Node.js"], "categories": ["Full Stack"], "health_score": 85}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ENV.GEMINI_MODEL}:generateContent?key=${ENV.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ingest-repo] Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error("[ingest-repo] Failed to parse Gemini JSON:", parseError);
        throw new Error("Invalid JSON response from Gemini");
      }
    }

    throw new Error("No response text from Gemini");
  } catch (error: any) {
    console.error("[ingest-repo] Gemini analysis failed:", error);
    return generateFallbackAnalysis(repoData, readme, fileTree);
  }
}

// Fallback analysis when Gemini is unavailable
function generateFallbackAnalysis(
  repoData: GitHubRepo,
  readme: string | null,
  fileTree: Record<string, any>
): {
  summary: string;
  tech_stack: string[];
  categories: string[];
  health_score: number;
} {
  const techStack: string[] = [];
  if (repoData.language) techStack.push(repoData.language);

  if (fileTree.keyFiles) {
    for (const file of fileTree.keyFiles as string[]) {
      if (file.includes("package.json")) techStack.push("Node.js");
      if (file.includes("next.config")) techStack.push("Next.js");
      if (file.includes("vite.config")) techStack.push("Vite");
      if (file.includes("tailwind.config")) techStack.push("Tailwind CSS");
      if (file.includes("supabase")) techStack.push("Supabase");
      if (file.includes(".tsx") || file.includes(".ts")) techStack.push("TypeScript");
    }
  }

  return {
    summary: repoData.description || `${repoData.name} - A ${repoData.language || "software"} project`,
    tech_stack: [...new Set(techStack)],
    categories: ["Tool"],
    health_score: readme ? 60 : 40,
  };
}

Deno.serve(async (req: Request) => {
  console.log("[ingest-repo] Request received:", req.method, req.url);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { projectId, githubUrl } = body;

    if (!projectId || !githubUrl) {
      return new Response(
        JSON.stringify({ error: "Missing projectId or githubUrl" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id, github_url")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found", details: projectError?.message }),
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (project.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: project does not belong to user" }),
        { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Parse GitHub URL
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Invalid GitHub URL format" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Update project status to pending
    await supabase
      .from("projects")
      .update({
        github_url: githubUrl,
        processing_status: "pending",
        processing_error: null,
      })
      .eq("id", projectId);

    // Get GitHub token
    const githubToken = await getGitHubToken(user.id);

    try {
      // Fetch GitHub data
      const repoData = await fetchGitHubRepo(parsed.owner, parsed.repo, githubToken);
      if (!repoData) {
        throw new Error("Failed to fetch repository data");
      }

      if (repoData.private && !githubToken) {
        throw new Error("Private repository requires GitHub account connection");
      }

      const [readme, fileTreeRaw] = await Promise.all([
        fetchReadme(parsed.owner, parsed.repo, githubToken),
        fetchFileTree(parsed.owner, parsed.repo, githubToken),
      ]);

      const fileTree = fileTreeRaw ? simplifyFileTree(fileTreeRaw) : null;

      // Run AI analysis (Gemini only)
      const analysis = await analyzeRepo(repoData, readme || "", fileTree || {});

      // Update project with all data
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          repo_name: repoData.name,
          description_generated: analysis.summary,
          readme_content: readme || null,
          stars_count: repoData.stargazers_count,
          language: repoData.language || null,
          tech_stack: analysis.tech_stack,
          completeness_score: analysis.health_score,
          last_pushed_at: repoData.pushed_at,
          file_tree: fileTree,
          processing_status: "completed",
          processing_error: null,
        })
        .eq("id", projectId);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ success: true, status: "completed" }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      // Update project with error status
      await supabase
        .from("projects")
        .update({
          processing_status: "failed",
          processing_error: error.message || "Unknown error",
        })
        .eq("id", projectId);

      return new Response(
        JSON.stringify({ error: error.message || "Failed to ingest repository" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[ingest-repo] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

