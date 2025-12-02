import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FolderDocument } from '@/services/folder-documents';

interface DocumentData {
  document: FolderDocument | null;
  fileUrl: string | null;
  textContent: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to load a document using the get-report-data edge function
 * This handles server-side text extraction for PDFs, DOCX, etc.
 */
export const useDocumentLoader = (documentId: string | null) => {
  const [data, setData] = useState<DocumentData>({
    document: null,
    fileUrl: null,
    textContent: null,
    isLoading: false,
    error: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const loadDocument = useCallback(async () => {
    if (!documentId) {
      setData({
        document: null,
        fileUrl: null,
        textContent: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use the get-report-data edge function to fetch document
      // This handles server-side text extraction
      const { data: response, error: functionError } = await supabase.functions.invoke(
        'get-report-data',
        { body: { document_id: documentId } }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!response?.ok || !response?.data) {
        throw new Error(response?.error || 'Failed to load document');
      }

      const { document, textContent, fileUrl } = response.data;

      setData({
        document,
        fileUrl: fileUrl || null,
        textContent: textContent || null,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      console.error('[useDocumentLoader] Failed to load document:', err);
      setData({
        document: null,
        fileUrl: null,
        textContent: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load document',
      });
    }
  }, [documentId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument, refreshKey]);

  // Expose refresh function
  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return { ...data, refresh };
};

