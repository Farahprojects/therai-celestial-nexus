-- Add vbase.co domain with noreply and support slugs
INSERT INTO public.domain_slugs (domain, noreply, support)
VALUES ('vbase.co', true, true)
ON CONFLICT (domain) 
DO UPDATE SET noreply = true, support = true;

-- Verify
SELECT * FROM public.domain_slugs WHERE domain = 'vbase.co';

