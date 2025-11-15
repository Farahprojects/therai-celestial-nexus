import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useProfileSaver } from '@/hooks/useProfileSaver';

interface SaveProfileButtonProps {
  profileData: {
    name: string;
    birthDate: string;
    birthTime: string;
    birthLocation: string;
    birthLatitude?: number;
    birthLongitude?: number;
    birthPlaceId?: string;
  };
}

export const SaveProfileButton: React.FC<SaveProfileButtonProps> = ({ profileData }) => {
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const { saveProfile, isSaving } = useProfileSaver();

  const handleSave = async () => {
    const result = await saveProfile({
      ...profileData,
      profileName: profileName.trim(),
    });

    if (result.success) {
      setProfileName('');
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 rounded-lg border-gray-200 font-light text-base text-gray-600 hover:text-gray-900 hover:bg-gray-50 mt-1 justify-start"
        >
          <Save className="w-4 h-4 mr-2" />
          Save this profile...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-4" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-gray-900 mb-1">Save Profile</h4>
            <p className="text-xs text-gray-600">
              Give this profile a label for easy access later
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-sm text-gray-700">
              Profile Label
            </Label>
            <Input
              id="profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`e.g., ${profileData.name || 'My Profile'}`}
              className="h-10"
              autoFocus
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500">
              Leave blank to use "{profileData.name || 'name'}"
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
              className="rounded-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

