-- Drop system_config table (LLM provider toggle no longer needed - always using Gemini)
DROP TABLE IF EXISTS public.system_config;