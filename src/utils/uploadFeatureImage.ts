
import { supabase } from "@/integrations/supabase/client";
import { safeConsoleError } from '@/utils/safe-logging';
export const uploadFeatureImage = async (file: File, fileName: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('feature-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      safeConsoleError('Error uploading image:', error);
      return null;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('feature-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    safeConsoleError('Error uploading image:', error);
    return null;
  }
};
