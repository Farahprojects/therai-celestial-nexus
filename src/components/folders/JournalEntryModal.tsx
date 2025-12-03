import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, Loader2 } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUniversalMic } from '@/hooks/microphone/useUniversalMic';
import { createJournalEntry, JournalEntry } from '@/services/journal';
import { toast } from 'sonner';
import { safeConsoleError } from '@/utils/safe-logging';
interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  userId: string;
  onEntrySaved?: (entry: JournalEntry) => void;
}

export const JournalEntryModal: React.FC<JournalEntryModalProps> = ({
  isOpen,
  onClose,
  folderId,
  userId,
  onEntrySaved,
}) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
  } = useUniversalMic({
    chat_id: folderId, // Use folder_id as chat_id for STT
    chattype: 'text',
    mode: 'chat',
    onTranscriptReady: (transcription) => {
      // Append transcription to existing text
      setText(prev => prev ? `${prev} ${transcription}` : transcription);
    },
    onError: (error) => {
      safeConsoleError('[JournalEntryModal] Transcription error:', error);
      toast.error('Failed to transcribe audio');
    },
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setText('');
      setTitle('');
    }
  }, [isOpen]);

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSave = async () => {
    if (!text.trim()) {
      toast.error('Please enter some content');
      return;
    }

    setIsSaving(true);
    try {
      const newEntry = await createJournalEntry(userId, folderId, text.trim(), title.trim() || undefined);
      onEntrySaved?.(newEntry);
      toast.success('Journal entry saved');
      onClose();
    } catch (error) {
      safeConsoleError('[JournalEntryModal] Failed to save journal entry:', error);
      toast.error('Failed to save journal entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSaving) {
      onClose();
    }
  };

  const getMicButtonContent = () => {
    if (isProcessing) {
      return <Loader2 size={18} className="animate-spin" />;
    }
    return <Mic size={18} className={isRecording ? 'text-red-500' : ''} />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 bg-white" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-light text-gray-900">New Journal Entry</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Title Input */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              disabled={isSaving}
              className="w-full px-4 py-3 text-base font-light border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          {/* Text Input with Mic Button */}
          <div className="relative">
            <TextareaAutosize
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your journal entry..."
              disabled={isSaving}
              minRows={6}
              maxRows={20}
              className="w-full px-4 py-3 pr-12 text-base font-light border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none disabled:opacity-50 disabled:bg-gray-50"
            />
            
            {/* Mic Button */}
            <button
              onClick={handleMicClick}
            disabled={isProcessing || isSaving}
              className={`absolute right-3 bottom-3 w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                isRecording 
                  ? 'bg-red-50 text-red-500 hover:bg-red-100' 
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {getMicButtonContent()}
            </button>
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 text-sm text-red-500 font-light">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              Recording...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full font-light"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !text.trim()}
            className="rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Entry'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

