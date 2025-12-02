
import { useEffect, useState } from 'react';
import { authService } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';


interface UseAuthGuardResult {
  isReady: boolean;
  hasValidAuth: boolean;
  error: string | null;
}

/**
 * Hook that ensures valid authentication before rendering protected content
 */
export const useAuthGuard = (pageName: string): UseAuthGuardResult => {
  const { user, session } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [hasValidAuth, setHasValidAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const verifyAuth = async () => {
      if (!user || !session) {
        if (mounted) {
          setHasValidAuth(false);
          setIsReady(true);
          setError('Not authenticated');
        }
        return;
      }

      try {
        // Ensure we have a valid session
        const validSession = await authService.ensureValidSession();
        if (!validSession) {
          if (mounted) {
            setHasValidAuth(false);
            setError('Invalid session');
          }
          return;
        }

        // Verify backend authentication
        const backendAuthValid = await authService.verifyBackendAuth();
        if (!backendAuthValid) {
          if (mounted) {
            setHasValidAuth(false);
            setError('Backend authentication failed');
          }
          return;
        }

        if (mounted) {
          setHasValidAuth(true);
          setError(null);
        }
      } catch {
        if (mounted) {
          setHasValidAuth(false);
          setError('Authentication verification failed');
        }
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    };

    verifyAuth();

    return () => {
      mounted = false;
    };
  }, [user, session, pageName]);

  return { isReady, hasValidAuth, error };
};
