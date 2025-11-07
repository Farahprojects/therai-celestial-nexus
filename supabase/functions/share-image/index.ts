import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_BASE_URL = Deno.env.get("SUPABASE_URL") || "https://api.therai.co";

const htmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const rawPath = url.searchParams.get("path");
    const directUrl = url.searchParams.get("url");

    if (!rawPath && !directUrl) {
      return new Response("Missing required parameter `path` or `url`", {
        status: 400,
      });
    }

    const normalizedPath = rawPath?.replace(/^\/+/, "");
    const imageUrl = directUrl || `${SUPABASE_BASE_URL}/storage/v1/object/public/generated-images/${normalizedPath}`;

    const escapedImageUrl = htmlEscape(imageUrl);
    const shareUrl = directUrl
      ? imageUrl
      : `${SUPABASE_BASE_URL}/functions/v1/share-image?path=${encodeURIComponent(normalizedPath || "")}`;

    const title = "Created with Therai";
    const description = "Psychological insights that create momentum.";

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
    <meta name="description" content="${htmlEscape(description)}" />
    <link rel="canonical" href="${htmlEscape(shareUrl)}" />

    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${htmlEscape(title)}" />
    <meta property="og:description" content="${htmlEscape(description)}" />
    <meta property="og:image" content="${escapedImageUrl}" />
    <meta property="og:url" content="${htmlEscape(shareUrl)}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${htmlEscape(title)}" />
    <meta name="twitter:description" content="${htmlEscape(description)}" />
    <meta name="twitter:image" content="${escapedImageUrl}" />
    <meta name="twitter:site" content="@therai_co" />

    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0f0f10;
        color: #f7f7f7;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      }
      main {
        max-width: 640px;
        width: 100%;
        text-align: center;
      }
      img {
        width: 100%;
        height: auto;
        border-radius: 24px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
      }
      a {
        display: inline-block;
        margin-top: 24px;
        padding: 14px 28px;
        border-radius: 999px;
        background: #ffffff;
        color: #111827;
        text-decoration: none;
        font-weight: 500;
      }
    </style>

    <script>
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.location.replace("${escapedImageUrl}");
        }, 1500);
      }
    </script>
  </head>
  <body>
    <main>
      <img src="${escapedImageUrl}" alt="Created with Therai" loading="lazy" />
      <a href="https://therai.co" target="_blank" rel="noopener">Created with therai.co</a>
    </main>
  </body>
</html>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("[share-image] unexpected error", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

