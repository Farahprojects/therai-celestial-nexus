import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Link } from 'lucide-react';
import { shareConversation, unshareConversation } from '@/services/conversations-static';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [conversationMode, setConversationMode] = useState<string | null>(null);

  // Fetch conversation mode
  useEffect(() => {
    const fetchMode = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('mode')
        .eq('id', conversationId)
        .single();
      
      setConversationMode(data?.mode || null);
    };
    
    fetchMode();
  }, [conversationId]);

  // Auto-create share link when modal opens
  useEffect(() => {
    const autoShare = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        await shareConversation(conversationId, user.id);
        setIsShared(true);
      } catch (error) {
        console.error('Error sharing conversation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    autoShare();
  }, [conversationId, user]);

  const handleUnshare = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await unshareConversation(conversationId, user.id);
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
  const isTogetherMode = conversationMode === 'together';

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <div>
            <h2 className="text-2xl font-light text-gray-900">Share Conversation</h2>
            <p className="text-sm font-light text-gray-500 mt-1">
              {isTogetherMode ? 'Together Mode' : (conversationTitle || 'Untitled')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 space-y-6">
          {isLoading ? (
            /* Loading State */
            <div className="text-center space-y-6 py-8">
              <div className="w-14 h-14 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto" />
              <div>
                <h3 className="text-lg font-light text-gray-900 mb-2">Creating share link</h3>
                <p className="text-sm font-light text-gray-500 leading-relaxed">
                  Setting up public access
                </p>
              </div>
            </div>
          ) : isShared ? (
            /* Share Success */
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
                <Link className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-light text-gray-700">Link active</span>
              </div>

              {isTogetherMode ? (
                /* Together Mode Instructions */
                <p className="text-sm font-light text-gray-600 leading-relaxed">
                  Enjoy your conversation. Type <span className="font-medium text-gray-900">@therai</span> to ask Therai to jump in and explore anything together. Pro users get 3 AI questions daily.
                </p>
              ) : (
                /* Regular Share Text */
                <p className="text-sm font-light text-gray-600 leading-relaxed">
                  Anyone with this link can join the conversation
                </p>
              )}

              {/* Link with Copy Button */}
              <div className="bg-gray-50 rounded-full overflow-hidden flex items-center">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-6 py-4 text-sm font-light text-gray-700 bg-transparent border-none outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-light transition-colors flex items-center gap-2 rounded-full mr-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Stop Sharing */}
              <button
                onClick={handleUnshare}
                disabled={isLoading}
                className="w-full px-6 py-4 text-gray-600 hover:bg-gray-50 rounded-full text-sm font-light transition-colors"
              >
                Stop sharing
              </button>
            </div>
          ) : (
            /* Error State */
            <div className="text-center space-y-6 py-8">
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                <X className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h3 className="text-lg font-light text-gray-900 mb-2">Failed to share</h3>
                <p className="text-sm font-light text-gray-500 leading-relaxed">
                  There was an error creating the share link
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-sm font-light transition-colors"
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