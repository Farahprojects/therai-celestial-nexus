
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/notifications";
import { useAuth } from "@/contexts/AuthContext";

type ViewMode = 'grid' | 'list';

interface UseClientViewModeReturn {
  viewMode: ViewMode | null;
  loading: boolean;
  updateViewMode: (newMode: ViewMode) => Promise<boolean>;
  error: string | null;
}

export function useClientViewMode(): UseClientViewModeReturn {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  // Load the current view mode from database
  const loadViewMode = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("user_preferences")
        .select("client_view_mode")
        .eq("user_id", user.id)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          // No preferences found - return null to indicate default should be used
          setViewMode(null);
        } else {
          throw fetchError;
        }
      } else {
        // Properly type the client_view_mode value
        const savedMode = data?.client_view_mode as ViewMode | null;
        setViewMode(savedMode);
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load view preference";
      setError(errorMessage);
      console.error("Error loading client view mode:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Update view mode in database
  const updateViewMode = useCallback(async (newMode: ViewMode): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      setError(null);

      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            client_view_mode: newMode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      // Update local state immediately after successful DB update
      setViewMode(newMode);
      
      return true;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to save view preference";
      setError(errorMessage);
      console.error("Error updating client view mode:", err);
      
      showToast({
        title: "Error",
        description: "Failed to save view preference. Please try again.",
        variant: "destructive",
      });
      
      return false;
    }
  }, [user?.id]);

  // Load view mode on mount and when user changes
  useEffect(() => {
    loadViewMode();
  }, [loadViewMode]);

  return {
    viewMode,
    loading,
    updateViewMode,
    error,
  };
}
