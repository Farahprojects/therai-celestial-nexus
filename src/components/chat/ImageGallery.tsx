import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Share2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  useEffect(() => {
    if (isOpen && user) {
      loadImages();
    }
  }, [isOpen, user]);
  const loadImages = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase
        .from('messages')
        .select('id, chat_id, created_at, meta')
        .eq('role' as never, 'assistant')
        .eq('meta->>message_type' as never, 'image')
        .eq('user_id' as never, user.id)
        .order('created_at', {
        ascending: false
        });
      if (error) {
        console.error('Failed to load images:', error);
        setImages([]);
      } else {
        setImages(data as ImageMessage[] || []);
      }
    } catch (error) {
      console.error('Error loading images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };
  const handleOpenChat = (image: ImageMessage) => {
    navigate(`/c/${image.chat_id}`);
    onClose();
  };
  const handleShare = async (image: ImageMessage) => {
    try {
      await navigator.clipboard.writeText(image.meta.image_url);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
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
      console.error('Failed to download image:', error);
    }
  };
  if (!isOpen) return null;

  // Gallery Grid View
  if (!selectedImage) {
    return <div className="fixed inset-0 z-50 bg-white md:left-[14rem] font-['Inter']">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden -ml-2">
              <X className="w-6 h-6" />
            </Button>
            <h2 className="text-xl md:text-3xl font-light md:italic text-gray-900">Images</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="hidden md:flex rounded-full hover:bg-gray-100 ml-auto">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-88px)] px-8 py-8">
          {loading ? <div className="text-center py-16 text-gray-500 font-light">Loading images...</div> : images.length === 0 ? <div className="text-center py-16 text-gray-500 font-light">
              No images generated yet. Try asking to create an image!
            </div> : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {images.map(image => <div key={image.id} className="relative group cursor-pointer rounded-xl overflow-hidden bg-gray-100 aspect-square" onClick={() => setSelectedImage(image)}>
                  <img src={image.meta.image_url} alt={image.meta.image_prompt} className="w-full h-full object-cover md:transition-transform md:group-hover:scale-105" />
                  <div className="hidden md:flex absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 items-center justify-center gap-3">
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
                  </div>
                </div>)}
            </div>}
        </div>

        {/* Share success notification */}
        {shareSuccess && <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full font-light">
            Link copied to clipboard
          </div>}
      </div>;
  }

  // Single Image View
  const currentIndex = images.findIndex(img => img.id === selectedImage.id);
  const selectImageByIndex = (index: number) => {
    if (index >= 0 && index < images.length) {
      setSelectedImage(images[index]);
    }
  };

  // Desktop Single Image View
  if (!isMobile) {
    return <div className="fixed inset-0 z-50 bg-white md:left-[14rem] font-['Inter'] flex">
        {/* Left Thumbnail Strip */}
        <div className="w-32 border-r border-gray-200 overflow-y-auto p-4 space-y-4">
          {images.map((image, index) => <div key={image.id} className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedImage.id === image.id ? 'border-gray-900 shadow-md' : 'border-transparent hover:border-gray-300'}`} onClick={() => setSelectedImage(image)}>
              <img src={image.meta.image_url} alt={image.meta.image_prompt} className="w-full aspect-square object-cover" />
            </div>)}
        </div>

        {/* Main Image Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Controls */}
          <div className="border-b border-gray-200 px-8 py-4 flex items-center justify-between">
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
            </div>

            <Button variant="ghost" size="icon" onClick={() => setSelectedImage(null)} className="rounded-full hover:bg-gray-100">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Image Display */}
          <div className="flex-1 flex items-center justify-center p-12 overflow-auto">
            <img
              src={selectedImage.meta.image_url}
              alt={selectedImage.meta.image_prompt}
              className="max-w-[80%] max-h-[80%] rounded-xl shadow-2xl mx-auto"
            />
          </div>

          {/* Image Prompt - Hidden per user request */}
        </div>

        {/* Share success notification */}
        {shareSuccess && <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full font-light">
            Link copied to clipboard
          </div>}
      </div>;
  }

  // Mobile Single Image View
  return <div className="fixed inset-0 z-50 bg-white font-['Inter'] flex flex-col">
      {/* Mobile Header */}
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSelectedImage(null)} className="-ml-2">
            <X className="w-6 h-6" />
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
          </div>
        </div>
      </div>

      {/* Image Display - Fullscreen */}
      <div className="flex-1 flex items-center justify-center bg-white overflow-auto">
        <img src={selectedImage.meta.image_url} alt={selectedImage.meta.image_prompt} className="max-w-full max-h-full object-contain" />
      </div>

      {/* Thumbnail Strip */}
      <div className="border-t border-gray-200 p-3 overflow-x-auto bg-white">
        <div className="flex gap-2 pb-safe">
          {images.map((image, index) => <div key={image.id} className={`flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedImage.id === image.id ? 'border-gray-900' : 'border-gray-200'}`} onClick={() => setSelectedImage(image)}>
              <img src={image.meta.image_url} alt={image.meta.image_prompt} className="w-14 h-14 object-cover" />
            </div>)}
        </div>
      </div>

      {/* Share success notification */}
      {shareSuccess && <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full font-light z-50">
          Link copied to clipboard
        </div>}
    </div>;
};