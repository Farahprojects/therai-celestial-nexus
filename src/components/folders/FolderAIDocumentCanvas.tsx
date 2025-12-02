import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { DraftDocument } from '@/services/folder-ai';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Same robust markdown stripping logic as Gemini LLM handler, but preserves line breaks
function sanitizePlainText(input: string): string {
  return (typeof input === "string" ? input : "")
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]+\]\([^)]+\)/g, "") // images
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1") // links
    .replace(/[>_~#*]+/g, "") // md symbols (including bold/italic *)
    .replace(/-{3,}/g, "\n") // horizontal rules -> line break
    .replace(/[ \t]+/g, " ") // multiple spaces/tabs -> single space (preserve newlines)
    .replace(/\n{3,}/g, "\n\n") // multiple newlines -> double newline (paragraph break)
    .trim();
}

interface FolderAIDocumentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  draft: DraftDocument | null;
  documentId?: string; // If editing existing document
  onSave: (title: string, content: string, documentId?: string) => Promise<void>;
  isSaving: boolean;
}

export const FolderAIDocumentCanvas: React.FC<FolderAIDocumentCanvasProps> = ({
  isOpen,
  onClose,
  draft,
  documentId,
  onSave,
  isSaving
}) => {
  const isMobile = useIsMobile();
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');

  // Sync with draft changes and strip markdown
  useEffect(() => {
    if (draft) {
      setEditedTitle(sanitizePlainText(draft.title));
      // Strip markdown from content using same logic as Gemini handler
      setEditedContent(sanitizePlainText(draft.content));
    }
  }, [draft]);

  // Disable pointer events on Sheet overlays when canvas is open
  useEffect(() => {
    if (isOpen) {
      // Find all Sheet overlays and disable pointer events
      const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
      overlays.forEach((overlay) => {
        (overlay as HTMLElement).style.pointerEvents = 'none';
      });

      return () => {
        // Re-enable pointer events when canvas closes
        overlays.forEach((overlay) => {
          (overlay as HTMLElement).style.pointerEvents = '';
        });
      };
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!editedTitle.trim() || !editedContent.trim()) return;
    
    try {
      await onSave(editedTitle, editedContent, documentId);
      onClose();
    } catch (error) {
      console.error('[DocumentCanvas] Error saving:', error);
    }
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onClose();
  };

  if (!draft || !isOpen) return null;

  const canvasContent = (
    <div 
      className="fixed inset-0 z-[9999] flex justify-end bg-black/10 backdrop-blur-sm"
      onClick={handleClose}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className={cn(
          'flex flex-col bg-white shadow-xl',
          isMobile
            ? 'w-full h-full'
            : 'h-full w-full sm:max-w-2xl border-l'
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          pointerEvents: 'auto',
        }}
      >
        {/* Header - Apple Style */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <FileText className="w-5 h-5 text-gray-700 shrink-0" />
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex-1 text-[17px] font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 tracking-tight"
              placeholder="Document title..."
              style={{ pointerEvents: 'auto' }}
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleClose(e);
            }}
            disabled={isSaving}
            className="w-7 h-7 flex items-center justify-center hover:bg-gray-100/80 rounded-full transition-all disabled:opacity-40 shrink-0 ml-2 z-10"
            style={{ pointerEvents: 'auto' }}
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Content - Always in edit mode */}
        <ScrollArea 
          className="flex-1" 
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-6">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              className="min-h-[calc(100vh-250px)] font-mono text-[15px] resize-none border-2 border-gray-200/80 focus:border-gray-400 focus:ring-0 rounded-2xl p-4"
              placeholder="Document content..."
              style={{ pointerEvents: 'auto' }}
            />
          </div>
        </ScrollArea>

        {/* Actions - Just Save button */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200/60 bg-white/80 backdrop-blur-xl shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={isSaving || !editedTitle.trim() || !editedContent.trim()}
            className="rounded-full px-5 py-2.5 text-[15px] font-semibold text-white bg-black hover:bg-gray-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ pointerEvents: 'auto' }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render via portal at document body level for highest z-index priority
  return typeof document !== 'undefined' 
    ? createPortal(canvasContent, document.body)
    : null;
};

