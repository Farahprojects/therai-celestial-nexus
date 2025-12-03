import { useState } from 'react';
import { User, X } from 'lucide-react';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { ReportFormData } from '@/types/report-form';
import { updateFolderProfile } from '@/services/folders';
import { toast } from 'sonner';

interface FolderProfileSetupProps {
  folderId: string;
  folderName: string;
  onProfileLinked: () => void;
}

export const FolderProfileSetup: React.FC<FolderProfileSetupProps> = ({
  folderId,
  folderName,
  onProfileLinked,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleAstroFormSubmit = async (data: ReportFormData & { chat_id?: string }) => {
    try {
      // The profile is automatically saved by the AstroDataForm/useProfileSaver hook
      // We just need to link it to the folder
      if (data.profile_id) {
        await updateFolderProfile(folderId, data.profile_id);
        toast.success('Profile linked to folder');
        onProfileLinked();
      } else {
        console.warn('[FolderProfileSetup] Profile created but no profile_id returned');
      }
    } catch (error) {
      console.error('[FolderProfileSetup] Failed to link profile:', error);
      toast.error('Failed to link profile to folder');
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-gray-600" />
            <h3 className="text-base font-normal text-gray-900">
              Set Up Folder Profile
            </h3>
          </div>
          <p className="text-sm font-light text-gray-600 mb-4">
            Link a profile to this folder to enable personalized astro insights and analysis.
            This profile will be used for all astro-related activities in <strong>{folderName}</strong>.
          </p>
          <div className="space-y-3">
            <AstroDataForm
              onClose={() => setIsDismissed(true)}
              onSubmit={handleAstroFormSubmit}
              mode="astro"
              preselectedType="essence"
              reportType="essence"
              isProfileFlow={false}
            />
          </div>
        </div>
        
        {/* Dismiss Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
};
