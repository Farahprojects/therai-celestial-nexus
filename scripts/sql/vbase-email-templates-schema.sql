-- Email Templates Schema for vBase App
-- Copy the exact schema from therai project

CREATE TABLE IF NOT EXISTS public.email_notification_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_type text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_notification_templates_pkey PRIMARY KEY (id),
  CONSTRAINT email_notification_templates_template_type_key UNIQUE (template_type)
);

ALTER TABLE public.email_notification_templates ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_notification_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_notification_templates_updated_at_trigger
  BEFORE UPDATE ON public.email_notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_notification_templates_updated_at();

-- Allow reading templates (needed for sending emails)
CREATE POLICY "Allow reading email templates" 
  ON public.email_notification_templates 
  FOR SELECT 
  USING (true);

