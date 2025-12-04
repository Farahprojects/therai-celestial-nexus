import React, { useState, useCallback } from 'react';
import { X, Upload, File, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { uploadDocument, uploadFileToStorage, updateDocument, extractTextFromFile } from '@/services/folder-documents';
import { safeConsoleWarn } from '@/utils/safe-logging';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  userId: string;
  onUploadComplete?: () => void;
}

interface FileWithPreview {
  file: File;
  id: string;
}

// Expanded list of accepted document formats
const ACCEPTED_FORMATS = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
  'text/html': '.html',
  'text/xml': '.xml',
  'application/json': '.json',
  'application/javascript': '.js',
  'text/javascript': '.js',
  'application/typescript': '.ts',
  'text/typescript': '.ts',
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-7z-compressed': '.7z',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

export const TEXT_EXTRACTABLE_EXTENSIONS = [
  'pdf', 'docx', 'doc', 'txt', 'md', 'csv', 'html', 'xml', 'json'
];

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  folderId,
  userId,
  onUploadComplete,
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    setErrorMessage(null);
    const invalidFiles: string[] = [];
    
    const validFiles = newFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type;
      
      const isValid = ACCEPTED_FORMATS[mimeType as keyof typeof ACCEPTED_FORMATS] === extension ||
                     Object.values(ACCEPTED_FORMATS).includes(extension);
      
      if (!isValid) {
        invalidFiles.push(file.name);
      }
      
      return isValid;
    });

    if (invalidFiles.length > 0) {
      setErrorMessage(`Unsupported format: ${invalidFiles.join(', ')}`);
    }

    const filesWithPreview: FileWithPreview[] = validFiles.map(file => ({
      file,
      id: Math.random().toString(36),
    }));

    setFiles(prev => [...prev, ...filesWithPreview]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setErrorMessage(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setErrorMessage('Please select files to upload');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    let successCount = 0;
    const failedFiles: { name: string; error: string }[] = [];

    try {
      for (const fileItem of files) {
        try {
          const document = await uploadDocument(userId, folderId, fileItem.file);
          const filePath = await uploadFileToStorage(userId, folderId, fileItem.file);

          let contentText = '';
          try {
            contentText = await extractTextFromFile(fileItem.file);
          } catch (extractError) {
            safeConsoleWarn('[DocumentUpload] Text extraction failed:', extractError);
          }

          await updateDocument(document.id, {
            upload_status: 'completed',
            file_path: filePath,
            content_text: contentText || undefined,
          });

          successCount++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Upload failed';
          failedFiles.push({ name: fileItem.file.name, error: errorMsg });
        }
      }

      if (failedFiles.length > 0) {
        const errorLines = failedFiles.map(f => `${f.name}: ${f.error}`);
        setErrorMessage(errorLines.join('\n'));
        setFiles(prev => prev.filter(f => 
          failedFiles.some(failed => failed.name === f.file.name)
        ));
      }

      if (successCount === files.length) {
        onUploadComplete?.();
        onClose();
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUploading && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-light text-gray-900">Upload Documents</h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              multiple
              accept={Object.keys(ACCEPTED_FORMATS).join(',')}
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="w-8 h-8 text-gray-400" />
              <div className="text-sm font-light text-gray-600">
                <span className="text-gray-900 font-normal">Click to upload</span> or drag and drop
              </div>
              <div className="text-xs text-gray-500">
                Documents, Text files, Images, Archives
              </div>
              <div className="text-xs text-gray-400 mt-1">
                PDF, DOCX, DOC, XLSX, PPTX, TXT, MD, CSV, HTML, JSON, Images, ZIP, and more
              </div>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="text-sm font-light text-gray-600 mb-2">
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </div>
              {files.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-light text-gray-900 truncate">
                        {fileItem.file.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(fileItem.file.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(fileItem.id)}
                    disabled={isUploading}
                    className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Inline Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 whitespace-pre-line">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-full font-light"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            className="rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
