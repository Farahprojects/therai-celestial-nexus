-- Enhance blog_posts table for hybrid content strategy
-- Adds support for SEO optimization, content categorization, and engagement tracking

-- Add content categorization
ALTER TABLE blog_posts 
  ADD COLUMN IF NOT EXISTS content_type text CHECK (content_type IN ('blog', 'tutorial', 'guide', 'case-study', 'news')) DEFAULT 'blog';

-- Add SEO metadata
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS meta_keywords text[],
  ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- Add cross-linking capability
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS related_posts uuid[];

-- Add CTAs (call-to-action)
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS cta_type text CHECK (cta_type IN ('signup', 'feature', 'pricing', 'none')) DEFAULT 'signup',
  ADD COLUMN IF NOT EXISTS cta_text text,
  ADD COLUMN IF NOT EXISTS cta_link text;

-- Track engagement metrics for optimization
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_read_time_minutes integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS conversion_count integer DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_content_type ON blog_posts(content_type) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(featured) WHERE published = true AND featured = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON blog_posts USING GIN(tags) WHERE published = true;

-- Add comment for documentation
COMMENT ON COLUMN blog_posts.content_type IS 'Categorizes content: blog (SEO), tutorial (app feature how-tos), guide (comprehensive), case-study (use cases), news (timely)';
COMMENT ON COLUMN blog_posts.cta_type IS 'Type of call-to-action: signup (main conversion), feature (try specific feature), pricing (subscribe), none';
COMMENT ON COLUMN blog_posts.view_count IS 'Track page views for engagement metrics';
COMMENT ON COLUMN blog_posts.conversion_count IS 'Track how many users signed up from this post';

