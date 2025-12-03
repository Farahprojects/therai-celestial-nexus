import React, { useState } from 'react';
import { File, Download, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FolderDocument, updateDocument } from '@/services/folder-documents';
import { toast } from 'sonner';

interface DocumentContentProps {
  document: FolderDocument;
  fileUrl: string | null;
  textContent: string | null;
  onUpdate?: () => void; // Callback when document is updated
  initialEditMode?: boolean; // Open in edit mode initially
}

export const DocumentContent: React.FC<DocumentContentProps> = ({
  document,
  fileUrl,
  textContent,
  onUpdate,
  initialEditMode = false,
}) => {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [editedText, setEditedText] = useState(textContent || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(document.file_name);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Update editedText when textContent changes (e.g., after refresh)
  React.useEffect(() => {
    if (!isEditing) {
      setEditedText(textContent || '');
    }
  }, [textContent, isEditing]);

  // Handle initial edit mode
  React.useEffect(() => {
    if (initialEditMode && textContent) {
      setIsEditing(true);
      setEditedText(textContent);
    }
  }, [initialEditMode, textContent]);

  // Update editedTitle when document changes
  React.useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(document.file_name);
    }
  }, [document.file_name, isEditingTitle]);

  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleEdit = () => {
    setEditedText(textContent || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedText(textContent || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDocument(document.id, {
        content_text: editedText.trim() || null,
      });
      toast.success('Document updated');
      setIsEditing(false);
      onUpdate?.(); // Refresh the document data
    } catch (error: unknown) {
      console.error('[DocumentContent] Failed to update document:', error);
      toast.error('Failed to update document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) {
      toast.error('Document name cannot be empty');
      return;
    }

    setIsSavingTitle(true);
    try {
      await updateDocument(document.id, {
        file_name: editedTitle.trim(),
      });
      toast.success('Document name updated');
      setIsEditingTitle(false);
      onUpdate?.(); // Refresh the document data
    } catch (error: unknown) {
      console.error('[DocumentContent] Failed to update document name:', error);
      toast.error('Failed to update document name');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelTitle = () => {
    setEditedTitle(document.file_name);
    setIsEditingTitle(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderContent = () => {
    // Priority 1: If we have extracted text content, show it directly (editable)
    if (textContent || editedText) {
      if (isEditing) {
        return (
          <div className="w-full">
            <div className="flex items-center justify-end gap-2 mb-3">
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                className="rounded-full font-light"
                disabled={isSaving}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                className="rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full min-h-[60vh] p-6 text-sm text-black bg-white border border-gray-200 rounded-lg font-light leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Edit document content..."
              disabled={isSaving}
            />
          </div>
        );
      }

      return (
        <div className="w-full">
          <div className="flex items-center justify-end mb-3">
            <Button
              onClick={handleEdit}
              variant="outline"
              size="sm"
              className="rounded-full font-light"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
          <div className="prose prose-sm max-w-none font-light">
            <div className="whitespace-pre-wrap text-sm text-black bg-white p-6 rounded-lg max-h-[80vh] overflow-y-auto leading-relaxed">
              {textContent || editedText}
            </div>
          </div>
        </div>
      );
    }

    // Priority 2: For PDFs, show embedded viewer if we have a URL
    if (document.file_extension === 'pdf' && fileUrl) {
      return (
        <div className="w-full h-[80vh] border border-gray-200 rounded-lg overflow-hidden">
          <iframe
            src={fileUrl}
            className="w-full h-full"
            title={document.file_name}
          />
        </div>
      );
    }

    // Priority 3: For other file types with URLs, show embedded viewer or download
    if (fileUrl) {
      const ext = document.file_extension.toLowerCase();

      // Images - show directly
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
      if (imageExtensions.includes(ext)) {
        return (
          <div className="w-full flex justify-center">
            <img
              src={fileUrl}
              alt={document.file_name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        );
      }

      // HTML files - show in iframe
      if (ext === 'html' || ext === 'htm') {
        return (
          <div className="w-full h-[80vh] border border-gray-200 rounded-lg overflow-hidden">
            <iframe
              src={fileUrl}
              className="w-full h-full"
              title={document.file_name}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        );
      }

      // JSON files - show formatted
      if (ext === 'json') {
        return (
          <div className="w-full">
            <div className="whitespace-pre-wrap text-sm text-black bg-white p-6 rounded-lg max-h-[80vh] overflow-y-auto leading-relaxed font-mono">
              {textContent || 'Loading JSON content...'}
            </div>
          </div>
        );
      }

      // For other types (Excel, PowerPoint, archives, etc.), show download option
      return (
        <div className="text-center py-12">
          <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2 font-light">
            {document.file_name}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {formatFileSize(document.file_size)} • {document.file_extension.toUpperCase()}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {ext === 'xlsx' || ext === 'xls' || ext === 'pptx' || ext === 'ppt'
              ? 'Text extraction not yet available for this file type'
              : 'Text extraction not available for this file type'}
          </p>
          <Button
            onClick={handleDownload}
            className="rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
          >
            <Download className="w-4 h-4 mr-2" />
            Download File
          </Button>
        </div>
      );
    }

    // Fallback: No content available
    return (
      <div className="text-center py-12 text-gray-500">
        <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p>Unable to load document content</p>
        <p className="text-sm mt-2">The file may still be processing</p>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-0 md:px-4 py-8">
      <div className="mb-6">
        {/* Editable Title */}
        {isEditingTitle ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="flex-1 text-2xl font-light text-gray-900 border-b-2 border-gray-900 focus:outline-none bg-transparent"
              disabled={isSavingTitle}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveTitle();
                } else if (e.key === 'Escape') {
                  handleCancelTitle();
                }
              }}
            />
            <Button
              onClick={handleSaveTitle}
              size="sm"
              className="rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
              disabled={isSavingTitle || !editedTitle.trim()}
            >
              {isSavingTitle ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={handleCancelTitle}
              variant="outline"
              size="sm"
              className="rounded-full font-light"
              disabled={isSavingTitle}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-2 group">
            <h2 className="text-2xl font-light text-gray-900 flex-1">{document.file_name}</h2>
            <button
              onClick={() => setIsEditingTitle(true)}
              className="p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Edit document name"
            >
              <Edit2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{formatFileSize(document.file_size)}</span>
          <span>•</span>
          <span>{document.file_extension.toUpperCase()}</span>
          <span>•</span>
          <span>{new Date(document.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

