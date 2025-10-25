import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SwissDataResult {
  isLoading: boolean;
  swissData: any | null;
  error: string | null;
}

/**
 * Poll translator_logs for Swiss data generation completion
 * Polls every 1 second until data is found or max attempts reached
 */
export const useSwissDataPolling = (chatId: string | null, enabled: boolean = true): SwissDataResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [swissData, setSwissData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId || !enabled || swissData) return;

    let pollInterval: number | null = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    const pollForData = async () => {
      try {
        attempts++;
        
        const { data, error: fetchError } = await supabase
          .from('translator_logs')
          .select('swiss_data, swiss_error, error_message, created_at')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          setError('Failed to fetch Swiss data');
          setIsLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        if (data) {
          
          // Check if there was an error
          if (data.swiss_error) {
            setError(data.error_message || 'Swiss data generation failed');
            setIsLoading(false);
            if (pollInterval) clearInterval(pollInterval);
            return;
          }

          // Success - data is ready
          setSwissData(data.swiss_data);
          setIsLoading(false);
          if (pollInterval) clearInterval(pollInterval);
        } else {
          if (attempts >= maxAttempts) {
            setError('Data generation timed out');
            setIsLoading(false);
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      } catch (err) {
        setError('Error polling for data');
        setIsLoading(false);
        if (pollInterval) clearInterval(pollInterval);
      }
    };

    // Start polling
    setIsLoading(true);
    setError(null);
    
    // Immediate first check
    pollForData();
    
    // Then poll every second
    pollInterval = window.setInterval(pollForData, 1000);

    // Cleanup
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [chatId, enabled, swissData]);

  return { isLoading, swissData, error };
};

