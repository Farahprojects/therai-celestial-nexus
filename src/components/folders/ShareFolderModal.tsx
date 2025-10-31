import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Lock, Globe } from 'lucide-react';
import { shareFolderPublic, shareFolderPrivate, unshareFolder, getSharedFolder } from '@/services/folders';

interface ShareFolderModalProps {
  folderId: string;
  folderName?: string;
  onClose: () => void;
}

export const ShareFolderModal: React.FC<ShareFolderModalProps> = ({
  folderId,
  folderName,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkFolderStatus = async () => {
      try {
        const folder = await getSharedFolder(folderId);
        if (folder) {
          setIsShared(!!folder.is_public || false);
          setIsPublic(folder.is_public || false);
        }
      } catch (error) {
        console.error('Error checking folder status:', error);
      }
    };

    checkFolderStatus();
  }, [folderId]);

  const handleSharePublic = async () => {
    setIsLoading(true);
    try {
      await shareFolderPublic(folderId);
      setIsShared(true);
      setIsPublic(true);
    } catch (error) {
      console.error('Error sharing folder publicly:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSharePrivate = async () => {
    setIsLoading(true);
    try {
      await shareFolderPrivate(folderId);
      setIsShared(true);
      setIsPublic(false);
    } catch (error) {
      console.error('Error sharing folder privately:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnshare = async () => {
    setIsLoading(true);
    try {
      await unshareFolder(folderId);
      setIsShared(false);
      setIsPublic(false);
    } catch (error) {
      console.error('Error unsharing folder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = `https://therai.co/folder/${folderId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

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
          {!isShared ? (
            /* Share Options Selection */
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Share Folder</h3>
                <p className="text-sm text-gray-600">
                  All conversations in this folder will be shared
                </p>
              </div>

              {/* Private (Sign-in required) Option */}
              <button
                onClick={handleSharePrivate}
                disabled={isLoading}
                className="w-full p-4 border-2 border-gray-200 hover:border-gray-300 rounded-xl text-left transition-all hover:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 mb-1">Private</div>
                    <div className="text-sm text-gray-600">
                      Anyone with the link can view, but they need to sign in first.
                    </div>
                  </div>
                </div>
              </button>

              {/* Public Option */}
              <button
                onClick={handleSharePublic}
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
                      Anyone with the link can view without signing in.
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            /* Share Success */
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Folder shared!</h3>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {isPublic ? (
                    <>
                      <Globe className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">Public</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-600">Private</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {isPublic
                    ? "Anyone with this link can view all conversations in this folder without signing in."
                    : "Anyone with this link can view all conversations in this folder after signing in."
                  }
                </p>
              </div>

              {/* Link Input with Copy Button */}
              <div className="relative">
                <div className="flex items-center gap-0 border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
                  <input
                    type="text"
                    value={`https://therai.co/folder/${folderId}`}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareFolderModal;

