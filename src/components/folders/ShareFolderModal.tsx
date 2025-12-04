import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Lock, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  shareFolderPublic, 
  shareFolderPrivate, 
  unshareFolder, 
  getSharedFolder,
  FolderPermissions,
  DEFAULT_PERMISSIONS,
  FULL_ACCESS_PERMISSIONS
} from '@/services/folders';
import { safeConsoleError } from '@/utils/safe-logging';

interface ShareFolderModalProps {
  folderId: string;
  folderName?: string;
  onClose: () => void;
}

type PermissionPreset = 'journals' | 'full' | 'custom';

const PRESET_CONFIGS: Record<PermissionPreset, { label: string; description: string; permissions: FolderPermissions }> = {
  journals: {
    label: 'Journals Only',
    description: 'View and add journal entries',
    permissions: DEFAULT_PERMISSIONS,
  },
  full: {
    label: 'Full Access',
    description: 'Access all folder content',
    permissions: FULL_ACCESS_PERMISSIONS,
  },
  custom: {
    label: 'Custom',
    description: 'Choose specific permissions',
    permissions: DEFAULT_PERMISSIONS,
  },
};

export const ShareFolderModal: React.FC<ShareFolderModalProps> = ({
  folderId,
  folderName,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PermissionPreset>('journals');
  const [customPermissions, setCustomPermissions] = useState<FolderPermissions>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    const checkFolderStatus = async () => {
      try {
        const folder = await getSharedFolder(folderId);
        if (folder) {
          setIsShared(!!folder.is_public || false);
          setIsPublic(folder.is_public || false);
        }
      } catch (error) {
        safeConsoleError('Error checking folder status:', error);
      }
    };

    checkFolderStatus();
  }, [folderId]);

  const getActivePermissions = (): FolderPermissions => {
    if (selectedPreset === 'custom') {
      return customPermissions;
    }
    return PRESET_CONFIGS[selectedPreset].permissions;
  };

  const handleSharePublic = async () => {
    setIsLoading(true);
    try {
      await shareFolderPublic(folderId);
      setIsShared(true);
      setIsPublic(true);
    } catch (error) {
      safeConsoleError('Error sharing folder publicly:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSharePrivate = async () => {
    setIsLoading(true);
    try {
      await shareFolderPrivate(folderId, getActivePermissions());
      setIsShared(true);
      setIsPublic(false);
    } catch (error) {
      safeConsoleError('Error sharing folder privately:', error);
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
      safeConsoleError('Error unsharing folder:', error);
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
      safeConsoleError('Error copying to clipboard:', error);
    }
  };

  const togglePermission = (key: keyof FolderPermissions) => {
    setSelectedPreset('custom');
    setCustomPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const permissionLabels: Record<keyof FolderPermissions, string> = {
    can_view_journals: 'View journals',
    can_add_journals: 'Add journals',
    can_view_documents: 'View documents',
    can_add_documents: 'Add documents',
    can_view_conversations: 'View conversations',
    can_view_insights: 'View insights',
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <div>
            <h2 className="text-2xl font-light text-gray-900">Share Folder</h2>
            <p className="text-sm font-light text-gray-500 mt-1">{folderName || 'Untitled'}</p>
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
          {!isShared ? (
            /* Share Options Selection */
            <div className="space-y-3">
              <p className="text-sm font-light text-gray-600 mb-6">
                Choose who can access this folder
              </p>

              {/* Private Option */}
              <div className="bg-gray-50 rounded-3xl overflow-hidden">
                <button
                  onClick={() => setShowPermissions(!showPermissions)}
                  disabled={isLoading}
                  className="w-full px-6 py-5 text-left transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Lock className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-light text-gray-900 mb-1">Private</div>
                      <div className="text-sm font-light text-gray-500">
                        Requires sign-in with custom access
                      </div>
                    </div>
                    {showPermissions ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Permissions Panel */}
                {showPermissions && (
                  <div className="px-6 pb-6 space-y-4">
                    {/* Presets */}
                    <div className="flex gap-2">
                      {(['journals', 'full'] as const).map((preset) => (
                        <button
                          key={preset}
                          onClick={() => {
                            setSelectedPreset(preset);
                            setCustomPermissions(PRESET_CONFIGS[preset].permissions);
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-light transition-colors ${
                            selectedPreset === preset
                              ? 'bg-gray-900 text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {PRESET_CONFIGS[preset].label}
                        </button>
                      ))}
                    </div>

                    {/* Custom Permissions */}
                    <div className="space-y-2">
                      {(Object.keys(permissionLabels) as Array<keyof FolderPermissions>).map((key) => {
                        const activePermissions = getActivePermissions();
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={activePermissions[key]}
                              onChange={() => togglePermission(key)}
                              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            <span className="text-sm font-light text-gray-700">
                              {permissionLabels[key]}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Share Private Button */}
                    <button
                      onClick={handleSharePrivate}
                      disabled={isLoading}
                      className="w-full px-6 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-sm font-light transition-colors"
                    >
                      {isLoading ? 'Sharing...' : 'Share privately'}
                    </button>
                  </div>
                )}
              </div>

              {/* Public Option */}
              <button
                onClick={handleSharePublic}
                disabled={isLoading}
                className="w-full px-6 py-5 bg-gray-50 hover:bg-gray-100 rounded-3xl text-left transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Globe className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-light text-gray-900 mb-1">Public</div>
                    <div className="text-sm font-light text-gray-500">
                      Anyone with link can view all content
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            /* Share Success */
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
                {isPublic ? (
                  <>
                    <Globe className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-light text-gray-700">Public</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-light text-gray-700">Private</span>
                  </>
                )}
              </div>

              <p className="text-sm font-light text-gray-600 leading-relaxed">
                {isPublic
                  ? "Anyone with this link can view all content without signing in"
                  : "Anyone with this link can access with their configured permissions after signing in"
                }
              </p>

              {/* Link with Copy Button */}
              <div className="bg-gray-50 rounded-full overflow-hidden flex items-center">
                <input
                  type="text"
                  value={`https://therai.co/folder/${folderId}`}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareFolderModal;
