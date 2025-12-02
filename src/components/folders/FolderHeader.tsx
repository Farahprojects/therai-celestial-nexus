import React from 'react';
import { Folder } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FolderAddMenu } from './FolderAddMenu';
import { FolderExportMenu } from './FolderExportMenu';

interface FolderHeaderProps {
  folderName: string;
  folderId: string;
  onJournalClick: () => void;
  onInsightsClick: () => void;
  onUploadClick: () => void;
  onNewChatClick: () => void;
  onCompatibilityClick: () => void;
}

export const FolderHeader: React.FC<FolderHeaderProps> = ({
  folderName,
  folderId,
  onJournalClick,
  onInsightsClick,
  onUploadClick,
  onNewChatClick,
  onCompatibilityClick,
}) => {
  const { user } = useAuth();

  return (
    <div className="px-6 py-4">
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-lg font-light text-gray-900">
          <Folder className="w-5 h-5 text-gray-900" />
          <span>{folderName}</span>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            {/* Export Menu */}
            <FolderExportMenu folderId={folderId} folderName={folderName} />

            {/* Add Menu */}
            <FolderAddMenu
              onJournalClick={onJournalClick}
              onInsightsClick={onInsightsClick}
              onUploadClick={onUploadClick}
              onNewChatClick={onNewChatClick}
              onCompatibilityClick={onCompatibilityClick}
            />
          </div>
        )}
      </div>
    </div>
  );
};
