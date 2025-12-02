import { useCallback } from 'react';

export const useFieldFocusHandler = () => {
  const scrollTo = useCallback((element: HTMLElement | null) => {
    // Removed auto-scroll behavior to prevent unwanted scrolling on mobile
    // Users can manually scroll to see the focused field
    if (!element) return;
    
    // Only log for debugging - no actual scrolling
    if (process.env.NODE_ENV === 'development') {
      console.log('Field focus detected, but auto-scroll disabled:', element);
    }
  }, []);

  return { scrollTo };
};
