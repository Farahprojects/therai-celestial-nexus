
import { uploadFeatureImage } from './uploadFeatureImage';
import { safeConsoleError } from '@/utils/safe-logging';
export const saveUploadedImageToBucket = async (imageUrl: string, fileName: string) => {
  try {
    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }
    
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });
    
    // Upload to bucket
    const uploadedUrl = await uploadFeatureImage(file, fileName);
    
    if (uploadedUrl) {
      console.log('Image successfully saved to bucket:', uploadedUrl);
      return uploadedUrl;
    } else {
      throw new Error('Failed to upload image to bucket');
    }
  } catch (error) {
    safeConsoleError('Error saving image to bucket:', error);
    return null;
  }
};

/**
 * Auto-save the uploaded dotted circle image (only call this when needed, not at import time)
 */
export const autoSaveDottedCircleImage = async (): Promise<string | null> => {
  const imagePath = '/placeholder.svg';
  const fileName = 'dotted-circle-logo.png';

  try {
    const url = await saveUploadedImageToBucket(imagePath, fileName);
    if (url) {
      console.log('Dotted circle image saved successfully:', url);
      return url;
    }
    return null;
  } catch (error) {
    safeConsoleError('Failed to save dotted circle image:', error);
    return null;
  }
};
