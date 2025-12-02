
import { supabase } from "@/integrations/supabase/client";

interface StorageImages {
  headerImageUrl?: string;
  aboutImageUrl?: string;
  serviceImages: { [index: number]: string };
}

export const loadImagesFromStorage = async (userId: string): Promise<StorageImages> => {
  const result: StorageImages = {
    serviceImages: {}
  };

  try {
    // Check header folder
    try {
      const { data: headerFiles, error: headerError } = await supabase.storage
        .from('website-images')
        .list(`${userId}/header`, {
          limit: 10,
          offset: 0
        });

      if (!headerError && headerFiles && headerFiles.length > 0) {
        const headerFile = headerFiles.find(file => 
          file.name && file.name !== '.emptyFolderPlaceholder'
        );
        
        if (headerFile) {
          const filePath = `${userId}/header/${headerFile.name}`;
          const { data: urlData } = supabase.storage
            .from('website-images')
            .getPublicUrl(filePath);
          
          if (urlData?.publicUrl) {
            result.headerImageUrl = urlData.publicUrl;
          }
        }
      }
    } catch {
      console.log('No header folder found or error accessing it');
    }

    // Check about folder
    try {
      const { data: aboutFiles, error: aboutError } = await supabase.storage
        .from('website-images')
        .list(`${userId}/about`, {
          limit: 10,
          offset: 0
        });

      if (!aboutError && aboutFiles && aboutFiles.length > 0) {
        const aboutFile = aboutFiles.find(file => 
          file.name && file.name !== '.emptyFolderPlaceholder'
        );
        
        if (aboutFile) {
          const filePath = `${userId}/about/${aboutFile.name}`;
          const { data: urlData } = supabase.storage
            .from('website-images')
            .getPublicUrl(filePath);
          
          if (urlData?.publicUrl) {
            result.aboutImageUrl = urlData.publicUrl;
          }
        }
      }
    } catch {
      console.log('No about folder found or error accessing it');
    }

    // Check service folders (0-9)
    for (let i = 0; i < 10; i++) {
      try {
        const { data: serviceFiles, error: serviceError } = await supabase.storage
          .from('website-images')
          .list(`${userId}/service/${i}`, {
            limit: 10,
            offset: 0
          });

        if (!serviceError && serviceFiles && serviceFiles.length > 0) {
          const serviceFile = serviceFiles.find(file => 
            file.name && file.name !== '.emptyFolderPlaceholder'
          );
          
          if (serviceFile) {
            const filePath = `${userId}/service/${i}/${serviceFile.name}`;
            const { data: urlData } = supabase.storage
              .from('website-images')
              .getPublicUrl(filePath);
            
            if (urlData?.publicUrl) {
              result.serviceImages[i] = urlData.publicUrl;
            }
          }
        }
      } catch {
        // Continue to next service index if this one doesn't exist
        continue;
      }
    }

    console.log('Loaded images from storage:', result);
    return result;

  } catch (error) {
    console.error('Error loading images from storage:', error);
    return result;
  }
};
