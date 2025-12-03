import React, { useState, useEffect } from 'react';
import { X, User, Heart, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  profile_name: string;
  name: string;
  birth_date: string;
  birth_time: string;
  birth_location: string;
  birth_latitude: number | null;
  birth_longitude: number | null;
  birth_place_id: string | null;
  timezone: string | null;
  house_system: string | null;
  is_primary: boolean;
}

interface ProfileSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profile: Profile) => void;
  isGenerating?: boolean;
}

export const ProfileSelectorModal: React.FC<ProfileSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  isGenerating = false,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
    }
  }, [isOpen]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profile_list')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter out the user's primary profile (we'll use that automatically)
      const otherProfiles = (data || []).filter(p => !p.is_primary);
      setProfiles(otherProfiles);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleSelect = (profile: Profile) => {
    setSelectedProfile(profile);
  };

  const handleNext = () => {
    if (selectedProfile) {
      onSelect(selectedProfile);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Heart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-light text-gray-900">
                Sync Score
              </h2>
              <p className="text-sm text-gray-500 font-light">
                Choose a connection
              </p>
            </div>
          </div>
        </div>

        {/* Profile Selector */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-light mb-1">No saved profiles</p>
              <p className="text-sm text-gray-400 font-light">
                Create profiles in Settings to use Sync Score
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Profile
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-left flex items-center justify-between hover:bg-gray-100 transition-colors">
                      <span className={selectedProfile ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedProfile ? selectedProfile.name : 'Choose a profile...'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                    {profiles.map((profile) => (
                      <DropdownMenuItem
                        key={profile.id}
                        onClick={() => handleSelect(profile)}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-medium text-purple-700 text-sm">
                          {profile.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {profile.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {profile.birth_location}
                          </p>
                        </div>
                        {selectedProfile?.id === profile.id && (
                          <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isGenerating}
              className="flex-1 rounded-full py-6 border-gray-300 text-gray-700 hover:bg-gray-50 font-light transition-all"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNext}
              disabled={!selectedProfile || isGenerating}
              className="flex-1 rounded-full py-6 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:!text-black text-white font-light transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

