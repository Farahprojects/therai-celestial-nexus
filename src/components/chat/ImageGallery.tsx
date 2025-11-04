import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageMessage {
  id: string;
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

export const ImageGallery = ({ isOpen, onClose }: ImageGalleryProps) => {
  const { user } = useAuth();
  const [images, setImages] = useState<ImageMessage[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageMessage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      loadImages();
    }
  }, [isOpen, user]);

  const loadImages = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, created_at, meta')
        .eq('role', 'assistant')
        .eq('meta->>message_type', 'image')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load images:', error);
        setImages([]);
      } else {
        setImages((data as ImageMessage[]) || []);
      }
    } catch (error) {
      console.error('Error loading images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (image: ImageMessage) => {
    if (!confirm('Delete this image?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('generated-images')
        .remove([image.meta.image_path]);

      if (storageError) {
        console.error('Failed to delete from storage:', storageError);
        alert('Failed to delete image from storage');
        return;
      }

      // Delete message
      const { error: dbError } = await supabase
        .from('messages')
        .delete()
        .eq('id', image.id);

      if (dbError) {
        console.error('Failed to delete message:', dbError);
        alert('Failed to delete message');
        return;
      }

      // Remove from local state
      setImages(images.filter(img => img.id !== image.id));
      if (selectedImage?.id === image.id) {
        setSelectedImage(null);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light">Your Generated Images</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading images...</div>
          ) : images.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No images generated yet. Try asking to create an image!
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative group cursor-pointer rounded-xl overflow-hidden"
                  onClick={() => setSelectedImage(image)}
                >
                  <img
                    src={image.meta.image_url}
                    alt={image.meta.image_prompt}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 text-white hover:text-white hover:bg-gray-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(image);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-size view modal */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-light">Generated Image</DialogTitle>
            </DialogHeader>
            <img
              src={selectedImage.meta.image_url}
              alt={selectedImage.meta.image_prompt}
              className="w-full rounded-xl"
            />
            {selectedImage.meta.image_prompt && (
              <p className="text-sm text-gray-600 italic mt-2 font-light">
                "{selectedImage.meta.image_prompt}"
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(selectedImage.meta.image_url, '_blank')}
                className="rounded-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(selectedImage)}
                className="rounded-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

