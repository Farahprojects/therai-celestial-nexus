import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link as LinkIcon, Facebook, MessageCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

// X (Twitter) Icon
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ShareImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imagePrompt?: string;
  shareUrl?: string;
}

export const ShareImageModal: React.FC<ShareImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imagePrompt,
  shareUrl,
}) => {
  const targetUrl = shareUrl || imageUrl;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      toast.success('Link copied to clipboard');
      onClose();
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleShareTwitter = () => {
    const text = 'therai.co';
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(targetUrl)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=550,height=420');
    onClose();
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
    onClose();
  };

  const handleShareWhatsApp = () => {
    const text = `${targetUrl}\n\ntherai.co`;
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
                  <XIcon className="w-5 h-5" />
                  <span className="text-xs">X</span>
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

