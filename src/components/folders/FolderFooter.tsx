import React, { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { motion, AnimatePresence } from 'framer-motion';

interface FolderFooterProps {
  folderAIMessage: string;
  showFolderAI: boolean;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
}

export const FolderFooter: React.FC<FolderFooterProps> = ({
  folderAIMessage,
  showFolderAI,
  onMessageChange,
  onSendMessage,
}) => {
  const folderAIInputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <AnimatePresence mode="wait">
      {!showFolderAI && (
        <motion.div
          key="folder-footer"
          initial={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="bg-white backdrop-blur-lg p-2 relative shrink-0 border-t border-gray-200"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}
        >
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <div className="flex-1 relative">
              <TextareaAutosize
                ref={folderAIInputRef}
                value={folderAIMessage}
                onChange={(e) => onMessageChange(e.target.value)}
                placeholder="Ask Folder AI about this folder..."
                className="w-full px-4 py-2.5 pr-24 text-base font-light bg-white border-2 rounded-3xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 resize-none text-black placeholder-gray-500 overflow-y-auto border-gray-300"
                style={{ fontSize: '16px' }} // Prevents zoom on iOS
                maxRows={4}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (folderAIMessage.trim()) {
                      onSendMessage();
                    }
                  }
                }}
              />
              <div className="absolute right-1 inset-y-0 flex items-center gap-1 z-10" style={{ transform: 'translateY(-4px) translateX(-4px)' }}>
                <button
                  onClick={() => {
                    if (folderAIMessage.trim()) {
                      onSendMessage();
                    }
                  }}
                  disabled={!folderAIMessage.trim()}
                  className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center ${folderAIMessage.trim()
                      ? 'bg-black hover:bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  title="Send message"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="max-w-3xl mx-auto mt-2">
            <p className="text-xs text-gray-600 font-light text-center">
              Therai can make mistakes. Check important info.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
