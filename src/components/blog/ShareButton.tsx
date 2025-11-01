import React, { useState } from 'react';
import { Share2, Twitter, Linkedin, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareButtonProps {
  postId: string;
  postTitle: string;
  postSlug: string;
  initialShares: number;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ 
  postId, 
  postTitle, 
  postSlug, 
  initialShares 
}) => {
  const [shares, setShares] = useState(initialShares);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const postUrl = `${window.location.origin}/blog/${postSlug}`;

  const updateShareCount = async () => {
    setShares(prev => prev + 1);
    try {
      await supabase
        .from('blog_posts')
        .update({ share_count: shares + 1 })
        .eq('id', postId as any);
    } catch (error) {
      console.error('Error updating share count:', error);
      setShares(prev => prev - 1);
    }
  };

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postTitle)}&url=${encodeURIComponent(postUrl)}`;
    window.open(twitterUrl, '_blank');
    updateShareCount();
    setIsOpen(false);
  };

  const shareToLinkedIn = () => {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;
    window.open(linkedinUrl, '_blank');
    updateShareCount();
    setIsOpen(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      updateShareCount();
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-light transition-all duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Share2 className="h-4 w-4" />
        <span>{shares}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[200px] z-50"
          >
            <div className="space-y-1">
              <button
                onClick={shareToTwitter}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Twitter className="h-4 w-4 text-blue-500" />
                Share on Twitter
              </button>
              
              <button
                onClick={shareToLinkedIn}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Linkedin className="h-4 w-4 text-blue-700" />
                Share on LinkedIn
              </button>
              
              <button
                onClick={copyLink}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    Link copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy link
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};