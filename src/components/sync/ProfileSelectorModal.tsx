import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, User, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError } from '@/utils/safe-logging';
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
  const [searchQuery, setSearchQuery] = useState('');
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
      safeConsoleError('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter profiles based on search query
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    
    const query = searchQuery.toLowerCase();
    return profiles.filter(profile => 
      profile.name.toLowerCase().includes(query) ||
      profile.profile_name.toLowerCase().includes(query) ||
      profile.birth_location.toLowerCase().includes(query)
    );
  }, [profiles, searchQuery]);

  const handleSelect = (profile: Profile) => {
    setSelectedProfile(profile);
  };

  const handleNext = () => {
    if (selectedProfile) {
      onSelect(selectedProfile);
    }
  };

  if (!isOpen) return null;

  const showSearch = profiles.length > 5;

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

        {/* Search (if needed) */}
        {showSearch && (
          <div className="px-6 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search profiles..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>
          </div>
        )}

        {/* Profile List */}
        <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-light mb-1">
                {searchQuery ? 'No profiles found' : 'No saved profiles'}
              </p>
              <p className="text-sm text-gray-400 font-light">
                {searchQuery ? 'Try a different search' : 'Create profiles in Settings to use Sync Score'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredProfiles.map((profile) => (
                  <motion.button
                    key={profile.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleSelect(profile)}
                    className={`
                      w-full px-4 py-3 rounded-2xl text-left transition-all
                      ${selectedProfile?.id === profile.id
                        ? 'bg-purple-50 border-2 border-purple-500 shadow-sm'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-medium
                        ${selectedProfile?.id === profile.id
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-white text-gray-600'
                        }
                      `}>
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
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center"
                        >
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <Button
            onClick={handleNext}
            disabled={!selectedProfile || isGenerating}
            className="w-full rounded-full py-6 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:!text-black text-white font-light transition-all"
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
      </motion.div>
    </div>
  );
};

