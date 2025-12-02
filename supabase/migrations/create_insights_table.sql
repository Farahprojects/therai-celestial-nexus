-- Create insights table for generating unique report IDs
CREATE TABLE IF NOT EXISTS public.insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Optional: Store report metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraint for status values
    CONSTRAINT insights_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON public.insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_status ON public.insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON public.insights(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own insights
CREATE POLICY "Users can view own insights" ON public.insights
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own insights" ON public.insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights" ON public.insights
    FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for insights table
ALTER PUBLICATION supabase_realtime ADD TABLE public.insights;
ALTER TABLE public.insights REPLICA IDENTITY FULL;
