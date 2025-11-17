import { useEffect, useState } from 'react';
import { checkAdminRole } from '../lib/adminAuth';

export function useAdminRole(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkRole() {
      if (!userId) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const result = await checkAdminRole(userId);
        setIsAdmin(result);
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkRole();
  }, [userId]);

  return { isAdmin, isLoading };
}









