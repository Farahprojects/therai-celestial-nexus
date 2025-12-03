import React, { useState } from 'react';
import { User, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [showAstroForm, setShowAstroForm] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleAstroFormSubmit = async (data: ReportFormData & { chat_id?: string }) => {
    try {
      // The profile is automatically saved by the AstroDataForm/useProfileSaver hook
      // We just need to link it to the folder
      // The profile_id should be in data if it was saved
      if (data.profile_id) {
        await updateFolderProfile(folderId, data.profile_id);
        toast.success('Profile linked to folder');
        setShowAstroForm(false);
        onProfileLinked();
      } else {
        // If no profile_id, the form might have created a chat instead
        // Close the form anyway
        setShowAstroForm(false);
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
    <>
      {/* Banner */}
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
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowAstroForm(true)}
                className="rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
                size="sm"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create Profile
              </Button>
              <Button
                onClick={() => setIsDismissed(true)}
                variant="ghost"
                className="rounded-full font-light"
                size="sm"
              >
                Maybe Later
              </Button>
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

      {/* Astro Form Modal */}
      {showAstroForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl">
            <AstroDataForm
              onClose={() => setShowAstroForm(false)}
              onSubmit={handleAstroFormSubmit}
              mode="astro"
              preselectedType="essence"
              reportType="essence"
              isProfileFlow={true}
            />
          </div>
        </div>
      )}
    </>
  );
};

