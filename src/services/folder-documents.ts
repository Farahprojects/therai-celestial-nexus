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
 * Validate file before upload using Edge Function (single source of truth)
 * Frontend is kept "dumb" - all validation logic is on the server
 */
async function validateFileForUpload(file: File): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Please log in to upload files');
    }

    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/validate-file-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      // Send both fileName AND fileType, let server decide
      body: JSON.stringify({
        bucket: 'folder-documents',
        fileName: file.name,
        fileType: file.type,  // Send as-is, even if empty
        fileSize: file.size,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'File validation failed');
    }

    const result = await response.json();
    if (!result.valid) {
      throw new Error(result.message);
    }

    // Validation passed
  } catch (error) {
    // Network errors or validation failures
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Unable to validate file. Please check your connection and try again.');
    }

    // Re-throw validation errors from server
    throw error;
  }
}

/**
 * Upload file to Supabase Storage
 * Includes server-side validation via Edge Function before upload
 */
export async function uploadFileToStorage(
  userId: string,
  folderId: string,
  file: File
): Promise<string> {
  // Validate file using Edge Function (server-side validation)
  await validateFileForUpload(file);

  const fileName = `${userId}/${folderId}/${Date.now()}_${file.name}`;

  const { data, error } = await supabase.storage
    .from('folder-documents')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      // Include MIME type in metadata for additional validation
      metadata: {
        mimetype: file.type || 'application/octet-stream',
      },
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

