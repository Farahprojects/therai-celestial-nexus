-- ============================================================================
-- Extend profiles table for creator-style public profiles
-- ============================================================================
-- Adds optional fields for display name, website URL, and structured links
-- This keeps existing data intact and is safe to run multiple times

-- Add display_name for human-readable name (optional)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add website_url for primary external link (optional)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add links JSONB for future multi-link support (e.g. [{ label, url }])
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS links JSONB;


