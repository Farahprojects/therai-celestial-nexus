
import { supabase } from "@/integrations/supabase/client";

export const uploadFeatureImage = async (file: File, fileName: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('feature-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('feature-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
};
