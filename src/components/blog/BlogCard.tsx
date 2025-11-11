import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { LikeButton } from './LikeButton';
import { ShareButton } from './ShareButton';
import { TagPill } from './TagPill';
import { ContentTypeBadge } from './ContentTypeBadge';
import { Badge } from '@/components/ui/badge';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  cover_image_url?: string;
  author_name?: string;
  created_at: string;
  like_count: number;
  share_count: number;
  tags?: string[];
  content_type?: string | null;
  featured?: boolean;
}

interface BlogCardProps {
  post: BlogPost;
  index: number;
}

export const BlogCard: React.FC<BlogCardProps> = ({ post, index }) => {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const defaultImage = "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=600&fit=crop";

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group bg-white rounded-3xl overflow-hidden border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
    >
      <Link to={`/blog/${post.slug}`} className="block">
        <div className="relative overflow-hidden">
          <img
            src={post.cover_image_url || defaultImage}
            alt={post.title}
            className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            width={800}
            height={256}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          
          {/* Content Type Badge */}
          {post.content_type && (
            <div className="absolute top-4 left-4 z-10">
              <ContentTypeBadge type={post.content_type} />
            </div>
          )}
          
          {/* Featured Badge */}
          {post.featured && (
            <div className="absolute top-4 right-4 z-10">
              <Badge className="bg-amber-50 text-amber-900 border-amber-200 font-light">
                Featured
              </Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="p-8 space-y-6">
        <div className="space-y-4">
          <Link to={`/blog/${post.slug}`}>
            <h2 className="text-2xl font-light text-gray-900 leading-tight group-hover:text-gray-700 transition-colors line-clamp-2">
              {post.title}
            </h2>
          </Link>

          <div className="flex items-center justify-between text-sm text-gray-500 font-light">
            <span>{post.author_name || 'Anonymous'}</span>
            <span>{timeAgo}</span>
          </div>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <LikeButton postId={post.id} initialLikes={post.like_count || 0} />
            <ShareButton 
              postId={post.id} 
              postTitle={post.title}
              postSlug={post.slug}
              initialShares={post.share_count || 0} 
            />
          </div>
          
          <Link 
            to={`/blog/${post.slug}`}
            className="text-gray-700 hover:text-gray-900 font-medium text-sm group/link transition-colors"
          >
            <span className="flex items-center gap-2">
              Read more
              <svg className="h-4 w-4 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </motion.article>
  );
};