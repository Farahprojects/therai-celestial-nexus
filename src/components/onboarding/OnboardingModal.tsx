import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, User, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { ReportFormData } from '@/types/public-report';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

const extractId = (value: unknown): string | null => {
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
};

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

type OnboardingStep = 'name' | 'profile' | 'subscription';

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('name');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Step 1: Display Name
  const handleDisplayNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!user?.id) {
      toast.error('Please sign in again');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() } satisfies TablesUpdate<'profiles'>)
        .eq('id' as never, user.id);

      if (error) throw error;

      setCurrentStep('profile');
    } catch (error) {
      console.error('Error updating display name:', error);
      toast.error('Failed to save name. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Astro Profile
  const handleAstroFormSubmit = async (data: ReportFormData) => {
    if (!user?.id) {
      toast.error('Please sign in again');
      return;
    }

    setIsLoading(true);
    try {
      // Check if primary profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profile_list')
        .select('id')
        .eq('user_id' as never, user.id)
        .eq('is_primary' as never, true)
        .maybeSingle();
      
      // Ignore "not found" errors - that's fine, we'll insert
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const profileInsertData: TablesInsert<'user_profile_list'> = {
        user_id: user.id,
        profile_name: 'My Main Profile',
        name: data.name,
        birth_date: data.birthDate,
        birth_time: data.birthTime,
        birth_location: data.birthLocation,
        birth_latitude: data.birthLatitude ?? null,
        birth_longitude: data.birthLongitude ?? null,
        birth_place_id: data.birthPlaceId ?? null,
        timezone: data.birthLocation,
        house_system: 'placidus',
        is_primary: true,
      };

      const profileUpdateData: TablesUpdate<'user_profile_list'> = {
        ...profileInsertData,
      };

      // Update existing primary profile or insert new one
      let profileError;
      const existingProfileId = extractId(existingProfile);

      if (existingProfileId) {
        // Update existing primary profile
        const { error } = await supabase
          .from('user_profile_list')
          .update(profileUpdateData)
          .eq('id' as never, existingProfileId);
        profileError = error;
      } else {
        // Insert new primary profile
        const { error } = await supabase
          .from('user_profile_list')
          .insert([profileInsertData]);
        profileError = error;
      }

      if (profileError) throw profileError;

      // Get the profile_id for memory linking
      const { data: createdProfile } = await supabase
        .from('user_profile_list')
        .select('id')
        .eq('user_id' as never, user.id)
        .eq('is_primary' as never, true)
        .maybeSingle();

      const createdProfileId = extractId(createdProfile) ?? existingProfileId;

      // Create conversation with profile_mode flag to generate chart data
      // Convert camelCase to snake_case and structure as person_a (same as buildReportPayload)
      const { data: conversation, error: convError } = await supabase.functions.invoke(
        'conversation-manager?action=create_conversation',
        {
          body: {
            user_id: user.id,
            title: 'Profile',
            mode: 'profile', // Set mode to "profile"
            profile_mode: true, // KEY FLAG
            profile_id: createdProfileId,
            report_data: {
              request: 'essence', // translator-edge requires 'request' field
              // Note: reportType is NOT included - it's only for insights mode, not profile mode
              person_a: {
                name: data.name,
                birth_date: data.birthDate, // snake_case
                birth_time: data.birthTime, // snake_case
                location: data.birthLocation,
                latitude: data.birthLatitude,
                longitude: data.birthLongitude,
              },
            }
          }
        }
      );

      if (convError) throw convError;

      // conversation-manager will:
      // 1. Create conversation with title="Profile" and mode="profile"
      // 2. Skip messages table
      // 3. Call translator-edge with chat_id
      // 4. translator-edge saves to translator_logs (existing behavior)
      // 5. translator-edge skips messages table (profile_mode)
      // Note: Folder creation is handled in AstroDataForm.tsx in parallel with profile creation

      toast.success('Profile created successfully!');
      setCurrentStep('subscription');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Subscription (or skip)
  const markOnboardingComplete = async () => {
    try {
      if (!user?.id) {
        toast.error('Please sign in again');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ has_profile_setup: true } satisfies TablesUpdate<'profiles'>)
        .eq('id' as never, user.id);

      if (error) throw error;

      onComplete();
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
      toast.error('Something went wrong. Please try again.');
    }
  };

  const handleSubscribe = () => {
    markOnboardingComplete();
    navigate('/subscription-paywall');
  };

  const handleSkipSubscription = () => {
    markOnboardingComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl"
      >
        <AnimatePresence mode="wait">
          {currentStep === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              {/* Header */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <User size={20} className="text-gray-600" />
                </div>
                <h2 className="text-2xl font-light text-gray-900">Welcome to Therai</h2>
                <p className="text-sm font-light text-gray-600 mt-1">Let's get to know you</p>
              </div>

              {/* Form */}
              <form onSubmit={handleDisplayNameSubmit} className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-light text-gray-700 mb-2 text-center">
                    What should we call you?
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-6 py-3 rounded-full border border-gray-200 text-base font-light focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-center"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !displayName.trim()}
                  className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-base font-light transition-colors"
                >
                  {isLoading ? 'Saving...' : 'Continue'}
                </Button>
              </form>
            </motion.div>
          )}

          {currentStep === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              {/* Header */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Sparkles size={20} className="text-gray-600" />
                </div>
                <h2 className="text-xl font-light text-gray-900">Create Your Main Profile</h2>
                <p className="text-sm font-light text-gray-600 mt-1">
                  For personalized insights and Together Mode
                </p>
              </div>

              {/* Astro Form */}
              <div className="-mx-8">
                <AstroDataForm
                  onClose={() => {}} // Can't close during onboarding
                  onSubmit={handleAstroFormSubmit}
                  preselectedType="essence"
                  reportType="essence"
                  isProfileFlow={true}
                  mode="astro"
                  defaultName={displayName}
                />
              </div>
            </motion.div>
          )}

          {currentStep === 'subscription' && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              {/* Header */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <CreditCard size={20} className="text-gray-600" />
                </div>
                <h2 className="text-xl font-light text-gray-900">Unlock Full Access</h2>
                <p className="text-sm font-light text-gray-600 mt-1">
                  Get unlimited access to all features
                </p>
              </div>

              {/* Content */}
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
                  <h3 className="text-base font-light text-gray-900 text-center">With a subscription:</h3>
                  <ul className="space-y-2 text-sm font-light text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>Unlimited conversations and insights</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>Together Mode for relationship analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>Advanced astrology charts and reports</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>Priority support</span>
                    </li>
                  </ul>
                </div>

                {/* Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={handleSubscribe}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-base font-light transition-colors"
                  >
                    View Plans
                  </Button>
                  <Button
                    onClick={handleSkipSubscription}
                    variant="ghost"
                    className="w-full py-3 text-gray-600 hover:bg-gray-50 rounded-full text-base font-light transition-colors"
                  >
                    Skip for Now
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

