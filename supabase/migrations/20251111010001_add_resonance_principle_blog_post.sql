-- Seed initial blog post: The Resonance Principle (Living Paper v1.0)
-- This inserts the first section so you can continue editing in Supabase.

-- Ensure no duplicate by slug, then insert fresh row
DELETE FROM public.blog_posts WHERE slug = 'the-resonance-principle';

INSERT INTO public.blog_posts (
  title,
  slug,
  content,
  cover_image_url,
  author_name,
  tags,
  published
) VALUES (
  'The Resonance Principle: A Neuroceptive Framework for Archetypal Information Processing',
  'the-resonance-principle',
  $$# The Resonance Principle: A Neuroceptive Framework for Archetypal Information Processing

How Planetary Rhythms, Nervous System Safety, and Lived Experience Create the Pattern of Self

Living Paper v1.0 - A Working Framework for Scientific and Experiential Inquiry

## One-Line Thesis

Planetary rhythms generate archetypal information streams that the human nervous system processes through a neuroceptive gate of perceived safety: when open, this information expresses as coherent, authentic lived experience (the blueprint in flow); when closed, it accumulates as dissonant psycho-somatic charge, creating the blocks and patterns we recognize as psychological struggle.
$$,
  NULL,
  NULL,
  ARRAY['living-paper','theory','archetypes','neuroception','astrology'],
  TRUE
);


