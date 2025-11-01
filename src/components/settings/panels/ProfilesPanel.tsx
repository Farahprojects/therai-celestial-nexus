import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, User, Trash2, Calendar, MapPin, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { CleanPlaceAutocomplete } from '@/components/shared/forms/place-input/CleanPlaceAutocomplete';
import { PlaceData } from '@/components/shared/forms/place-input/utils/extractPlaceData';
import InlineDateTimeSelector from '@/components/ui/mobile-pickers/InlineDateTimeSelector';
import { SimpleDateTimePicker } from '@/components/ui/SimpleDateTimePicker';

interface SavedProfile {
  id: string;
  user_id: string;
  profile_name: string;
  name: string;
  birth_date: string;
  birth_time: string;
  birth_location: string;
  birth_latitude?: number;
  birth_longitude?: number;
  birth_place_id?: string;
  timezone?: string;
  house_system?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const ProfilesPanel = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [profileName, setProfileName] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthLocation, setBirthLocation] = useState('');
  const [birthLatitude, setBirthLatitude] = useState<number | undefined>();
  const [birthLongitude, setBirthLongitude] = useState<number | undefined>();
  const [birthPlaceId, setBirthPlaceId] = useState('');
  const [notes, setNotes] = useState('');
  
  // Mobile picker state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfiles();
    }
  }, [user]);

  const loadProfiles = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profile_list')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ProfilesPanel] Failed to load profiles:', error);
      } else {
        setProfiles(data || []);
      }
    } catch (err) {
      console.error('[ProfilesPanel] Error loading profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setProfileName('');
    setName('');
    setBirthDate('');
    setBirthTime('');
    setBirthLocation('');
    setBirthLatitude(undefined);
    setBirthLongitude(undefined);
    setBirthPlaceId('');
    setNotes('');
    setIsDatePickerOpen(false);
    setIsTimePickerOpen(false);
  };

  const handlePlaceSelect = (place: PlaceData) => {
    setBirthLocation(place.name);
    if (place.latitude) setBirthLatitude(place.latitude);
    if (place.longitude) setBirthLongitude(place.longitude);
    if (place.placeId) setBirthPlaceId(place.placeId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !name || !birthDate || !birthTime || !birthLocation) {
      alert('Please fill in all required fields');
      return;
    }

    if (!birthLatitude || !birthLongitude) {
      alert('Please select a valid location from the dropdown');
      return;
    }
    
    // Use name as profileName if no profile label provided
    const finalProfileName = profileName.trim() || name;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_profile_list')
        .insert({
          user_id: user.id,
          profile_name: finalProfileName,
          name: name,
          birth_date: birthDate,
          birth_time: birthTime,
          birth_location: birthLocation,
          birth_latitude: birthLatitude,
          birth_longitude: birthLongitude,
          birth_place_id: birthPlaceId || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) {
        console.error('[ProfilesPanel] Failed to save profile:', error);
        alert('Failed to save profile');
      } else {
        setProfiles([data, ...profiles]);
        setShowForm(false);
        resetForm();
      }
    } catch (err) {
      console.error('[ProfilesPanel] Error saving profile:', err);
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (profileId: string) => {
    setProfileToDelete(profileId);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!profileToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('user_profile_list')
        .delete()
        .eq('id', profileToDelete)
        .eq('user_id', user?.id);

      if (error) {
        console.error('[ProfilesPanel] Failed to delete profile:', error);
        alert('Failed to delete profile');
      } else {
        setProfiles(profiles.filter(p => p.id !== profileToDelete));
      }
    } catch (err) {
      console.error('[ProfilesPanel] Error deleting profile:', err);
      alert('Failed to delete profile');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setProfileToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-light text-gray-900">Saved Profiles</h3>
          <p className="text-sm text-gray-600 mt-1">
            Quick access to saved birth data for yourself or others
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Profile
        </Button>
      </div>

      {/* Add Profile Form */}
      {showForm && (
        <div className="bg-white border-2 border-gray-900 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-medium text-gray-900">Add New Profile</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="h-8 w-8 p-0 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="profileName" className="text-sm font-medium text-gray-700">
                Profile Label
              </Label>
              <Input
                id="profileName"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g., My Profile, Partner, Mom, etc."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Name *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., John Smith"
                className="mt-1"
                required
              />
            </div>

            {isMobile ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Birth Date * <span className="text-xs text-gray-500 font-normal">(DD/MM/YYYY)</span>
                  </Label>
                  <InlineDateTimeSelector
                    type="date"
                    value={birthDate}
                    onChange={setBirthDate}
                    isOpen={isDatePickerOpen}
                    onOpen={() => setIsDatePickerOpen(true)}
                    onConfirm={() => setIsDatePickerOpen(false)}
                    onCancel={() => setIsDatePickerOpen(false)}
                    placeholder="Select date"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Birth Time *</Label>
                  <InlineDateTimeSelector
                    type="time"
                    value={birthTime}
                    onChange={setBirthTime}
                    isOpen={isTimePickerOpen}
                    onOpen={() => setIsTimePickerOpen(true)}
                    onConfirm={() => setIsTimePickerOpen(false)}
                    onCancel={() => setIsTimePickerOpen(false)}
                    placeholder="Select time"
                  />
                </div>
              </div>
            ) : (
              <SimpleDateTimePicker
                dateValue={birthDate}
                timeValue={birthTime}
                onDateChange={setBirthDate}
                onTimeChange={setBirthTime}
              />
            )}

            <div>
              <Label htmlFor="birthLocation" className="text-sm font-medium text-gray-700">
                Birth Location *
              </Label>
              <CleanPlaceAutocomplete
                value={birthLocation}
                onChange={setBirthLocation}
                onPlaceSelect={handlePlaceSelect}
                placeholder="Enter city or location"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                Notes (Optional)
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                className="bg-gray-900 text-white hover:bg-gray-800 rounded-full"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {profiles.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-base font-light text-gray-900 mb-1">No saved profiles yet</h4>
          <p className="text-sm text-gray-600">
            Saved birth data will appear here for quick reuse
          </p>
        </div>
      ) : profiles.length > 0 ? (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <h4 className="font-medium text-gray-900 truncate">
                      {profile.profile_name}
                    </h4>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Name:</span>
                      <span>{profile.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>{profile.birth_date} at {profile.birth_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{profile.birth_location}</span>
                    </div>
                  </div>

                  {profile.notes && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                      {profile.notes}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full flex-shrink-0"
                  onClick={() => handleDeleteClick(profile.id)}
                  disabled={profileToDelete === profile.id}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!showForm && (
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Saved profiles are automatically created when you submit birth data in forms. 
            They can be reused for quick access.
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-light text-gray-900">Delete</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this profile? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setProfileToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

