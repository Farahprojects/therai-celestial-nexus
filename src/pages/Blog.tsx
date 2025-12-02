import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import UnifiedNavigation from '@/components/UnifiedNavigation';
import Footer from '@/components/Footer';
import { BlogGrid } from '@/components/blog/BlogGrid';
import { BlogContentFilter } from '@/components/blog/BlogContentFilter';
import { SEO } from '@/components/SEO';

const Blog = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const { data: posts, error } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Always render the UI with lazy loading - no spinners

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <UnifiedNavigation />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-light text-gray-900">Something went wrong</h2>
            <p className="text-gray-600 font-light">Please try again later.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Calculate post counts by content type for filter tabs
  const postCounts = {
    all: posts?.length || 0,
    tutorial: posts?.filter(p => p.content_type === 'tutorial').length || 0,
    guide: posts?.filter(p => p.content_type === 'guide').length || 0,
    blog: posts?.filter(p => p.content_type === 'blog').length || 0,
    news: posts?.filter(p => p.content_type === 'news').length || 0,
  };

  const blogStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Therai Blog',
    description: 'AI-powered psychological insights, self-discovery guides, and articles about momentum and personal growth',
    url: 'https://therai.co/blog',
    publisher: {
      '@type': 'Organization',
      name: 'Therai',
      logo: {
        '@type': 'ImageObject',
        url: 'https://api.therai.co/storage/v1/object/public/therai-assets/logowhite.jpeg',
      },
    },
  };

  return (
    <>
      <SEO
        title="Blog | AI-Powered Psychological Insights & Guides | Therai"
        description="Discover articles about psychological insights, momentum, and self-discovery through AI-powered astrology. Learn how Therai helps create insights into your inner rhythms."
        keywords="AI webapp blog, psychological insights, self-discovery, astrology blog, momentum, AI-powered insights, personal growth"
        url="/blog"
        structuredData={blogStructuredData}
      />
      <div className="flex min-h-screen flex-col bg-white">
        <UnifiedNavigation />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16 space-y-6"
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-light text-gray-900 leading-tight">
                Learn & <span className="italic font-medium">Explore</span>
              </h1>
              <p className="text-xl text-gray-600 font-light max-w-2xl mx-auto leading-relaxed">
                Discover astrological insights, app tutorials, and guides to deepen your understanding
              </p>
            </motion.div>
          </div>
        </section>

        {/* Filter Tabs */}
        {posts && posts.length > 0 && (
          <BlogContentFilter 
            activeFilter={activeFilter} 
            onFilterChange={setActiveFilter}
            postCounts={postCounts}
          />
        )}

        {/* Blog Grid */}
        <section className="py-16 bg-gradient-to-b from-white to-gray-50/30">
          <div className="max-w-7xl mx-auto px-4">
            <BlogGrid posts={posts || []} filter={activeFilter} />
          </div>
        </section>
      </main>

        <Footer />
      </div>
    </>
  );
};

export default Blog;