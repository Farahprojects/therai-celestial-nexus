import { supabase } from '@/integrations/supabase/client';

/**
 * Normalizes storage URLs to use the correct Supabase domain and removes double slashes
 */
export const normalizeStorageUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  
  // If it's already using the correct domain, just fix double slashes
  if (url.includes('api.therai.co')) {
    return url.replace(/\/\/+/g, '/').replace(':/', '://');
  }
  
  // Extract the storage path from external URLs
  const storageMatch = url.match(/\/storage\/v1\/object\/public\/([^?]+)/);
  if (storageMatch) {
    const [, fullPath] = storageMatch;
    const pathParts = fullPath.split('/');
    const bucketName = pathParts[0];
    const filePath = pathParts.slice(1).join('/').replace(/\/+/g, '/'); // Remove double slashes
    
    // Use Supabase client to get the correct public URL
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  }
  
  return url;
};