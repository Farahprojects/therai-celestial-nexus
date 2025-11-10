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

  const handleShareInstagram = () => {
    // Instagram deep link for mobile, fallback to web
    const url = `instagram://library?AssetPath=${encodeURIComponent(imageUrl)}`;
    window.location.href = url;
    
    // Fallback: if Instagram app doesn't open, copy link
    setTimeout(() => {
      handleCopyLink();
    }, 1000);
  };

  const handleShareTikTok = () => {
    // TikTok deep link for mobile
    const url = `https://www.tiktok.com/upload?lang=en`;
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

                <button
                  onClick={handleShareInstagram}
                  className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 transition-colors flex items-center justify-center"
                  title="Share on Instagram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </button>

                <button
                  onClick={handleShareTikTok}
                  className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 transition-colors flex items-center justify-center"
                  title="Share on TikTok"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
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

