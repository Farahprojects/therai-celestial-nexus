import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/notifications";
import { useAuth } from "@/contexts/AuthContext";
import { useChatStore } from "@/core/store";

// ============================================================================
// INTERFACES
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  email_verified: boolean;
  display_name?: string | null; // Optional until DB schema is updated
  subscription_active: boolean;
  subscription_plan: string;
  subscription_status: string;
  stripe_customer_id?: string;
  created_at: string;
  last_seen_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  email_notifications_enabled: boolean;
  client_view_mode: 'grid' | 'list';
  tts_voice?: string; // Optional until DB schema is updated
  created_at: string;
  updated_at: string;
}

// Removed PaymentMethod and UserCredits interfaces - not using payment/credits features

export interface UserData {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

interface UpdateOptions {
  showToast?: boolean;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const getDefaultPreferences = (userId: string): UserPreferences => ({
  id: '',
  user_id: userId,
  email_notifications_enabled: true,
  client_view_mode: 'grid',
  tts_voice: 'Puck',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const getDefaultProfile = (userId: string, email: string): UserProfile => ({
  id: userId,
  email: email,
  email_verified: false,
  display_name: null,
  subscription_active: false,
  subscription_plan: '',
  subscription_status: '',
  created_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
});

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useUserData() {
  const { user } = useAuth();
  const [data, setData] = useState<UserData>({
    profile: null,
    preferences: null,
    loading: false,
    saving: false,
    error: null,
  });
  
  const [retryCount, setRetryCount] = useState(0);
  
  // Initialize with optimistic defaults
  useEffect(() => {
    if (user) {
      setData(prev => ({
        ...prev,
        profile: prev.profile || getDefaultProfile(user.id, user.email || ''),
        preferences: prev.preferences || getDefaultPreferences(user.id),
      }));
    } else {
      setData({
        profile: null,
        preferences: null,
        loading: false,
        saving: false,
        error: null,
      });
    }
  }, [user]);

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  const fetchUserData = useCallback(async (force = false) => {
    if (!user?.id) {
      setData(prev => ({
        ...prev,
        loading: false,
        profile: null,
        preferences: null,
      }));
      return;
    }

    // Don't refetch if we already have data unless forced
    if (!force && data.profile && data.preferences) {
      return;
    }

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Fetch profile and preferences data in parallel
      const [profileResult, preferencesResult] = await Promise.all([
        // Fetch user profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),
        
        // Fetch user preferences
        supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single(),
      ]);

      setData({
        profile: (profileResult.data as UserProfile) || getDefaultProfile(user.id, user.email || ''),
        preferences: (preferencesResult.data as UserPreferences) || getDefaultPreferences(user.id),
        loading: false,
        saving: false,
        error: null,
      });

      // Sync TTS voice into chat store for conversation mode
      try {
        const voice = (preferencesResult.data as any)?.tts_voice || getDefaultPreferences(user.id).tts_voice;
        useChatStore.getState().setTtsVoice(voice);
      } catch {}

      setRetryCount(0);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch user data',
      }));
    }
  }, [user, data.profile, data.preferences]);

  // ============================================================================
  // UPDATE FUNCTIONS
  // ============================================================================

  const updateDisplayName = useCallback(async (newDisplayName: string, options: UpdateOptions = {}) => {
    if (!user?.id) return { error: 'No user' };

    setData(prev => ({ ...prev, saving: true, error: null }));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: newDisplayName } as any) // Type assertion until DB schema is updated
        .eq('id', user.id);

      if (error) {
        console.error('Error updating display name:', error);
        setData(prev => ({ ...prev, saving: false, error: error.message }));
        return { error };
      }

      // Update local state
      setData(prev => ({
        ...prev,
        profile: prev.profile ? { ...prev.profile, display_name: newDisplayName } : null,
        saving: false,
      }));

      if (options.showToast !== false) {
        showToast({
          title: "Success",
          description: "Display name updated successfully",
          variant: "success",
        });
      }

