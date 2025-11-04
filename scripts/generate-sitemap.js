#!/usr/bin/env node

/**
 * Generate sitemap.xml for therai.co
 * Fetches published blog posts from Supabase and generates a sitemap
 * 
 * Usage: node scripts/generate-sitemap.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://api.therai.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydnFxdnF2d3FtZmRxdnFtYWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1ODA0NjIsImV4cCI6MjA2MTE1NjQ2Mn0.u9P-SY4kSo7e16I29TXXSOJou5tErfYuldrr_CITWX0';

const BASE_URL = 'https://therai.co';

// Static pages that should always be in the sitemap
const staticPages = [
  { url: '', priority: '1.0', changefreq: 'weekly' },
  { url: '/about', priority: '0.8', changefreq: 'monthly' },
  { url: '/contact', priority: '0.7', changefreq: 'monthly' },
  { url: '/support', priority: '0.7', changefreq: 'monthly' },
  { url: '/legal', priority: '0.5', changefreq: 'yearly' },
  { url: '/pricing', priority: '0.9', changefreq: 'weekly' },
  { url: '/blog', priority: '0.9', changefreq: 'weekly' },
];

async function generateSitemap() {
  console.log('Generating sitemap.xml...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Fetch published blog posts
  let blogPosts = [];
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug, created_at, updated_at')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blog posts:', error);
    } else {
      blogPosts = data || [];
      console.log(`Found ${blogPosts.length} published blog posts`);
    }
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
  }

  // Generate sitemap XML
  const currentDate = new Date().toISOString().split('T')[0];

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Add static pages
  for (const page of staticPages) {
    sitemap += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // Add blog posts
  for (const post of blogPosts) {
    const lastmod = (post.updated_at || post.created_at || currentDate).split('T')[0];
    sitemap += `  <url>
    <loc>${BASE_URL}/blog/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  sitemap += `</urlset>`;

  // Write to public directory
  const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');

  console.log(`✅ Sitemap generated successfully at ${sitemapPath}`);
  console.log(`   - ${staticPages.length} static pages`);
  console.log(`   - ${blogPosts.length} blog posts`);
  console.log(`   - Total: ${staticPages.length + blogPosts.length} URLs`);
}

generateSitemap().catch(console.error);
