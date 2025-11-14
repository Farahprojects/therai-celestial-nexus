-- Create folder_documents table for document uploads
-- Supports PDF, DOCX, TXT, MD, CSV formats

CREATE TABLE IF NOT EXISTS public.folder_documents (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE,
  
  -- Document information
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- MIME type
  file_size INTEGER NOT NULL, -- Size in bytes
  file_extension TEXT NOT NULL, -- e.g., 'pdf', 'docx', 'txt', 'md', 'csv'
  
  -- Content storage
  file_path TEXT, -- Storage path if using Supabase Storage
  content_text TEXT, -- Extracted text content for searchability
  
  -- Metadata
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT, -- If upload/processing failed
  metadata JSONB DEFAULT '{}', -- Additional metadata
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_folder_documents_user_id ON public.folder_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_documents_folder_id ON public.folder_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_documents_status ON public.folder_documents(upload_status);

-- Enable RLS
ALTER TABLE public.folder_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view documents in their own folders
CREATE POLICY "Users can view documents in their folders"
  ON public.folder_documents
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = auth.uid()
    )
  );

-- Users can insert documents into their own folders
CREATE POLICY "Users can insert documents into their folders"
  ON public.folder_documents
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = folder_documents.folder_id
      AND cf.user_id = auth.uid()
    )
  );

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
  ON public.folder_documents
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
  ON public.folder_documents
  FOR DELETE
  USING (user_id = auth.uid());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_folder_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER folder_documents_updated_at_trigger
  BEFORE UPDATE ON public.folder_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_folder_documents_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.folder_documents IS 'Stores uploaded documents associated with folders';
COMMENT ON COLUMN public.folder_documents.content_text IS 'Extracted text content for search and insights';
COMMENT ON COLUMN public.folder_documents.file_path IS 'Path in Supabase Storage bucket';

