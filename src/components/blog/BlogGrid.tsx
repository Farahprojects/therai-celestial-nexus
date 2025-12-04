import React from 'react';
import { BlogCard } from './BlogCard';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  cover_image_url?: string | null;
  author_name?: string | null;
  created_at: string | null;
  like_count: number | null;
  share_count: number | null;
  tags?: string[] | null;
  content_type?: string | null;
  featured?: boolean | null;
}

interface BlogGridProps {
  posts: BlogPost[];
  filter?: string;
}

export const BlogGrid: React.FC<BlogGridProps> = ({ posts, filter = 'all' }) => {
  // Filter posts based on selected filter
  const filteredPosts = filter === 'all' 
    ? posts 
    : posts.filter(post => post.content_type === filter);

  if (filteredPosts.length === 0) {
    return (
      <div className="text-center py-24">
        <h3 className="text-2xl font-light text-gray-900 mb-4">No content found</h3>
        <p className="text-gray-600 font-light">
          {filter === 'all' 
            ? 'Check back soon for new content.' 
            : `No ${filter} content available yet.`}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
      {filteredPosts.map((post, index) => (
        <BlogCard key={post.id} post={post} index={index} />
      ))}
    </div>
  );
};