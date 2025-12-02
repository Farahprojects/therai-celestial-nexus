import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import type { Database, Tables } from '@/integrations/supabase/types';

type BlogPostRow = Tables<'blog_posts'>;

interface LikeButtonProps {
  postId: BlogPostRow['id'];
  initialLikes: number;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ postId, initialLikes }) => {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Check if already liked in localStorage
    const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');
    setIsLiked(likedPosts.includes(postId));
  }, [postId]);

  const handleLike = async () => {
    if (isLiked) return; // Prevent multiple likes

    setIsAnimating(true);
    const nextLikes = likes + 1;
    setLikes(nextLikes);
    setIsLiked(true);

    // Store in localStorage
    const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');
    likedPosts.push(postId);
    localStorage.setItem('likedPosts', JSON.stringify(likedPosts));

    // Update database
    try {
      const updatePayload: Database['public']['Tables']['blog_posts']['Update'] = {
        like_count: nextLikes,
      };

      const idColumn: keyof BlogPostRow = 'id';

      await supabase
        .from('blog_posts')
        .update(updatePayload)
        .eq(idColumn, postId);
    } catch (error) {
      console.error('Error updating like count:', error);
      // Rollback optimistic update
      setLikes(prev => prev - 1);
      setIsLiked(false);
    }

    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <motion.button
      onClick={handleLike}
      disabled={isLiked}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-light transition-all duration-300 ${
        isLiked 
          ? 'bg-red-50 text-red-600 cursor-not-allowed' 
          : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600'
      }`}
      whileHover={!isLiked ? { scale: 1.05 } : {}}
      whileTap={!isLiked ? { scale: 0.95 } : {}}
    >
      <motion.div
        animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.6 }}
      >
        <Heart 
          className={`h-4 w-4 transition-all duration-300 ${
            isLiked ? 'fill-current' : ''
          }`} 
        />
      </motion.div>
      <span>{likes}</span>
    </motion.button>
  );
};