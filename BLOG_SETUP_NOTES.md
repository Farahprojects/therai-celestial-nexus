# Blog Setup Quick Reference
*Quick notes for setting up the enhanced blog*

## Running the Migration

```bash
# If using Supabase CLI
supabase db push

# Or run the SQL directly in Supabase SQL Editor
# Copy contents of: supabase/migrations/20250205000000_enhance_blog_posts.sql
```

## Regenerating TypeScript Types

After migration, regenerate your types:

```bash
# If using Supabase CLI
supabase gen types typescript --local > src/integrations/supabase/types.ts

# Or run locally if connected to remote
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

## Setting Content Type on Posts

When creating/editing posts in Supabase, set the `content_type` field:

**Valid values:**
- `blog` - General SEO articles (default)
- `tutorial` - Step-by-step app features
- `guide` - Comprehensive how-tos
- `case-study` - User stories/use cases
- `news` - Timely/seasonal content

**Example SQL:**
```sql
-- Update existing post to be a tutorial
UPDATE blog_posts 
SET content_type = 'tutorial' 
WHERE slug = 'your-post-slug';

-- Create new tutorial post
INSERT INTO blog_posts (
  title, 
  slug, 
  content, 
  author_name,
  published,
  content_type,
  featured
) VALUES (
  'Getting Started: Your First Natal Chart',
  'getting-started-first-natal-chart',
  '<p>Your content here...</p>',
  'Therai Team',
  true,
  'tutorial',
  true
);
```

## Testing the UI

1. Run `npm run dev`
2. Navigate to `/blog`
3. You should see:
   - Filter tabs at the top (All Content, Tutorials, Guides, Articles, News)
   - Count badges showing number of posts in each category
   - Content type badges on each blog card
   - Featured badge on any posts marked as featured

## Visual Reference

**Content Type Badge Colors:**
- Tutorial = Blue
- Guide = Purple  
- Article (blog) = Gray
- Story (case-study) = Green
- News = Orange

**Featured Badge:** Amber/Yellow

## What's Working Now

✅ Filter tabs with post counts
✅ Content type badges on cards
✅ Featured badge display
✅ Filtering by content type
✅ Empty state messages

## What's Coming Next

⏳ CTA sections on blog posts
⏳ Related posts sidebar
⏳ Read time estimates
⏳ Featured banner section

