import React, { useState, useCallback } from 'react';
import { X, Upload, File, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { uploadDocument, uploadFileToStorage, updateDocument, extractTextFromFile } from '@/services/folder-documents';
import { toast } from 'sonner';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  userId: string;
}

interface FileWithPreview {
  file: File;
  id: string;
}

const ACCEPTED_FORMATS = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
};

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  folderId,
  userId,
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Reset files when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setFiles([]);
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
    const validFiles = newFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValid = Object.values(ACCEPTED_FORMATS).includes(extension);
      
      if (!isValid) {
        toast.error(`${file.name} is not a supported format`);
      }
      
      return isValid;
    });

    const filesWithPreview: FileWithPreview[] = validFiles.map(file => ({
      file,
      id: Math.random().toString(36),
    }));

    setFiles(prev => [...prev, ...filesWithPreview]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
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
      toast.error('Please select files to upload');
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const fileItem of files) {
        try {
          // 1. Create database record
          const document = await uploadDocument(userId, folderId, fileItem.file);

          // 2. Upload file to storage
          const filePath = await uploadFileToStorage(userId, folderId, fileItem.file);

          // 3. Extract text content (for text-based files)
          let contentText = '';
          try {
            contentText = await extractTextFromFile(fileItem.file);
          } catch (extractError) {
            console.warn('[DocumentUpload] Text extraction failed:', extractError);
          }

          // 4. Update document with storage path and content
          await updateDocument(document.id, {
            upload_status: 'completed',
            file_path: filePath,
            content_text: contentText || undefined,
          });

          successCount++;
        } catch (error) {
          console.error('[DocumentUpload] Failed to upload file:', fileItem.file.name, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} file${errorCount > 1 ? 's' : ''} failed to upload`);
      }

      if (successCount === files.length) {
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
                PDF, DOCX, TXT, MD, CSV
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

