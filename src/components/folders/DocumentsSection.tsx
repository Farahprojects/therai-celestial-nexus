import React from 'react';
import { File, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { FolderDocument } from '@/services/folder-documents';

interface DocumentsSectionProps {
  documents: FolderDocument[];
  formatFileSize: (bytes: number) => string;
  onViewDocument: (documentId: string) => void;
  onEditDocument: (documentId: string) => void;
  onDeleteDocument: (documentId: string) => void;
}

export const DocumentsSection: React.FC<DocumentsSectionProps> = ({
  documents,
  formatFileSize,
  onViewDocument,
  onEditDocument,
  onDeleteDocument,
}) => {
  if (documents.length === 0) return null;

  return (
    <div className="px-6 py-4">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Documents
          </p>
        </div>

        <div className="flex flex-col space-y-2">
          {documents.map(document => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-4 py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors group"
            >
              <div
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                onClick={() => onViewDocument(document.id)}
              >
                <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-light text-gray-900 truncate">
                    {document.file_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs font-light text-gray-500">
                      {new Date(document.created_at).toLocaleDateString()}
                    </p>
                    <span className="text-xs text-gray-400">•</span>
                    <p className="text-xs font-light text-gray-500">
                      {formatFileSize(document.file_size)}
                    </p>
                    {document.upload_status === 'completed' && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-green-600">Uploaded</span>
                      </>
                    )}
                    {document.upload_status === 'pending' && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-yellow-600">Processing</span>
                      </>
                    )}
                    {document.upload_status === 'failed' && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-red-600">Failed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Document actions"
                    onClick={e => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-600" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <button
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                    onClick={e => {
                      e.stopPropagation();
                      onViewDocument(document.id);
                    }}
                  >
                    View
                  </button>
                  <button
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                    onClick={e => {
                      e.stopPropagation();
                      onEditDocument(document.id);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-gray-100 rounded"
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteDocument(document.id);
                    }}
                  >
                    Delete
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
