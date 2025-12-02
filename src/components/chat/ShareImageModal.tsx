import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link as LinkIcon, Facebook, Download } from 'lucide-react';
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
}

export const ShareImageModal: React.FC<ShareImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
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
    // Put image URL first so X fetches it for the card
    // Add branding after with a space to prevent domain metadata fetch
    const text = `therai .co`;  // Space in domain prevents X from fetching therai.co metadata
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=550,height=420');
    onClose();
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
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
              {/* Social Sharing */}
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={handleShareTwitter}
                  className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 transition-colors flex items-center justify-center"
                  title="Share on X"
                >
                  <XIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={handleShareFacebook}
                  className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 transition-colors flex items-center justify-center"
                  title="Share on Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </button>
              </div>

              {/* Copy & Download */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light transition-colors flex items-center justify-center gap-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  Copy
                </button>

                <button
                  onClick={handleDownload}
                  className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-light transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

