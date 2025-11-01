
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeStorageUrl } from '@/utils/storageUtils';

interface LandingPageConfig {
  id: string;
  feature_images: Record<string, string>;
  features_images: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export const useLandingPageImages = () => {
  return useQuery({
    queryKey: ['landing-page-images'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_page_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching landing page config:', error);
        // Return default images if no config exists
        return {
          id: '',
          feature_images: {
            "0": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
            "1": "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=800&h=600&fit=crop",
            "2": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop"
          },
          features_images: {
            "0": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
            "1": normalizeStorageUrl("https://api.therai.co/storage/v1/object/public/feature-images/Imagine2/Screenshot%202025-06-10%20at%206.57.31%20PM.png"),
            "2": "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=800&h=600&fit=crop",
            "3": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop"
          },
          created_at: '',
          updated_at: ''
        } as LandingPageConfig;
      }

      return data as LandingPageConfig;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
