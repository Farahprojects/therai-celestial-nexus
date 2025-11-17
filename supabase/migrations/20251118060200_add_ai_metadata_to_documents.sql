-- Add AI-generated flags and metadata to folder_documents table

-- Add column to track if document was AI-generated
ALTER TABLE public.folder_documents 
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;

-- Add column to store AI-related metadata (draft status, source message, etc)
ALTER TABLE public.folder_documents 
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for AI-generated documents
CREATE INDEX IF NOT EXISTS idx_folder_documents_ai_generated 
  ON public.folder_documents(ai_generated) 
  WHERE ai_generated = true;

-- Add column to track document version (for future AI updates)
ALTER TABLE public.folder_documents 
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add column to track parent document (for versioning)
ALTER TABLE public.folder_documents 
  ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES public.folder_documents(id) ON DELETE SET NULL;

-- Create index for document versioning
CREATE INDEX IF NOT EXISTS idx_folder_documents_parent 
  ON public.folder_documents(parent_document_id) 
  WHERE parent_document_id IS NOT NULL;

-- Comment on new columns
COMMENT ON COLUMN public.folder_documents.ai_generated IS 'Whether this document was created by the Folder AI';
COMMENT ON COLUMN public.folder_documents.ai_metadata IS 'AI-related metadata including message_id, draft_status, and other context';
COMMENT ON COLUMN public.folder_documents.version IS 'Document version number (incremented on AI updates)';
COMMENT ON COLUMN public.folder_documents.parent_document_id IS 'Reference to parent document for versioning';

