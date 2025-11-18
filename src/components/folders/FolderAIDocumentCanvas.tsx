import React, { useState, useEffect } from 'react';
import { X, Save, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { DraftDocument } from '@/services/folder-ai';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useIsMobile } from '@/hooks/use-mobile';

interface FolderAIDocumentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  draft: DraftDocument | null;
  onSave: (title: string, content: string) => Promise<void>;
  isSaving: boolean;
}

export const FolderAIDocumentCanvas: React.FC<FolderAIDocumentCanvasProps> = ({
  isOpen,
  onClose,
  draft,
  onSave,
  isSaving
}) => {
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');

  // Sync with draft changes
  useEffect(() => {
    if (draft) {
      setEditedTitle(draft.title);
      setEditedContent(draft.content);
      setIsEditing(false); // Reset to preview mode when new draft arrives
    }
  }, [draft]);

  const handleSave = async () => {
    if (!editedTitle.trim() || !editedContent.trim()) return;
    
    try {
      await onSave(editedTitle, editedContent);
      onClose();
    } catch (error) {
      console.error('[DocumentCanvas] Error saving:', error);
    }
  };

  const handleDiscard = () => {
    onClose();
  };

  if (!draft || !isOpen) return null;

  const containerClassName = isMobile
    ? 'fixed inset-0 z-50 flex flex-col bg-white'
    : 'fixed inset-y-0 left-0 z-40 w-3/4 sm:max-w-2xl p-0 flex flex-col border-r bg-white shadow-lg';

  return (
    <div
      className={containerClassName}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
        {/* Header - Apple Style */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <FileText className="w-5 h-5 text-gray-700 shrink-0" />
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 text-[17px] font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 tracking-tight"
                placeholder="Document title..."
              />
            ) : (
              <h2 className="text-[17px] font-semibold text-gray-900 truncate tracking-tight">{editedTitle}</h2>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-7 h-7 flex items-center justify-center hover:bg-gray-100/80 rounded-full transition-all disabled:opacity-40 shrink-0 ml-2"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Mode Toggle - Apple Style with pill buttons */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-gray-200/60 bg-white/50 shrink-0">
          <div className="flex items-center gap-1 bg-gray-100/80 rounded-full p-0.5">
            <button
              onClick={() => setIsEditing(false)}
              className={cn(
                "px-3 py-1 rounded-full text-[13px] font-semibold transition-all",
                !isEditing 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              Preview
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className={cn(
                "px-3 py-1 rounded-full text-[13px] font-semibold transition-all",
                isEditing 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              Edit
            </button>
          </div>
          <div className="ml-auto text-[11px] text-gray-500 font-medium">
            {editedContent.length.toLocaleString()} chars
          </div>
        </div>

        {/* Content - Apple Style */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-6">
            {isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[600px] font-mono text-[15px] resize-none border-2 border-gray-200/80 focus:border-gray-400 focus:ring-0 rounded-2xl p-4"
                placeholder="Document content..."
              />
            ) : (
              <div className="prose prose-sm max-w-none text-gray-900 font-light">
                <ReactMarkdown>{editedContent}</ReactMarkdown>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions - Apple Style with pill buttons */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200/60 bg-white/80 backdrop-blur-xl shrink-0">
          <button
            onClick={handleDiscard}
            disabled={isSaving}
            className="flex-1 rounded-full px-5 py-2.5 text-[15px] font-semibold text-gray-700 bg-gray-100/80 hover:bg-gray-200/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !editedTitle.trim() || !editedContent.trim()}
            className="flex-1 rounded-full px-5 py-2.5 text-[15px] font-semibold text-white bg-black hover:bg-gray-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
  );
};

