-- Create web_leads table for marketing site lead capture
CREATE TABLE IF NOT EXISTS public.web_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Core contact information
  name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  role TEXT,
  phone TEXT,
  message TEXT,
  
  -- Lead context
  lead_type TEXT NOT NULL CHECK (lead_type IN ('contact', 'lead_magnet', 'newsletter', 'booking')),
  source TEXT DEFAULT 'custom-ai-site',
  page_path TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  -- Consent and status
  newsletter_opt_in BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'contacted', 'won', 'lost'))
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_web_leads_created_at ON public.web_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_leads_email ON public.web_leads(email);
CREATE INDEX IF NOT EXISTS idx_web_leads_lead_type ON public.web_leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_web_leads_status ON public.web_leads(status);
CREATE INDEX IF NOT EXISTS idx_web_leads_source ON public.web_leads(source);

-- Enable RLS
ALTER TABLE public.web_leads ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert leads (public form submissions)
CREATE POLICY "Anyone can insert web leads"
  ON public.web_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users with admin role can read leads
CREATE POLICY "Admins can read web leads"
  ON public.web_leads
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'user_role' = 'admin'
  );

-- Policy: Only authenticated users with admin role can update leads
CREATE POLICY "Admins can update web leads"
  ON public.web_leads
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'user_role' = 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'user_role' = 'admin'
  );

-- Add comment for documentation
COMMENT ON TABLE public.web_leads IS 'Stores lead information from marketing website forms (contact, newsletter, lead magnets, booking requests)';

