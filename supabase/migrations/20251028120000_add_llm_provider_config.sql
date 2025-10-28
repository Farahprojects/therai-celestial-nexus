-- System configuration for LLM provider selection
-- Allows toggling between OpenAI (ChatGPT) and Google (Gemini) without code changes

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Allow public read access to system config
CREATE POLICY "Public read access to system_config"
  ON system_config
  FOR SELECT
  USING (true);

-- Only service role can update
CREATE POLICY "Service role can update system_config"
  ON system_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default LLM provider configuration
INSERT INTO system_config (key, value, description) VALUES
  ('llm_provider', '{"use_gemini": true}', 'LLM provider selection: use_gemini=true for Gemini, false for ChatGPT')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Add comment
COMMENT ON TABLE system_config IS 'System-wide configuration flags and settings';
COMMENT ON COLUMN system_config.value IS 'JSONB value allows flexible configuration schemas';

