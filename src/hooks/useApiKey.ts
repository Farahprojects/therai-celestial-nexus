//
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchApiKey, regenerateApiKey, disableApiKey } from '@/services/apikey';

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const { toast } = useToast();

  const loadApiKey = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Fetching API key from Supabase...");
      const result = await fetchApiKey();
      console.log("API key fetch result:", result);
      
      setApiKey(result.apiKey);
      setIsActive(result.isActive);
      setCreatedAt(result.createdAt);
    } catch (err) {
      console.error("Error in useApiKey.loadApiKey:", err);
      setError(err instanceof Error ? err : new Error('Failed to fetch API key'));
      toast({
        title: 'Error',
        description: 'Failed to load API key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Regenerating API key...");
      const result = await regenerateApiKey();
      console.log("API key regenerated:", result);
      
      setApiKey(result.apiKey);
      setIsActive(true);
      toast({
        title: 'Success',
        description: 'Your API key has been regenerated.',
      });
    } catch (err) {
      console.error("Error in useApiKey.handleRegenerateApiKey:", err);
      setError(err instanceof Error ? err : new Error('Failed to regenerate API key'));
      toast({
        title: 'Error',
        description: 'Failed to regenerate API key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleApiKey = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Toggling API key active state to:", !isActive);
      const result = await disableApiKey(!isActive);
      console.log("API key toggle result:", result);
      
      setIsActive(result.isActive);
      toast({
        title: 'Success',
        description: result.isActive 
          ? 'Your API key has been activated.' 
          : 'Your API key has been revoked.',
      });
    } catch (err) {
      console.error("Error in useApiKey.handleToggleApiKey:", err);
      setError(err instanceof Error ? err : new Error('Failed to update API key status'));
      toast({
        title: 'Error',
        description: 'Failed to update API key status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApiKey();
  }, []);

  return {
    apiKey,
    isActive,
    isLoading,
    error,
    createdAt,
    regenerateApiKey: handleRegenerateApiKey,
    toggleApiKey: handleToggleApiKey,
    refreshApiKey: loadApiKey,
  };
}
