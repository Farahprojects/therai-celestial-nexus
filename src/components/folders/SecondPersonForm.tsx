import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CleanPlaceAutocomplete } from '@/components/shared/forms/place-input/CleanPlaceAutocomplete';

interface SecondPersonFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (profileData: SecondPersonData) => void;
  folderId: string;
}

export interface SecondPersonData {
  profile_id?: string; // If selecting existing profile
  name: string;
  birth_date: string;
  birth_time: string;
  location: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
  timezone?: string;
}

interface SavedProfile {
  id: string;
  profile_name: string;
  name: string;
  birth_date: string;
  birth_time: string;
  birth_location: string;
  birth_latitude?: number;
  birth_longitude?: number;
  birth_place_id?: string;
  timezone?: string;
}

export const SecondPersonForm: React.FC<SecondPersonFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  folderId,
}) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'select' | 'manual'>('select');
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Manual entry fields
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [placeId, setPlaceId] = useState<string>('');

  // Load user's saved profiles
  useEffect(() => {
    if (isOpen && user?.id) {
      loadProfiles();
    }
  }, [isOpen, user?.id]);

  const loadProfiles = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('user_profile_list')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setProfiles(data);
    }
  };

  const handleLocationSelect = (locationData: {
    name: string;
    lat: number;
    lng: number;
    placeId: string;
    timezone?: string;
  }) => {
    setLocation(locationData.name);
    setLatitude(locationData.lat);
    setLongitude(locationData.lng);
    setPlaceId(locationData.placeId);
  };

  const handleSubmit = () => {
    if (mode === 'select' && selectedProfileId) {
      const profile = profiles.find(p => p.id === selectedProfileId);
      if (!profile) return;
      
      onSubmit({
        profile_id: profile.id,
        name: profile.name,
        birth_date: profile.birth_date,
        birth_time: profile.birth_time,
        location: profile.birth_location,
        latitude: profile.birth_latitude,
        longitude: profile.birth_longitude,
        place_id: profile.birth_place_id,
        timezone: profile.timezone,
      });
    } else if (mode === 'manual') {
      // Validate manual entry
      if (!name || !birthDate || !birthTime || !location) {
        return;
      }
      
      onSubmit({
        name,
        birth_date: birthDate,
        birth_time: birthTime,
        location,
        latitude,
        longitude,
        place_id: placeId,
      });
    }
  };

  const isFormValid = () => {
    if (mode === 'select') {
      return !!selectedProfileId;
    }
    return !!(name && birthDate && birthTime && location);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-light">Add Second Person</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'select' ? 'default' : 'outline'}
              onClick={() => setMode('select')}
              className="flex-1 font-light"
            >
              Select Profile
            </Button>
            <Button
              type="button"
              variant={mode === 'manual' ? 'default' : 'outline'}
              onClick={() => setMode('manual')}
              className="flex-1 font-light"
            >
              Manual Entry
            </Button>
          </div>

          {/* Select Profile Mode */}
          {mode === 'select' && (
            <div className="space-y-2">
              <Label className="font-light">Choose a saved profile</Label>
              {profiles.length === 0 ? (
                <p className="text-sm text-gray-500 font-light">
                  No saved profiles. Switch to manual entry or add profiles in Settings.
                </p>
              ) : (
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 font-light focus:border-gray-900 focus:outline-none"
                >
                  <option value="">Select a profile...</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.profile_name} ({profile.name})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Manual Entry Mode */}
          {mode === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-light">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name"
                  className="rounded-xl font-light"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birthDate" className="font-light">Birth Date</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="rounded-xl font-light"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthTime" className="font-light">Birth Time</Label>
                  <Input
                    id="birthTime"
                    type="time"
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                    className="rounded-xl font-light"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="font-light">Birth Location</Label>
                <CleanPlaceAutocomplete
                  value={location}
                  onChange={setLocation}
                  onPlaceSelect={handleLocationSelect}
                  placeholder="Enter birth location"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="font-light rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid() || isLoading}
            className="font-light rounded-xl bg-gray-900 hover:bg-gray-800"
          >
            {isLoading ? 'Creating...' : 'Create Compatibility Chat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

