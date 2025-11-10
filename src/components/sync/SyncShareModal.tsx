import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Facebook, MessageCircle, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// X (Twitter) Icon
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface SyncShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  score: number;
  personAName: string;
  personBName: string;
}

export const SyncShareModal: React.FC<SyncShareModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  score,
  personAName,
  personBName,
}) => {
  const { user } = useAuth();
  const [hasSharedToday, setHasSharedToday] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);

  // Check if user has already shared today when modal opens
  React.useEffect(() => {
    if (!isOpen || !user) return;

    const checkShareStatus = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_share_reward_date')
          .eq('id', user.id)
          .single();

        if (profile?.last_share_reward_date) {
          const today = new Date().toISOString().split('T')[0];
          if (profile.last_share_reward_date === today) {
            setHasSharedToday(true);
          }
        }
      } catch (error) {
        console.error('[SyncShareModal] Error checking share status:', error);
      }
    };

    checkShareStatus();
  }, [isOpen, user]);

  const handleShare = async (platform: string) => {
    let url = '';
    const text = `${personAName} & ${personBName}: ${score}% Sync Score ✨\n\ntherai.co`;

    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(`therai .co`)}`;
        window.open(url, '_blank', 'width=550,height=420');
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`;
        window.open(url, '_blank', 'width=550,height=420');
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(`${imageUrl}\n\ntherai.co`)}`;
        window.open(url, '_blank');
        break;
    }

    // Attempt to claim reward after sharing
    await claimShareReward();
  };

  const claimShareReward = async () => {
    if (!user || hasSharedToday || isClaimingReward) return;

    try {
      setIsClaimingReward(true);

      // Call edge function to grant +1 image credit (once per day)
      const { data, error } = await supabase.functions.invoke('grant-share-reward', {
        body: { 
          user_id: user.id,
          reward_type: 'sync_score_share'
        }
      });

      if (error) {
        console.error('[SyncShareModal] Error granting reward:', error);
        return;
      }

      if (data?.success) {
        setHasSharedToday(true);
        toast.success('🎁 +1 Free Image Unlocked!', {
          description: 'Thanks for sharing your connection!'
        });
      } else if (data?.already_claimed) {
        setHasSharedToday(true);
        toast.info('You\'ve already claimed your daily share reward');
      }
    } catch (err) {
      console.error('[SyncShareModal] Exception claiming reward:', err);
    } finally {
      setIsClaimingReward(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const filename = `sync-score-${personAName}-${personBName}.png`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Connection card downloaded');
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('Failed to download image');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
          >
            {/* Header */}
            <div className="relative px-6 py-5 border-b border-gray-100">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-light text-gray-900">Share Your Connection</h3>
                  <p className="text-sm text-gray-500 font-light">
                    {score}% Sync • {personAName} & {personBName}
                  </p>
                </div>
              </div>
            </div>

            {/* Incentive Banner */}
            {!hasSharedToday && (
              <div className="mx-6 mt-4 px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-900">Share & Unlock</p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      Share once today to unlock +1 free image generation
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Share Options */}
            <div className="p-6 space-y-3">
              {/* Twitter/X */}
              <button
                onClick={() => handleShare('twitter')}
                className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all group"
              >
                <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center group-hover:scale-110 transition-transform">
                  <XIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Share on X</p>
                  <p className="text-xs text-gray-500">Post your connection card</p>
                </div>
              </button>

              {/* Facebook */}
              <button
                onClick={() => handleShare('facebook')}
                className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all group"
              >
                <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Facebook className="w-5 h-5 text-white" fill="currentColor" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Share on Facebook</p>
                  <p className="text-xs text-gray-500">Share with friends</p>
                </div>
              </button>

              {/* WhatsApp */}
              <button
                onClick={() => handleShare('whatsapp')}
                className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all group"
              >
                <div className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-5 h-5 text-white" fill="currentColor" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Share on WhatsApp</p>
                  <p className="text-xs text-gray-500">Send to contacts</p>
                </div>
              </button>

              {/* Download */}
              <button
                onClick={handleDownload}
                className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all group"
              >
                <div className="w-11 h-11 rounded-full bg-gray-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Download Card</p>
                  <p className="text-xs text-gray-500">Save to device</p>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

