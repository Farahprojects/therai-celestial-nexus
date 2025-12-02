/**
 * Centralized notification utility using Sonner
 * Provides a consistent API for showing notifications throughout the app
 */

import { toast as sonnerToast } from "sonner";

export type ToastVariant = "default" | "destructive" | "success";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

// Legacy type alias for backward compatibility
export type ToastProps = ToastOptions;

/**
 * Show a notification toast
 * @param options - Toast options (title, description, variant)
 */
export function showToast(options: ToastOptions): void {
  const { title, description, variant = "default", duration } = options;
  
  // Combine title and description into a single message
  const message = description 
    ? title 
      ? `${title}: ${description}` 
      : description
    : title || "Notification";

  // Map variants to Sonner's API
  switch (variant) {
    case "success":
      sonnerToast.success(message, { duration });
      break;
    case "destructive":
      sonnerToast.error(message, { duration });
      break;
    case "default":
    default:
      sonnerToast.info(message, { duration });
      break;
  }
}

/**
 * Convenience functions for common notification types
 */
export const notifications = {
  success: (message: string, options?: { title?: string; duration?: number }) => {
    sonnerToast.success(message, { duration: options?.duration });
  },
  
  error: (message: string, options?: { title?: string; duration?: number }) => {
    sonnerToast.error(message, { duration: options?.duration });
  },
  
  info: (message: string, options?: { title?: string; duration?: number }) => {
    sonnerToast.info(message, { duration: options?.duration });
  },
  
  warning: (message: string, options?: { title?: string; duration?: number }) => {
    sonnerToast.warning(message, { duration: options?.duration });
  },
  
  // Legacy API support for existing code
  toast: showToast,
};

