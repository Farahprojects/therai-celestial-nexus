import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Facebook, Download } from 'lucide-react';
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

    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(`therai .co`)}`;
        window.open(url, '_blank', 'width=550,height=420');
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`;
        window.open(url, '_blank', 'width=550,height=420');
        break;
      case 'instagram':
        // Instagram doesn't have direct web sharing, download the image and show instructions
        await handleDownload();
        toast.info('Image downloaded! Open Instagram and share from your gallery');
        break;
      case 'tiktok':
        // TikTok doesn't have direct web sharing, download the image and show instructions
        await handleDownload();
        toast.info('Image downloaded! Open TikTok and share from your gallery');
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

  console.log('[SyncShareModal] Rendering share bar:', { isOpen, imageUrl, score, personAName, personBName });

  return (
    <div className="mobile-input-area mobile-input-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.15 }}
        className="bg-white p-3 border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <div className="w-full max-w-3xl mx-auto px-2">
          {/* Incentive Banner - Minimal */}
          {!hasSharedToday && (
            <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 text-center font-light">
                Share to unlock +1 free image today
              </p>
            </div>
          )}

          {/* Share Buttons - Clean horizontal row */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => handleShare('twitter')}
              className="w-11 h-11 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
              title="Share on X"
            >
              <XIcon className="w-5 h-5 text-white" />
            </button>

            <button
              onClick={() => handleShare('facebook')}
              className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors"
              title="Share on Facebook"
            >
              <Facebook className="w-5 h-5 text-white" fill="currentColor" />
            </button>

            <button
              onClick={() => handleShare('instagram')}
              className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-500 hover:opacity-90 flex items-center justify-center transition-opacity"
              title="Share on Instagram"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </button>

            <button
              onClick={() => handleShare('tiktok')}
              className="w-11 h-11 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
              title="Share on TikTok"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
              </svg>
            </button>

            <button
              onClick={handleDownload}
              className="w-11 h-11 rounded-full bg-gray-900 hover:bg-gray-800 flex items-center justify-center transition-colors"
              title="Download Card"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

