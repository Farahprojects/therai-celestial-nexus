import React, { useState, useEffect } from 'react';
import { User, Sparkles, X, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { ReportFormData } from '@/types/report-form';
import { updateFolderProfile } from '@/services/folders';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  profile_name: string;
  name: string;
  birth_date: string;
  birth_location: string;
  is_primary: boolean;
}

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
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Fetch existing profiles on mount
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoadingProfiles(true);
        const { data, error } = await supabase
          .from('user_profile_list')
          .select('id, profile_name, name, birth_date, birth_location, is_primary')
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProfiles(data || []);
      } catch (error) {
        console.error('[FolderProfileSetup] Failed to fetch profiles:', error);
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, []);

  const handleProfileSelect = async (profile: Profile) => {
    try {
      await updateFolderProfile(folderId, profile.id);
      toast.success(`Profile "${profile.name}" linked to folder`);
      onProfileLinked();
    } catch (error) {
      console.error('[FolderProfileSetup] Failed to link profile:', error);
      toast.error('Failed to link profile to folder');
    }
  };

  const handleCreateProfileClick = () => {
    setShowInlineForm(true);
  };

  const handleAstroFormSubmit = async (data: ReportFormData & { chat_id?: string }) => {
    try {
      // The profile is automatically saved by the AstroDataForm/useProfileSaver hook
      // We just need to link it to the folder
      // The profile_id should be in data if it was saved
      if (data.profile_id) {
        await updateFolderProfile(folderId, data.profile_id);
        toast.success('Profile linked to folder');
        setShowInlineForm(false);
        onProfileLinked();
      } else {
        // If no profile_id, the form might have created a chat instead
        // Close the form anyway
        setShowInlineForm(false);
      }
    } catch (error) {
      console.error('[FolderProfileSetup] Failed to link profile:', error);
      toast.error('Failed to link profile to folder');
    }
  };

  const handleCancelForm = () => {
    setShowInlineForm(false);
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
            <div className="space-y-3">
              {/* Profile Selection Dropdown */}
              {profiles.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-light">Use existing:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-gray-300 hover:border-gray-400 font-light"
                      >
                        {selectedProfile ? selectedProfile.name : 'Select Profile'}
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {profiles.map((profile) => (
                        <DropdownMenuItem
                          key={profile.id}
                          onClick={() => setSelectedProfile(profile)}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{profile.name}</div>
                            <div className="text-xs text-gray-500">{profile.birth_location}</div>
                          </div>
                          {selectedProfile?.id === profile.id && (
                            <Check className="w-4 h-4 text-green-600" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {selectedProfile && (
                    <Button
                      onClick={() => handleProfileSelect(selectedProfile)}
                      size="sm"
                      className="rounded-full bg-green-600 hover:bg-green-700 text-white font-light"
                    >
                      Link Profile
                    </Button>
                  )}
                </div>
              )}

              {/* Create Profile Button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCreateProfileClick}
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

      {/* Inline Astro Form */}
      {showInlineForm && (
        <div className="mt-6 p-6 bg-white rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-light text-gray-900">Create New Profile</h4>
            <Button
              onClick={handleCancelForm}
              variant="ghost"
              size="sm"
              className="rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <AstroDataForm
            onClose={handleCancelForm}
            onSubmit={handleAstroFormSubmit}
            mode="astro"
            preselectedType="essence"
            reportType="essence"
            isProfileFlow={true}
          />
        </div>
      )}
    </>
  );
};

