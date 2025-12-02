import React, { useState } from 'react';
import { FileText, Check, Edit, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { saveDraft, updateDocumentContent, DraftDocument, DocumentUpdate } from '@/services/folder-ai';
import { toast } from 'sonner';

interface FolderAIDraftPreviewProps {
  draft?: DraftDocument;
  update?: DocumentUpdate;
  messageId: string;
  folderId: string;
  userId: string;
  onSaved?: () => void;
  onEdited?: () => void;
  onUpdated?: () => void;
  onDiscarded?: () => void;
}

export const FolderAIDraftPreview: React.FC<FolderAIDraftPreviewProps> = ({
  draft,
  update,
  messageId,
  folderId,
  userId,
  onSaved,
  onEdited,
  onUpdated,
  onDiscarded
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarded, setIsDiscarded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isDraft = !!draft;
  const isUpdate = !!update;

  if (isDiscarded) {
    return (
      <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-sm text-gray-500">Draft discarded</p>
      </div>
    );
  }

  if (isSaved) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
        <Check className="w-4 h-4 text-green-600" />
        <p className="text-sm text-green-700">
          {isDraft ? 'Document saved to folder' : 'Changes applied'}
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);

      if (isDraft && draft) {
        // Save draft as new document
        await saveDraft(folderId, userId, draft.title, draft.content, messageId);
        toast.success('Document saved to folder');
        setIsSaved(true);
        onSaved?.();
      } else if (isUpdate && update) {
        // Apply update to existing document
        await updateDocumentContent(update.documentId, update.content, update.changeType, messageId);
        toast.success('Document updated');
        setIsSaved(true);
        onUpdated?.();
      }
    } catch (err: unknown) {
      console.error('[FolderAIDraftPreview] Error saving:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    // For now, just show a message. In the future, this could open DocumentUploadModal
    // with pre-filled content
    toast.info('Edit functionality coming soon');
    onEdited?.();
  };

  const handleDiscard = () => {
    setIsDiscarded(true);
    toast.success('Draft discarded');
    onDiscarded?.();
  };

  const title = isDraft ? draft!.title : 'Document Update';
  const content = isDraft ? draft!.content : update!.content;
  const previewLength = 200;
  const preview = content.length > previewLength 
    ? content.substring(0, previewLength) + '...' 
    : content;

  return (
    <div className="bg-white border-2 border-purple-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-purple-50 px-4 py-3 border-b border-purple-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-medium text-purple-900">{title}</h3>
        </div>
        {isUpdate && update && (
          <p className="text-xs text-purple-600 mt-1">
            Change type: {update.changeType}
          </p>
        )}
      </div>

      {/* Content Preview */}
      <div className="px-4 py-3 bg-gray-50">
        <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono text-xs max-h-32 overflow-y-auto">
          {preview}
        </div>
        {content.length > previewLength && (
          <p className="text-xs text-gray-500 mt-2">
            {content.length} characters total
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-white border-t border-purple-100 flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 h-9 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              {isDraft ? 'Save Document' : 'Apply Changes'}
            </>
          )}
        </Button>

        <Button
          onClick={handleEdit}
          disabled={isSaving}
          variant="outline"
          className="h-9 rounded-lg border-gray-300 text-gray-700 text-sm"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>

        <Button
          onClick={handleDiscard}
          disabled={isSaving}
          variant="ghost"
          className="h-9 rounded-lg text-gray-500 hover:text-gray-700 text-sm"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

