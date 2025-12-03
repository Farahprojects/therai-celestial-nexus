import { useState } from 'react';
import { User, X, ArrowRight } from 'lucide-react';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { ReportFormData } from '@/types/report-form';
import { updateFolderProfile } from '@/services/folders';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

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
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const handleAstroFormSubmit = async (data: ReportFormData & { chat_id?: string }) => {
    try {
      // The profile is automatically saved by the AstroDataForm/useProfileSaver hook
      // We store the profile_id but don't link to folder yet
      if (data.profile_id) {
        setCreatedProfileId(data.profile_id);
        toast.success('Profile created successfully');
      } else {
        console.warn('[FolderProfileSetup] Profile created but no profile_id returned');
      }
    } catch (error) {
      console.error('[FolderProfileSetup] Failed to create profile:', error);
      toast.error('Failed to create profile');
    }
  };

  const handleLinkProfile = async () => {
    if (!createdProfileId) return;

    try {
      setIsLinking(true);
      await updateFolderProfile(folderId, createdProfileId);
      toast.success('Profile linked to folder');
      onProfileLinked();
    } catch (error) {
      console.error('[FolderProfileSetup] Failed to link profile:', error);
      toast.error('Failed to link profile to folder');
    } finally {
      setIsLinking(false);
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
            Create a profile for this folder to enable personalized astro insights and analysis.
            This profile will be used for all astro-related activities in <strong>{folderName}</strong>.
          </p>

          {!createdProfileId ? (
            // Step 1: Create Profile Form
            <div className="space-y-3">
              <AstroDataForm
                onClose={() => setIsDismissed(true)}
                onSubmit={handleAstroFormSubmit}
                mode="astro"
                preselectedType="essence"
                reportType="essence"
                isProfileFlow={true}
              />
            </div>
          ) : (
            // Step 2: Link Profile Confirmation
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 text-green-800">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="font-medium">Profile created successfully!</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Click "Link to Folder" to connect this profile to <strong>{folderName}</strong>.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setCreatedProfileId(null)}
                  variant="outline"
                  className="flex-1 rounded-full font-light"
                >
                  Back
                </Button>
                <Button
                  onClick={handleLinkProfile}
                  disabled={isLinking}
                  className="flex-1 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
                >
                  {isLinking ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Linking...
                    </>
                  ) : (
                    <>
                      Link to Folder
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
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
