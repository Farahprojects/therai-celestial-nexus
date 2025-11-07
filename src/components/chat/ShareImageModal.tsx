import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link as LinkIcon, Twitter, Facebook, MessageCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ShareImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imagePrompt?: string;
}

export const ShareImageModal: React.FC<ShareImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imagePrompt,
}) => {
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast.success('Link copied to clipboard');
      onClose();
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleShareTwitter = () => {
    const text = 'www.therai.co';
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(imageUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
    onClose();
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
    onClose();
  };

  const handleShareWhatsApp = () => {
    const text = `www.therai.co\n${imageUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    onClose();
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const filename = `therai-image-${Date.now()}.png`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Image downloaded');
      onClose();
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('Failed to download image');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-light text-gray-900">Share Image</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Share Options */}
            <div className="p-6 space-y-3">
              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="w-full px-6 py-3 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light transition-colors flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                Copy Link
              </button>

              {/* Social Sharing */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleShareTwitter}
                  className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-light transition-colors flex flex-col items-center justify-center gap-2"
                >
                  <Twitter className="w-5 h-5" />
                  <span className="text-xs">Twitter</span>
                </button>

                <button
                  onClick={handleShareFacebook}
                  className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-light transition-colors flex flex-col items-center justify-center gap-2"
                >
                  <Facebook className="w-5 h-5" />
                  <span className="text-xs">Facebook</span>
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-light transition-colors flex flex-col items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs">WhatsApp</span>
                </button>
              </div>

              {/* Download */}
              <button
                onClick={handleDownload}
                className="w-full px-6 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-light transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

