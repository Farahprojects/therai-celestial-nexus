import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Link, MessageCircle, Sparkles, Bell, Target } from 'lucide-react';
import { shareConversation, unshareConversation, updateConversationMode } from '@/services/conversations';
import { CONVERSATION_MODES, getAvailableModes, ConversationMode } from '@/constants/conversationModes';
import { supabase } from '@/integrations/supabase/client';

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
  const [selectedMode, setSelectedMode] = useState<string>('standard');
  const [isCompatibilityChat, setIsCompatibilityChat] = useState(false);

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

  // Load conversation and check if it's compatibility chat
  useEffect(() => {
    const loadConversation = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('meta')
        .eq('id', conversationId)
        .single();
      
      // Check if compatibility chat (has person_b)
      const isCompat = !!data?.meta?.last_report_form?.person_b;
      setIsCompatibilityChat(isCompat);
      
      // Load current mode
      setSelectedMode(data?.meta?.conversation_mode || 'standard');
    };
    
    loadConversation();
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

  const handleModeChange = async (modeId: string) => {
    setIsLoading(true);
    try {
      await updateConversationMode(conversationId, modeId);
      setSelectedMode(modeId);
    } catch (error) {
      console.error('Error updating mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const shareUrl = isShared ? `https://therai.co/join/${conversationId}` : '';

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <div>
            <h2 className="text-2xl font-light text-gray-900">Share Conversation</h2>
            <p className="text-sm font-light text-gray-500 mt-1">{conversationTitle || 'Untitled'}</p>
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

              <p className="text-sm font-light text-gray-600 leading-relaxed">
                Anyone with this link can join the conversation
              </p>

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

              {/* Mode Picker */}
              <div className="space-y-4 pt-2">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Conversation Mode</h4>
                  <p className="text-xs font-light text-gray-600 mt-1">
                    Choose how this conversation operates
                  </p>
                </div>
                
                <div className="space-y-2">
                  {getAvailableModes(isCompatibilityChat).map((mode) => {
                    const IconComponent = {
                      MessageCircle,
                      Sparkles,
                      Bell,
                      Target
                    }[mode.icon];
                    
                    const isDisabled = !mode.enabled;
                    
                    return (
                      <button
                        key={mode.id}
                        onClick={() => !isDisabled && handleModeChange(mode.id)}
                        disabled={isDisabled}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                          selectedMode === mode.id
                            ? 'border-gray-900 bg-gray-50' 
                            : isDisabled
                              ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            selectedMode === mode.id 
                              ? 'bg-gray-900 text-white' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <IconComponent size={18} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-medium text-gray-900">{mode.name}</h5>
                              {!mode.enabled && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                                  Coming soon
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-light text-gray-600 mt-0.5">
                              {mode.description}
                            </p>
                          </div>
                          {selectedMode === mode.id && (
                            <Check className="w-5 h-5 text-gray-900" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
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