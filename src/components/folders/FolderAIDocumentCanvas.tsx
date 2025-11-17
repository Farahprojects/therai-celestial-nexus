import React, { useState, useEffect } from 'react';
import { X, Save, FileText } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { DraftDocument } from '@/services/folder-ai';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

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

  if (!draft) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <SheetContent 
        side="left" 
        className="w-full sm:max-w-2xl p-0 flex flex-col border-r"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileText className="w-5 h-5 text-purple-600 shrink-0" />
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 text-lg font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0"
                placeholder="Document title..."
              />
            ) : (
              <h2 className="text-lg font-medium text-gray-900 truncate">{editedTitle}</h2>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 shrink-0 ml-2"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 px-6 py-3 border-b bg-gray-50 shrink-0">
          <button
            onClick={() => setIsEditing(false)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              !isEditing 
                ? "bg-white text-purple-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Preview
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              isEditing 
                ? "bg-white text-purple-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Edit
          </button>
          <div className="ml-auto text-xs text-gray-500">
            {editedContent.length.toLocaleString()} characters
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-4">
            {isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[600px] font-mono text-sm resize-none border-gray-200 focus:border-purple-300 focus:ring-purple-200"
                placeholder="Document content..."
              />
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{editedContent}</ReactMarkdown>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t bg-white shrink-0">
          <Button
            onClick={handleDiscard}
            variant="outline"
            disabled={isSaving}
            className="flex-1"
          >
            Discard
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !editedTitle.trim() || !editedContent.trim()}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save to Folder'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

