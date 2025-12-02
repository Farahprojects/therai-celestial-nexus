
import { supabase } from '@/integrations/supabase/client';

export interface ImageData {
  url: string;
  filePath: string;
}

interface ImageUploadOptions {
  userId: string;
  section: 'header' | 'about' | 'service';
  serviceIndex?: number;
  existingImageData?: ImageData | string | null;
}

interface ImageEditOptions extends ImageUploadOptions {
  originalImageData: ImageData;
}

export class ImageManager {
  private static async deleteImageFromStorage(filePath: string): Promise<void> {
    console.log('Attempting to delete image from storage:', filePath);
    
    const { error } = await supabase.storage
      .from('website-images')
      .remove([filePath]);

    if (error) {
      console.error('Storage deletion error:', error);
      // Don't throw - file might already be deleted
    } else {
      console.log('Successfully deleted from storage:', filePath);
    }
  }

  private static extractFilePathFromUrl(imageUrl: string): string | null {
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf('website-images');
      
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
      
      return null;
    } catch (error) {
      console.error('Failed to extract file path from URL:', error);
      return null;
    }
  }

  private static getImageFilePath(imageData: ImageData | string | null): string | null {
    if (!imageData) return null;
    
    if (typeof imageData === 'object' && imageData.filePath) {
      return imageData.filePath;
    }
    
    if (typeof imageData === 'string') {
      return this.extractFilePathFromUrl(imageData);
    }
    
    if (typeof imageData === 'object' && imageData.url) {
      return this.extractFilePathFromUrl(imageData.url);
    }
    
    return null;
  }

  private static async cleanupOldImage(existingImageData: ImageData | string | null): Promise<void> {
    if (!existingImageData) return;
    
    const oldFilePath = this.getImageFilePath(existingImageData);
    if (oldFilePath) {
      await this.deleteImageFromStorage(oldFilePath);
    }
  }

  private static generateFilePath(userId: string, section: string, serviceIndex?: number, extension: string = 'jpg'): string {
    const timestamp = Date.now();
    const fileName = `${timestamp}.${extension}`;
    
    if (section === 'service' && serviceIndex !== undefined) {
      return `${userId}/${section}/${serviceIndex}/${fileName}`;
    }
    
    return `${userId}/${section}/${fileName}`;
  }

  static async uploadImage(file: File, options: ImageUploadOptions): Promise<ImageData> {
    const { userId, section, serviceIndex, existingImageData } = options;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file type. Please select an image file.');
    }
    
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File too large. Please select an image under 5MB.');
    }
    
    // Clean up old image before uploading new one
    await this.cleanupOldImage(existingImageData);
    
    try {
      // Generate new file path
      const fileExt = file.name.split('.').pop() || 'jpg';
      const newFilePath = this.generateFilePath(userId, section, serviceIndex, fileExt);
      
      console.log('Uploading to path:', newFilePath);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('website-images')
        .upload(newFilePath, file);
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('website-images')
        .getPublicUrl(data.path);
      
      return {
        url: urlData.publicUrl,
        filePath: data.path
      };
      
    } catch (error) {
      // If upload fails and we deleted an old image, we can't rollback
      // but we should log this for awareness
      console.error('Upload failed after old image deletion:', error);
      throw error;
    }
  }

  static async saveEditedImage(blob: Blob, options: ImageEditOptions): Promise<ImageData> {
    const { originalImageData } = options;
    
    try {
      // Generate new file path for edited image
      const originalPath = originalImageData.filePath;
      const pathParts = originalPath.split('.');
      const extension = pathParts.pop() || 'jpg';
      const nameWithoutExt = pathParts.join('.');
      const timestamp = Date.now();
      const newFilePath = `${nameWithoutExt}_edited_${timestamp}.${extension}`;
      
      console.log('Saving edited image to:', newFilePath);
      
      // Upload edited image
      const { data, error } = await supabase.storage
        .from('website-images')
        .upload(newFilePath, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: blob.type
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('website-images')
        .getPublicUrl(data.path);
      
      const newImageData: ImageData = {
        url: urlData.publicUrl,
        filePath: data.path
      };
      
      // Clean up original image after successful upload
      await this.deleteImageFromStorage(originalImageData.filePath);
      
      return newImageData;
      
    } catch (error) {
      console.error('Failed to save edited image:', error);
      throw error;
    }
  }

  static async deleteImage(imageData: ImageData | string | null): Promise<void> {
    await this.cleanupOldImage(imageData);
  }
}
