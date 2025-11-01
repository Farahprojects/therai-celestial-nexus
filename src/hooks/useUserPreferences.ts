import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPreferences {
  id: string;
  user_id: string;
  email_notifications_enabled: boolean;
  client_view_mode: 'grid' | 'list';
  tts_voice: string;
  created_at: string;
  updated_at: string;
}

// Notification toggles are no longer used - only main email toggle exists
export type NotificationToggleType = never;

interface UpdateOptions {
  showToast?: boolean;
}

// Default preferences for optimistic loading
const getDefaultPreferences = (userId: string): UserPreferences => ({
  id: '',
  user_id: userId,
  email_notifications_enabled: true,
  client_view_mode: 'grid',
  tts_voice: 'Puck',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(
    user ? getDefaultPreferences(user.id) : null
  );
  const [loading, setLoading] = useState(false); // Start with false for optimistic loading
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  
  // Track user initiated changes to prevent real-time updates from overriding them
  const pendingChangesRef = useRef<Map<string, boolean | string>>(new Map());
  // Track the timestamp of the last user update to ignore real-time events too close to it
  const lastUpdateTimestampRef = useRef<number>(0);
  // Track if component is mounted
  const isMountedRef = useRef(true);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Function to check if a component is still mounted
  const isMounted = useCallback(() => {
    return isMountedRef.current;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let loadTimeout: NodeJS.Timeout;

    const loadUserPreferences = async () => {
      if (!user?.id) {
        if (isMounted()) {
          setError("Authentication required");
        }
        return;
      }

      try {
        loadTimeout = setTimeout(() => {
          if (isMounted()) {
            setError("Request timed out. Please try again.");
          }
        }, 8000);

        const { data, error: fetchError } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id as any)
          .single();

        clearTimeout(loadTimeout);

        if (fetchError) {
          if (fetchError.code === "PGRST116") {
            await createDefaultPreferences(user.id);
          } else {
            throw fetchError;
          }
        } else if (data && isMounted()) {
          setPreferences(data as UserPreferences);
        }
      } catch (err: any) {
        clearTimeout(loadTimeout);
        const errorMessage = err.message || "Failed to load preferences";

        if (isMounted()) {
          setError(errorMessage);

          if (!errorMessage.includes("timed out")) {
            toast({
              title: "Error Loading Preferences",
              description:
                "There was a problem loading your notification settings",
              variant: "destructive",
            });
          }

          if (retryCount < 3) {
            const retryDelay = Math.min(2000 * (retryCount + 1), 6000);
            
            // Clear any existing retry timeout
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            
            retryTimeoutRef.current = setTimeout(() => {
              setRetryCount((prev) => prev + 1);
              loadUserPreferences();
            }, retryDelay);
          }
        }
      }
    };

    // Removed realtime listener - user_preferences broadcasts are disabled
    // Preferences are loaded once on mount and saved optimistically
    
    loadUserPreferences();

    return () => {
      isMountedRef.current = false;
      clearTimeout(loadTimeout);
      
      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      // No channel cleanup needed - realtime listener removed
    };
  }, [user, toast, isMounted, retryCount]);

  const createDefaultPreferences = async (userId: string) => {
    try {
      const defaultPrefs = {
        user_id: userId,
        email_notifications_enabled: true,
        client_view_mode: 'grid' as const,
        tts_voice: 'Puck',
      };

      const { data, error } = await supabase
        .from("user_preferences")
        .insert(defaultPrefs)
        .select()
        .single();

      if (error) throw error;
      if (isMounted()) setPreferences(data as UserPreferences);

    } catch (err: any) {
      console.error("Failed to create default preferences:", err);
    }
  };

  const updateMainNotificationsToggle = async (
    enabled: boolean,
    options: UpdateOptions = {}
  ) => {
    if (!user?.id || !preferences) return false;

    const { showToast = true } = options;
    
    // Record this change as pending
    pendingChangesRef.current.set("email_notifications_enabled", enabled);
    // Record the timestamp of this update
    lastUpdateTimestampRef.current = Date.now();

    // Optimistically update UI
    setPreferences((prev) =>
      prev
        ? {
            ...prev,
            email_notifications_enabled: enabled,
          }
        : null
    );

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          email_notifications_enabled: enabled,
          client_view_mode: preferences.client_view_mode,
          tts_voice: preferences.tts_voice,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      if (showToast) {
        toast({
          title: "Preferences Saved",
          description: `Email notifications ${
            enabled ? "enabled" : "disabled"
          }`,
        });
      }

      // After successful update, we can remove this change from pending changes
      pendingChangesRef.current.delete("email_notifications_enabled");
      
      return true;
    } catch (err: any) {
      console.error("Error updating main toggle:", err);
      
      // Revert optimistic update on error
      if (isMounted()) {
        setPreferences((prev) => {
          if (!prev) return null;
          return {
            ...prev, 
            email_notifications_enabled: !enabled
          };
        });
        
        if (showToast) {
          toast({
            title: "Error",
            description: "There was an issue saving your preference.",
            variant: "destructive",
          });
        }
      }
      
      // Remove from pending changes on error
      pendingChangesRef.current.delete("email_notifications_enabled");
      
      return false;
    } finally {
      if (isMounted()) {
        setSaving(false);
      }
    }
  };

  // Notification toggles removed - only main email toggle exists now
  const updateNotificationToggle = async (
    type: NotificationToggleType,
    enabled: boolean,
    options: UpdateOptions = {}
  ) => {
    // This function is no longer used but kept for backward compatibility
    console.warn('updateNotificationToggle is deprecated - use updateMainNotificationsToggle instead');
    return false;
  };

  const updateClientViewMode = async (
    viewMode: 'grid' | 'list',
    options: UpdateOptions = {}
  ) => {
    if (!user?.id || !preferences) return false;

    const { showToast = false } = options;

    // Record this change as pending
    pendingChangesRef.current.set("client_view_mode", viewMode);
    // Record the timestamp of this update
    lastUpdateTimestampRef.current = Date.now();

    // Optimistically update UI
    setPreferences((prev) =>
      prev
        ? {
            ...prev,
            client_view_mode: viewMode,
          }
        : null
    );

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          email_notifications_enabled: preferences.email_notifications_enabled,
          client_view_mode: viewMode,
          tts_voice: preferences.tts_voice,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      if (showToast) {
        toast({
          title: "View Mode Updated",
          description: `Client view changed to ${viewMode}`,
        });
      }

      // After successful update, we can remove this change from pending changes
      pendingChangesRef.current.delete("client_view_mode");
      
      return true;
    } catch (err: any) {
      console.error("Error updating client view mode:", err);
      
      // Revert optimistic update on error
      if (isMounted()) {
        setPreferences((prev) => {
          if (!prev) return null;
          return {
            ...prev, 
            client_view_mode: viewMode === 'grid' ? 'list' : 'grid'
          };
        });
        
        if (showToast) {
          toast({
            title: "Error",
            description: "There was an issue saving your view preference.",
            variant: "destructive",
          });
        }
      }
      
      // Remove from pending changes on error
      pendingChangesRef.current.delete("client_view_mode");
      
      return false;
    } finally {
      if (isMounted()) {
        setSaving(false);
      }
    }
  };

  return {
    preferences,
    loading,
    saving,
    error,
    updateMainNotificationsToggle,
    updateNotificationToggle,
    updateClientViewMode,
  };
}

// Helper function to format notification type names for display (deprecated)
export const formatNotificationTypeName = (type: NotificationToggleType): string => {
  return 'Notifications';
};

export default useUserPreferences;