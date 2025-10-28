-- Create system_prompts table for Starter Conversation prompts
CREATE TABLE IF NOT EXISTS public.system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('mindset', 'health', 'wealth', 'soul', 'career', 'compatibility')),
  subcategory TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active prompts
CREATE POLICY "system_prompts_read_policy" 
  ON public.system_prompts 
  FOR SELECT 
  USING (is_active = true);

-- Policy: Only service role can insert/update/delete (admin via Supabase dashboard)
CREATE POLICY "system_prompts_admin_policy" 
  ON public.system_prompts 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Create index for faster queries
CREATE INDEX idx_system_prompts_category ON public.system_prompts(category, display_order);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_system_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_prompts_updated_at
BEFORE UPDATE ON public.system_prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_system_prompts_updated_at();

-- Insert sample data for each category (4 subcategories per category)
INSERT INTO public.system_prompts (category, subcategory, prompt_text, display_order) VALUES
-- Mindset (4 subcategories)
('mindset', 'Daily Affirmations', 'Analyze this astrological data and create personalized daily affirmations based on current planetary positions and aspects. Focus on empowering beliefs and mindset shifts.', 1),
('mindset', 'Growth Patterns', 'Review this chart data and identify key growth patterns and learning opportunities. Highlight areas where mindset shifts could accelerate personal development.', 2),
('mindset', 'Mental Strengths', 'Using this astrological information, identify mental strengths and cognitive advantages. Suggest ways to leverage these natural abilities.', 3),
('mindset', 'Limiting Beliefs', 'Examine this chart for indicators of potential limiting beliefs or mental blocks. Provide insights on transforming these patterns.', 4),

-- Health (4 subcategories)
('health', 'Vitality Cycles', 'Analyze this chart for health and vitality cycles. Identify optimal times for rest, activity, and wellness practices.', 1),
('health', 'Energy Management', 'Review this data for insights on natural energy rhythms and optimal energy management strategies throughout the day and month.', 2),
('health', 'Stress Indicators', 'Examine this chart for stress indicators and pressure points. Suggest proactive wellness strategies.', 3),
('health', 'Body-Mind Connection', 'Analyze this astrological data for body-mind connection insights and holistic health recommendations.', 4),

-- Wealth (4 subcategories)
('wealth', 'Financial Timing', 'Review this chart for optimal financial timing - when to invest, save, or take calculated risks based on planetary cycles.', 1),
('wealth', 'Money Mindset', 'Analyze this data for insights on natural abundance patterns and money mindset strengths to cultivate.', 2),
('wealth', 'Career Opportunities', 'Examine this chart for career advancement opportunities and professional growth timing.', 3),
('wealth', 'Resource Management', 'Using this astrological information, identify natural talents for resource management and wealth building strategies.', 4),

-- Soul (4 subcategories)
('soul', 'Life Purpose', 'Analyze this chart for life purpose indicators and soul mission clues. Help me understand my deeper calling.', 1),
('soul', 'Spiritual Growth', 'Review this data for spiritual growth opportunities and consciousness expansion timing.', 2),
('soul', 'Inner Wisdom', 'Examine this chart for accessing inner wisdom and intuitive guidance. Identify natural psychic or intuitive abilities.', 3),
('soul', 'Karmic Patterns', 'Using this astrological information, explore karmic patterns and soul lessons for this lifetime.', 4),

-- Career (4 subcategories)
('career', 'Professional Path', 'Analyze this chart for optimal career path and professional direction based on natural talents and cosmic timing.', 1),
('career', 'Leadership Style', 'Review this data for natural leadership qualities and most effective management approach.', 2),
('career', 'Work-Life Balance', 'Examine this chart for work-life balance needs and sustainable career strategies.', 3),
('career', 'Skill Development', 'Using this astrological information, identify key skills to develop for career advancement and fulfillment.', 4),

-- Compatibility (4 subcategories)
('compatibility', 'Relationship Dynamics', 'Analyze this chart data for relationship dynamics and partnership compatibility insights.', 1),
('compatibility', 'Communication Style', 'Review this data for natural communication style and how to bridge differences with others.', 2),
('compatibility', 'Attraction Patterns', 'Examine this chart for attraction patterns and relationship needs for lasting connections.', 3),
('compatibility', 'Partnership Timing', 'Using this astrological information, identify optimal timing for deepening relationships or meeting new connections.', 4);
