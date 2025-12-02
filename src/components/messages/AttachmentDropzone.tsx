
import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paperclip, X } from 'lucide-react';

interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface AttachmentDropzoneProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

export const AttachmentDropzone = ({ attachments, onAttachmentsChange }: AttachmentDropzoneProps) => {
  const handleFileSelect = useCallback((files: FileList) => {
    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type
    }));
    
    onAttachmentsChange([...attachments, ...newAttachments]);
  }, [attachments, onAttachmentsChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
    }
  }, [handleFileSelect]);

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter(att => att.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" type="button" className="relative">
          <Paperclip className="w-4 h-4" />
          {attachments.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {attachments.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="text-sm font-medium">Attachments</div>
          
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
          >
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-sm text-gray-600 hover:text-gray-800"
            >
              Drop files here or <span className="text-blue-500 underline">browse</span>
            </label>
          </div>
          
          {attachments.length > 0 && (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{attachment.name}</div>
                    <div className="text-xs text-gray-500">{formatFileSize(attachment.size)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(attachment.id)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