      return { error: null };
    } catch (err) {
      console.error('Error updating display name:', err);
      setData(prev => ({ ...prev, saving: false, error: 'Failed to update display name' }));
      return { error: err };
    }
  }, [user]);

  const updateMainNotificationsToggle = useCallback(async (enabled: boolean, options: UpdateOptions = {}) => {
    if (!user?.id || !data.preferences) return { error: 'No user or preferences' };

    setData(prev => ({ ...prev, saving: true, error: null }));

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ email_notifications_enabled: enabled })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating notifications:', error);
        setData(prev => ({ ...prev, saving: false, error: error.message }));
        return { error };
      }

      // Update local state
      setData(prev => ({
        ...prev,
        preferences: prev.preferences ? { ...prev.preferences, email_notifications_enabled: enabled } : null,
        saving: false,
      }));

      if (options.showToast !== false) {
        showToast({
          title: "Success",
          description: `Email notifications ${enabled ? 'enabled' : 'disabled'}`,
          variant: "success",
        });
      }

      return { error: null };
    } catch (err) {
      console.error('Error updating notifications:', err);
      setData(prev => ({ ...prev, saving: false, error: 'Failed to update notifications' }));
      return { error: err };
    }
  }, [user, data.preferences]);

  const updateClientViewMode = useCallback(async (mode: 'grid' | 'list', options: UpdateOptions = {}) => {
    if (!user?.id || !data.preferences) return { error: 'No user or preferences' };

    setData(prev => ({ ...prev, saving: true, error: null }));

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ client_view_mode: mode })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating view mode:', error);
        setData(prev => ({ ...prev, saving: false, error: error.message }));
        return { error };
      }

      // Update local state
      setData(prev => ({
        ...prev,
        preferences: prev.preferences ? { ...prev.preferences, client_view_mode: mode } : null,
        saving: false,
      }));

      if (options.showToast !== false) {
        showToast({
          title: "Success",
          description: `View mode updated to ${mode}`,
          variant: "success",
        });
      }

      return { error: null };
    } catch (err) {
      console.error('Error updating view mode:', err);
      setData(prev => ({ ...prev, saving: false, error: 'Failed to update view mode' }));
      return { error: err };
    }
  }, [user, data.preferences]);

  const updateTtsVoice = useCallback(async (voice: string, options: UpdateOptions = {}) => {
    if (!user?.id || !data.preferences) return { error: 'No user or preferences' };

    setData(prev => ({ ...prev, saving: true, error: null }));

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ tts_voice: voice } as any) // Type assertion until DB schema is updated
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating TTS voice:', error);
        setData(prev => ({ ...prev, saving: false, error: error.message }));
        return { error };
      }

      // Update local state
      setData(prev => ({
        ...prev,
        preferences: prev.preferences ? { ...prev.preferences, tts_voice: voice } : null,
        saving: false,
      }));

      // Update chat store immediately so conversation mode picks it up
      try { useChatStore.getState().setTtsVoice(voice); } catch {}

      if (options.showToast !== false) {
        showToast({
          title: "Success",
          description: `Voice updated to ${voice}`,
          variant: "success",
        });
      }

      return { error: null };
    } catch (err) {
      console.error('Error updating TTS voice:', err);
      setData(prev => ({ ...prev, saving: false, error: 'Failed to update voice' }));
      return { error: err };
    }
  }, [user, data.preferences]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getDisplayName = useCallback(() => {
    if (!data.profile) return user?.email?.split('@')[0] || 'User';
    return data.profile.display_name || user?.email?.split('@')[0] || 'User';
  }, [data.profile, user?.email]);

  const refresh = useCallback((opts?: { force?: boolean }) => {
    return fetchUserData(opts?.force);
  }, [fetchUserData]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Auto-retry on error
  useEffect(() => {
    if (data.error && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchUserData(true);
      }, 1000 * Math.pow(2, retryCount)); // Exponential backoff

      return () => clearTimeout(timer);
    }
  }, [data.error, retryCount, fetchUserData]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // Data
    ...data,
    
    // Computed values
    displayName: getDisplayName(),
    
    // Update functions
    updateDisplayName,
    updateMainNotificationsToggle,
    updateClientViewMode,
    updateTtsVoice,
    
    // Utility functions
    refresh,
    fetchData: fetchUserData,
  };
}
