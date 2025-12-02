
import { supabase } from '@/integrations/supabase/client';

export interface LogErrorPayload {
  chatId?: string;
  errorType: string;
  errorMessage?: string;
  timestamp?: string;
}

const loggedErrors = new Set<string>();

export async function logUserError(payload: LogErrorPayload): Promise<string | null> {
  const errorKey = `${payload.chatId}-${payload.errorType}`;
  
  // Prevent duplicate logging
  if (loggedErrors.has(errorKey)) {
    return null;
  }

  try {
    loggedErrors.add(errorKey);

    const { data, error } = await supabase.functions.invoke('log-user-error', {
      body: {
        errorType: payload.errorType,
        errorMessage: payload.errorMessage,
        timestamp: payload.timestamp || new Date().toISOString()
      }
    });

    if (error) {
      console.warn('Failed to log user error:', error.message);
      loggedErrors.delete(errorKey);
      return null;
    }

    if (data?.is_duplicate) {
      return data.case_number;
    }

    return data?.case_number || 'CASE-' + Date.now();
  } catch (err) {
    console.error('Error logging user error:', err);
    loggedErrors.delete(errorKey);
    return null;
  }
}
