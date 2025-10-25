import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Link } from 'lucide-react';
import { shareConversation, unshareConversation } from '@/services/conversations';

interface ShareConversationModalProps {
  conversationId: string;
  conversationTitle?: string;
  onClose: () => void;
}

export const ShareConversationModal: React.FC<ShareConversationModalProps> = ({
  conversationId,
  conversationTitle,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-create share link when modal opens
  useEffect(() => {
    const autoShare = async () => {
      setIsLoading(true);
      try {
        await shareConversation(conversationId);
        setIsShared(true);
      } catch (error) {
        console.error('Error sharing conversation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    autoShare();
  }, [conversationId]);

  const handleUnshare = async () => {
    setIsLoading(true);
    try {
      await unshareConversation(conversationId);
      setIsShared(false);
    } catch (error) {
      console.error('Error unsharing conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = `https://therai.co/join/${conversationId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const shareUrl = isShared ? `https://therai.co/join/${conversationId}` : '';

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <Share2 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Share Conversation</h2>
              <p className="text-sm text-gray-500">{conversationTitle || 'Untitled'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            /* Loading State */
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Creating share link...</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Setting up public access for this conversation.
                </p>
              </div>
            </div>
          ) : isShared ? (
            /* Share Success */
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Conversation shared!</h3>
                <p className="text-sm text-gray-600">
                  Anyone with this link can join the conversation.
                </p>
              </div>

              {/* Link Input with Copy Button */}
              <div className="relative">
                <div className="flex items-center gap-0 border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-4 py-3 text-sm text-gray-700 bg-white border-none outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Stop Sharing Button */}
              <button
                onClick={handleUnshare}
                disabled={isLoading}
                className="w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
              >
                Stop sharing
              </button>
            </div>
          ) : (
            /* Error State */
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to share</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  There was an error creating the share link. Please try again.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareConversationModal;