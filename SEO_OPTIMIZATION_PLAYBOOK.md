# SEO Optimization Playbook

## Summary
- Resolved sitemap misconfiguration that served HTML instead of XML.
- Automated sitemap generation with Supabase-driven blog data and proper metadata.
- Established page-level SEO via a reusable `SEO` component, structured data, and Vercel header fixes.

Use this playbook for future audits, deployments, and Search Console operations.

## Core Fixes & Architecture

### 1. Base HTML & Shared SEO Stack
- Enhanced `index.html` with default meta tags, canonical URL, Open Graph, Twitter Card, and Organization/WebSite structured data.
- Added `src/components/SEO.tsx` using `react-helmet-async` with support for:
  - Dynamic title/description/keywords/canonical URL
  - Open Graph & Twitter tags (title, description, image, site name, type)
  - Structured data payloads (Blog, Article, Product)
- Wrapped app with `HelmetProvider` in `src/main.tsx`.

### 2. Page Coverage
- Implemented the SEO component on all primary screens:
  - `/` Home, `/about`, `/contact`, `/support`, `/legal`, `/pricing`, `/blog`, `/blog/:slug`
- Blog posts fetch metadata/structured data automatically (Article schema, canonical URLs).

### 3. Sitemap & robots.txt
- Script `scripts/generate-sitemap.js`:
  - Generates valid XML (namespace, escaping, `lastmod`, `priority`, `changefreq`).
  - Includes 7 static pages + dynamic blog posts from Supabase.
  - Runs on `prebuild` and `postbuild` npm scripts to keep `public/sitemap.xml` fresh.
- `public/robots.txt` points to `https://therai.co/sitemap.xml` and allows all bots.

### 4. Vercel Configuration
- Updated `vercel.json` to stop rewriting `/sitemap.xml` and `/robots.txt`.
- Set explicit `Content-Type` and caching headers for XML/plain text.
- Tightened security headers (CSP, X-Frame-Options, X-Content-Type-Options).

## Deployment Checklist
1. Review changes:
   ```bash
   git status
   git diff
   ```
   Expected files: `vercel.json`, `scripts/generate-sitemap.js`, `package.json`, `public/sitemap.xml`, `public/robots.txt`, SEO-enabled pages/components, this playbook.
2. Commit & push:
   ```bash
   git add .
   git commit -m "chore: consolidate SEO docs and keep sitemap automation"
   git push origin main
   ```
3. Await Vercel deploy (≈2–5 min).

## Verification After Deploy
```bash
# Sitemap headers & XML
curl -I https://therai.co/sitemap.xml
curl https://therai.co/sitemap.xml | head -20

# robots.txt
curl https://therai.co/robots.txt
```
Expected:
- Sitemap Content-Type: `application/xml; charset=utf-8`
- robots.txt Content-Type: `text/plain; charset=utf-8`
- XML begins with `<?xml version="1.0"...` and lists 9+ URLs.

Manual checks:
- View-source on `/`, `/about`, `/pricing`, `/blog`, `/blog/<slug>` for meta tags.
- Confirm structured data with Google Rich Results test.
- Validate social previews via OpenGraph.xyz or Twitter Card Validator.

## Google Search Console Workflow
1. Add property `https://therai.co` (DNS/HTML/meta verification).
2. Submit sitemap: `https://therai.co/sitemap.xml`.
3. Monitor:
   - Coverage report (expect 9+ discovered URLs).
   - Sitemap status (should show Success).
   - URL Inspection for key pages if indexing lags.

## Monitoring Cadence
- **Week 1:** Confirm sitemap accepted, check Coverage daily for errors.
- **Weeks 2–4:** Track indexing, organic impressions, and fix flagged issues.
- **Monthly:** Review top queries, adjust meta descriptions based on CTR, publish new blog posts.
- **Quarterly:** Audit titles/descriptions, check broken links, refresh evergreen content.

## Troubleshooting
| Symptom | Fix |
| --- | --- |
| Sitemap returns HTML/404 | Clear Vercel cache, ensure `vercel.json` deployed, rerun `npm run generate-sitemap`. |
| Search Console “Couldn't fetch” | Wait 24h, validate XML locally, resubmit. |
| Missing URLs | Ensure blog posts published, rerun build, redeploy. |
| Structured data errors | Validate JSON-LD payloads via Rich Results test, confirm required fields. |

## Growth Recommendations
- Continue publishing high-quality blog posts (target 20+ for authority).
- Use internal linking between related content.
- Add FAQ schema to support page, consider image/video sitemaps if media grows.
- Monitor performance metrics; aim for <800 ms LCP and responsive mobile layout (already optimized via Vite + responsive design).

## Success Criteria
| Milestone | Target |
| --- | --- |
| Immediate | Sitemap served with correct headers; Search Console “Success” status. |
| 1–4 weeks | Core pages indexed; blog posts discoverable; no Coverage errors. |
| 1–3 months | 50+ organic sessions/month; branded queries ranking. |
| 3–6 months | 200+ organic sessions/month; priority keywords on page 1; article snippets appearing. |

## Quick Commands
```bash
# Regenerate sitemap locally
npm run generate-sitemap

# Run full build (auto regenerates sitemap)
npm run build
```

This single reference replaces the previous `SEO_SETUP_SUMMARY.md`, `SEO_DEPLOYMENT_CHECKLIST.md`, and `SEO_PRODUCTION_READY.md`. Keep it updated as the SEO surface evolves.






