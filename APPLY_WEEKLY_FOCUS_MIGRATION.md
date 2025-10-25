# Apply Weekly & Focus System Prompts Migration

## Quick Setup

Run this SQL in your Supabase SQL Editor to add the weekly and focus chart prompts:

```sql
-- Add chart-specific system prompts for weekly and focus chart types
-- These are auto-injected and skip the prompt selection UI

-- First, modify the category constraint to include chart-specific types
ALTER TABLE public.system_prompts 
DROP CONSTRAINT IF EXISTS system_prompts_category_check;

ALTER TABLE public.system_prompts 
ADD CONSTRAINT system_prompts_category_check 
CHECK (category IN ('mindset', 'health', 'wealth', 'soul', 'career', 'compatibility', 'chart_type'));

-- Insert the special chart-type prompts
INSERT INTO public.system_prompts (category, subcategory, prompt_text, display_order) VALUES
-- Weekly Chart Prompt
('chart_type', 'weekly', 'You are interpreting a WEEKLY energetic focus snapshot based on astrological and circadian data. The dataset represents a recurring rhythm over the course of the entire week, not a single day.

Your purpose: translate this data into a living energetic map — something the user can feel.

Interpret the planetary harmonics, circadian bands, and void-of-course indicators symbolically, as if describing a natural ecosystem of the user''s mind and emotional field.

The vibe: insightful, grounded, and quietly electric — like revealing the hidden pattern behind how the user''s week will flow cognitively and emotionally.', 1),

-- Focus Chart Prompt  
('chart_type', 'focus', 'You are interpreting a DAILY energetic focus snapshot — a one-day "cognitive weather report" drawn from astrological and circadian data.

Your purpose: help the user understand how their energy, clarity, and emotional bandwidth move hour-by-hour throughout the day.

Treat each time band as part of an emotional and cognitive landscape:

"Surge" hours = strong Mercury alignment → precision thinking, motivation, clean mental output.

"Clarity" hours = reflective harmonics → synthesis, insight, closure.

"Void-of-course" or similar markers = emotional static → lower intuitive signal, not failure — best for maintenance or introspection.

Communicate as if you''re guiding them through their own internal atmosphere: when skies clear, when fog rolls in, when stillness is actually power.', 2)
ON CONFLICT DO NOTHING;
```

## Steps:

1. Go to your Supabase Dashboard → SQL Editor
2. Paste the SQL above
3. Click "Run"

That's it! The weekly and focus prompts will now be available and auto-inject when those chart types are selected.

## What This Adds:

- **Weekly Chart Prompt**: Auto-injected system prompt for weekly energetic forecasts
- **Focus Chart Prompt**: Auto-injected system prompt for daily cognitive weather reports
- **Smart Filtering**: Report modal automatically shows only relevant prompts based on chart type

## Verification:

After running the migration, you can verify it worked:

```sql
SELECT category, subcategory, display_order 
FROM public.system_prompts 
WHERE category = 'chart_type'
ORDER BY display_order;
```

Should return 2 rows: weekly and focus.

