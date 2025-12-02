
export interface ImageData {
  url: string;
  filePath: string;
}

export const isValidImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  
  // Check if it's a valid URL format
  try {
    new URL(url);
  } catch {
    return false;
  }
  
  // Check if it has a valid image extension or is a data URL
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
  return url.startsWith('data:image/') || imageExtensions.test(url);
};

export const getValidImageUrl = (imageData: unknown): string | null => {
  // Handle new ImageData format
  if (imageData && typeof imageData === 'object' && imageData !== null && 'url' in imageData) {
    const url = (imageData as { url: unknown }).url;
    if (typeof url === 'string') {
      return isValidImageUrl(url) ? url : null;
    }
  }
  
  // Handle legacy string format
  if (typeof imageData === 'string') {
    return isValidImageUrl(imageData) ? imageData : null;
  }
  
  return null;
};

export const hasValidImage = (imageData: unknown): boolean => {
  return getValidImageUrl(imageData) !== null;
};
