import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Share2, Download, X, ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { safeConsoleError, safeConsoleWarn } from '@/utils/safe-logging';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { unifiedChannel } from '@/services/websocket/UnifiedChannelService';
import { showToast } from '@/utils/notifications';
import { imagePreloader } from '@/utils/storageUtils';
interface ImageMessage {
  id: string;
  chat_id: string;
  created_at: string;
  meta: {
    image_url: string;
    image_prompt: string;
    image_path: string;
  };
}
interface ImageGalleryProps {
  isOpen: boolean;
  onClose: () => void;
}
export const ImageGallery = ({
  isOpen,
  onClose
}: ImageGalleryProps) => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState<ImageMessage[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deleteImage, setDeleteImage] = useState<ImageMessage | null>(null);
  const [hasMoreImages, setHasMoreImages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadImages = useCallback(async (loadMore = false) => {
    if (!user?.id) return;
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const currentCount = loadMore ? images.length : 0;
      const limit = 50; // Load 50 images at a time to prevent memory issues

      const {
        data,
        error
      } = await supabase
        .from('user_images')
        .select('id, chat_id, created_at, image_url, prompt, image_path')
        .eq('user_id', user.id)
        .order('created_at', {
          ascending: false
        })
        .range(currentCount, currentCount + limit - 1);

      if (error) {
        safeConsoleError('Failed to load images:', error);
        if (!loadMore) setImages([]);
      } else {
        // Transform user_images format to ImageMessage format for compatibility
        const transformedImages: ImageMessage[] = (data || []).map((img) => ({
          id: img.id,
          chat_id: img.chat_id || '',
          created_at: img.created_at,
          meta: {
            image_url: img.image_url,
            image_prompt: img.prompt || '',
            image_path: img.image_path || ''
          }
        }));

        if (loadMore) {
          setImages(prev => [...prev, ...transformedImages]);
        } else {
          setImages(transformedImages);
        }

        // Check if there are more images to load
        setHasMoreImages(transformedImages.length === limit);

        // 🚀 OPTIMIZE: Preload recent images for faster display
        const imageUrls = transformedImages.map(img => img.meta.image_url);
        imagePreloader.preloadRecentImages(imageUrls);
      }
    } catch (error) {
      safeConsoleError('Error loading images:', error);
      if (!loadMore) setImages([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.id, images.length]);

  useEffect(() => {
    if (isOpen && user) {
      loadImages();
    }
  }, [isOpen, user, loadImages]);

  // Listen for real-time image inserts
  useEffect(() => {
    if (!isOpen || !user) return;

    const handleImageInsert = (payload: Record<string, unknown>) => {
      const image = payload.image as { id: string; chat_id?: string; created_at: string; image_url: string; prompt?: string; image_path: string } | undefined;
      
      if (image) {
        // Transform to ImageMessage format and prepend to list
        const newImage: ImageMessage = {
          id: image.id,
          chat_id: image.chat_id || '',
          created_at: image.created_at,
          meta: {
            image_url: image.image_url,
            image_prompt: image.prompt || '',
            image_path: image.image_path || ''
          }
        };
        
        setImages(prev => [newImage, ...prev]);
      }
    };

    // Subscribe to unified channel image-insert events
    const unsubscribe = unifiedChannel.on('image-insert', handleImageInsert);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, user]);
  const handleOpenChat = (image: ImageMessage) => {
    if (image.chat_id) {
      navigate(`/c/${image.chat_id}`);
      onClose();
    } else {
      // Chat was deleted - can't navigate to it
      console.warn('Cannot open chat - chat was deleted');
    }
  };
  const handleShare = async (image: ImageMessage) => {
    try {
      await navigator.clipboard.writeText(image.meta.image_url);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (error) {
      safeConsoleError('Failed to copy to clipboard:', error);
    }
  };
  const handleDownload = async (image: ImageMessage) => {
    try {
      const response = await fetch(image.meta.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.meta.image_path.split('/').pop() || 'image.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      safeConsoleError('Failed to download image:', error);
    }
  };
  const handleDelete = (image: ImageMessage) => {
    setDeleteImage(image);
  };
  const confirmDelete = async () => {
    if (!deleteImage || !user?.id) return;
    
    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('user_images')
        .delete()
        .eq('id', deleteImage.id)
        .eq('user_id', user.id); // Security: ensure user owns the image
      
      if (dbError) throw dbError;
      
      // Optionally delete from Storage if image_path exists
      if (deleteImage.meta.image_path) {
        try {
          await supabase.storage
            .from('generated-images')
            .remove([deleteImage.meta.image_path]);
        } catch (storageError) {
          // Storage deletion is optional - log but don't fail
          safeConsoleWarn('Failed to delete from storage:', storageError);
        }
      }
      
      // Remove from local state
      setImages(prev => prev.filter(img => img.id !== deleteImage.id));
      
      // If deleted image was selected, close single view
      if (selectedImage?.id === deleteImage.id) {
        setSelectedImage(null);
      }
      
      // Show success toast
      showToast({
        title: "Deleted",
        description: "Image deleted successfully.",
        variant: "success"
      });
      
      setDeleteImage(null);
    } catch (error) {
      safeConsoleError('Failed to delete image:', error);
      showToast({
        title: "Error",
        description: "Could not delete image.",
        variant: "destructive"
      });
    }
  };
  if (!isOpen) return null;

  // Gallery Grid View
  if (!selectedImage) {
    return <div className="fixed inset-0 z-50 bg-white md:left-64 font-['Inter']">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 md:px-8 py-2 md:py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden -ml-2">
              <X className="w-7 h-7" />
            </Button>
            <h2 className="text-xl md:text-3xl font-light md:italic text-gray-900">Images</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="hidden md:flex rounded-full hover:bg-gray-100 ml-auto">
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-88px)] px-8 py-8">
          {loading ? <div className="text-center py-16 text-gray-500 font-light">Loading images...</div> : images.length === 0 ? <div className="text-center py-16 text-gray-500 font-light">
              No images generated yet. Try asking to create an image!
            </div> : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((image, index) => <div key={image.id} className="relative group cursor-pointer rounded-xl overflow-hidden bg-gray-100 aspect-square" onClick={() => setSelectedImage(image)}>
                  <img 
                    src={image.meta.image_url} 
                    alt={image.meta.image_prompt} 
                    className="w-full h-full object-cover md:transition-transform md:group-hover:scale-105" 
                    loading={index < 8 ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={index < 4 ? "high" : "low"}
                  />
                  <div className="hidden md:flex absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/0 group-hover:from-black/60 group-hover:to-transparent transition-all duration-200 items-center justify-center h-12 gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-white hover:text-white hover:bg-white/20 rounded-full transition-opacity" onClick={e => {
                      e.stopPropagation();
                      handleShare(image);
                    }}>
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Share</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-white hover:text-white hover:bg-white/20 rounded-full transition-opacity" onClick={e => {
                      e.stopPropagation();
                      handleDownload(image);
                    }}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Save</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-white hover:text-white hover:bg-white/20 rounded-full transition-opacity" onClick={e => {
                      e.stopPropagation();
                      handleDelete(image);
                    }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>)}
            </div>}
        </div>

        {/* Share success notification */}
        {shareSuccess && <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full font-light">
            Link copied to clipboard
          </div>}

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteImage} onOpenChange={() => setDeleteImage(null)}>
          <AlertDialogContent className="font-['Inter']">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-light text-xl">Delete Image?</AlertDialogTitle>
              <AlertDialogDescription className="font-light">
                This action cannot be undone. This will permanently delete the image.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className="rounded-full bg-red-600 hover:bg-red-700"
                onClick={confirmDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>;
  }

  // Single Image View

  // Desktop Single Image View
  if (!isMobile) {
    return <div className="fixed inset-0 z-50 bg-white md:left-64 font-['Inter'] flex flex-col">
        {/* Top Controls */}
        <div className="border-b border-gray-200 px-8 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedImage(null)} className="rounded-full hover:bg-gray-100 gap-2">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Images</span>
            </Button>

            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => handleOpenChat(selectedImage)} className="rounded-full hover:bg-gray-100">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open Chat</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => handleShare(selectedImage)} className="rounded-full hover:bg-gray-100">
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Share</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => handleDownload(selectedImage)} className="rounded-full hover:bg-gray-100">
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(selectedImage)} className="rounded-full hover:bg-gray-100">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Image Display with Carousel */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main image - Left side */}
            <div className="flex-1 flex items-center justify-center p-12 overflow-auto">
              <img
                src={selectedImage.meta.image_url}
                alt={selectedImage.meta.image_prompt}
                className="max-w-[92%] max-h-[92%] rounded-xl shadow-2xl mx-auto"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </div>

            {/* Carousel - Right side */}
            <div className="w-32 border-l border-gray-200 overflow-y-auto scrollbar-hide py-4 px-3">
              <div className="flex flex-col gap-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className={`
                      relative aspect-square rounded-lg overflow-hidden
                      transition-all duration-200 hover:scale-105
                      ${selectedImage.id === img.id 
                        ? 'ring-2 ring-gray-900 scale-105' 
                        : 'opacity-60 hover:opacity-100'
                      }
                    `}
                  >
                    <img
                      src={img.meta.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
                {/* Load More Button */}
                {hasMoreImages && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadImages(true)}
                      disabled={loadingMore}
                      className="w-full text-xs"
                    >
                      {loadingMore ? 'Loading...' : 'Load More Images'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Image Prompt - Hidden per user request */}

        {/* Share success notification */}
        {shareSuccess && <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full font-light">
            Link copied to clipboard
          </div>}

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteImage} onOpenChange={() => setDeleteImage(null)}>
          <AlertDialogContent className="font-['Inter']">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-light text-xl">Delete Image?</AlertDialogTitle>
              <AlertDialogDescription className="font-light">
                This action cannot be undone. This will permanently delete the image.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className="rounded-full bg-red-600 hover:bg-red-700"
                onClick={confirmDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>;
  }

  // Mobile Single Image View
  return <div className="fixed inset-0 z-50 bg-white font-['Inter'] flex flex-col">
      {/* Mobile Header */}
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setSelectedImage(null)} className="-ml-2 gap-2">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Images</span>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleOpenChat(selectedImage)}>
              <MessageCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleShare(selectedImage)}>
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDownload(selectedImage)}>
              <Download className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(selectedImage)}>
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Image Display - Fullscreen */}
      <div className="flex-1 flex items-center justify-center bg-white overflow-auto">
        <img src={selectedImage.meta.image_url} alt={selectedImage.meta.image_prompt} className="max-w-full max-h-full object-contain" />
      </div>

      {/* Share success notification */}
      {shareSuccess && <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full font-light z-50">
          Link copied to clipboard
        </div>}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteImage} onOpenChange={() => setDeleteImage(null)}>
        <AlertDialogContent className="font-['Inter']">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-light text-xl">Delete Image?</AlertDialogTitle>
            <AlertDialogDescription className="font-light">
              This action cannot be undone. This will permanently delete the image.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="rounded-full bg-red-600 hover:bg-red-700"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};