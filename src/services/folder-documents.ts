import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError } from '@/utils/safe-logging';
export interface FolderDocument {
  id: string;
  user_id: string;
  folder_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_extension: string;
  file_path: string | null;
  content_text: string | null;
  upload_status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Upload a document to a folder
 * Note: This creates the database record. File upload to storage should be handled separately.
 */
export async function uploadDocument(
  userId: string,
  folderId: string,
  file: File,
  metadata?: Record<string, unknown>
): Promise<FolderDocument> {
  // Extract file information
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
  
  // Create database record
  const { data, error } = await supabase
    .from('folder_documents')
    .insert({
      user_id: userId,
      folder_id: folderId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_extension: fileExtension,
      upload_status: 'pending',
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    safeConsoleError('[FolderDocuments] Failed to create document record:', error);
    throw new Error(error.message || 'Failed to upload document');
  }

  return data as FolderDocument;
}

/**
 * Get all documents for a folder
 */
export async function getDocuments(folderId: string): Promise<FolderDocument[]> {
  const { data, error } = await supabase
    .from('folder_documents')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: false });

  if (error) {
    safeConsoleError('[FolderDocuments] Failed to fetch documents:', error);
    throw new Error(error.message || 'Failed to fetch documents');
  }

  return (data || []) as FolderDocument[];
}

/**
 * Get a single document by ID
 */
export async function getDocument(documentId: string): Promise<FolderDocument | null> {
  const { data, error } = await supabase
    .from('folder_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    safeConsoleError('[FolderDocuments] Failed to fetch document:', error);
    return null;
  }

  return data as FolderDocument;
}

/**
 * Update document status and content
 */
export async function updateDocument(
  documentId: string,
  updates: {
    upload_status?: 'pending' | 'processing' | 'completed' | 'failed';
    content_text?: string | null;
    file_path?: string;
    file_name?: string;
    error_message?: string;
  }
): Promise<FolderDocument> {
  const { data, error } = await supabase
    .from('folder_documents')
    .update(updates)
    .eq('id', documentId)
    .select()
    .single();

  if (error) {
    safeConsoleError('[FolderDocuments] Failed to update document:', error);
    throw new Error(error.message || 'Failed to update document');
  }

  return data as FolderDocument;
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string): Promise<void> {
  // First get the document to find the file path
  const document = await getDocument(documentId);
  
  // Delete from storage if file_path exists
  if (document?.file_path) {
    const { error: storageError } = await supabase.storage
      .from('folder-documents')
      .remove([document.file_path]);
    
    if (storageError) {
      safeConsoleWarn('[FolderDocuments] Failed to delete file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }
  }

  // Delete database record
  const { error } = await supabase
    .from('folder_documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    safeConsoleError('[FolderDocuments] Failed to delete document:', error);
    throw new Error(error.message || 'Failed to delete document');
  }
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFileToStorage(
  userId: string,
  folderId: string,
  file: File
): Promise<string> {
  const fileName = `${userId}/${folderId}/${Date.now()}_${file.name}`;

  const { data, error } = await supabase.storage
    .from('folder-documents')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    safeConsoleError('[FolderDocuments] Failed to upload file to storage:', error);
    throw new Error(error.message || 'Failed to upload file');
  }

  return data.path;
}

/**
 * Extract text content from file (client-side for now)
 * For production, this should be done server-side via edge function
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
  
  // For text-based files, read directly
  if (['txt', 'md', 'csv'].includes(fileExtension)) {
    return await file.text();
  }
  
  // For other formats (PDF, DOCX), would need server-side processing
  // Return empty for now - can be enhanced later
  safeConsoleWarn('[FolderDocuments] Text extraction not implemented for', fileExtension);
  return '';
}

