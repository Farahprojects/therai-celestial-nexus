import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Lock, Globe } from 'lucide-react';
import { shareFolder, unshareFolder, getSharedFolder } from '@/services/folders';

interface ShareFolderModalProps {
  folderId: string;
  folderName?: string;
  onClose: () => void;
}

type ShareMode = 'private' | 'public' | null;

export const ShareFolderModal: React.FC<ShareFolderModalProps> = ({
  folderId,
  folderName,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check current folder sharing status on mount
  useEffect(() => {
    const checkFolderStatus = async () => {
      try {
        const folder = await getSharedFolder(folderId);
        if (folder) {
          setIsShared(true);
          // Get share_mode from folder (defaults to 'private' if not set)
          setShareMode(folder.share_mode || 'private');
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('Error checking folder status:', error);
        setIsInitialized(true);
      }
    };

    checkFolderStatus();
  }, [folderId]);

  const handleShare = async (mode: 'private' | 'public') => {
    setIsLoading(true);
    try {
      await shareFolder(folderId, mode);
      setIsShared(true);
      setShareMode(mode);
    } catch (error) {
      console.error('Error sharing folder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnshare = async () => {
    setIsLoading(true);
    try {
      await unshareFolder(folderId);
      setIsShared(false);
    } catch (error) {
      console.error('Error unsharing folder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = getShareUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const getShareUrl = (): string => {
    if (!isShared) {
      return `https://therai.co/folders/${folderId}`;
    }
    
    // Private mode: uses join URL (requires sign-in)
    // Public mode: also uses join URL for now (will need separate route for truly public access)
    return `https://therai.co/join/folder/${folderId}`;
  };

  const shareUrl = getShareUrl();

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/20">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <Share2 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Share Folder</h2>
              <p className="text-sm text-gray-500">{folderName || 'Untitled'}</p>
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
                  Setting up sharing for this folder.
                </p>
              </div>
            </div>
          ) : !isInitialized ? (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-light">Loading...</p>
            </div>
          ) : !isShared ? (
            /* Share Options Selection */
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Share Folder</h3>
                <p className="text-sm text-gray-600">
                  Choose how you want to share this folder
                </p>
              </div>

              {/* Private (Invite-only) Option */}
              <button
                onClick={() => handleShare('private')}
                disabled={isLoading}
                className="w-full p-4 border-2 border-gray-200 hover:border-gray-300 rounded-xl text-left transition-all hover:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 mb-1">Private (Invite-only)</div>
                    <div className="text-sm text-gray-600">
                      Anyone with the link can join, but they need to sign in first. Perfect for collaboration.
                    </div>
                  </div>
                </div>
              </button>

              {/* Public Option */}
              <button
                onClick={() => handleShare('public')}
                disabled={isLoading}
                className="w-full p-4 border-2 border-gray-200 hover:border-gray-300 rounded-xl text-left transition-all hover:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 mb-1">Public</div>
                    <div className="text-sm text-gray-600">
                      Anyone with the link can view without signing in. Completely open access.
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ) : isShared ? (
            /* Share Success */
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Folder shared!</h3>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {shareMode === 'private' ? (
                    <>
                      <Lock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-600">Private (Invite-only)</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">Public</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {shareMode === 'private' 
                    ? "Anyone with this link can join this folder after signing in. They'll be able to view and access all conversations in the folder."
                    : "Anyone with this link can view this folder without signing in. They'll be able to see all conversations in the folder."
                  }
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

export default ShareFolderModal;

