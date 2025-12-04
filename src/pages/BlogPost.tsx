import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import UnifiedNavigation from '@/components/UnifiedNavigation';
import Footer from '@/components/Footer';
import { BlogPost as BlogPostComponent } from '@/components/blog/BlogPost';
import { TheraLoader } from '@/components/ui/TheraLoader';
import { SEO } from '@/components/SEO';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug provided');
      
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Wait for loading to complete before redirecting
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <UnifiedNavigation />
        <main className="flex-grow flex items-center justify-center">
          <TheraLoader />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !post) {
    return <Navigate to="/blog" replace />;
  }

  // Extract plain text from HTML for description (first 160 chars)
  const getPlainText = (html: string): string => {
    if (typeof document === 'undefined') {
      // Server-side: strip HTML tags manually
      return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').trim();
  };

  const postDescription = post.meta_description || getPlainText(post.content || '').substring(0, 160);
  const postImage = post.cover_image_url || 'https://api.therai.co/storage/v1/object/public/therai-assets/logowhite.jpeg';
  const keywords = post.meta_keywords?.join(', ') || post.tags?.join(', ') || 'astrology, birth chart';

  // Article structured data
  const articleStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: postDescription,
    image: postImage,
    author: {
      '@type': 'Organization',
      name: post.author_name || 'Therai',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Therai',
      logo: {
        '@type': 'ImageObject',
        url: 'https://api.therai.co/storage/v1/object/public/therai-assets/logowhite.jpeg',
      },
    },
    datePublished: post.created_at,
    dateModified: post.created_at,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://therai.co/blog/${post.slug}`,
    },
  };

  return (
    <>
      <SEO
        title={`${post.title} | AI-Powered Psychological Insights | Therai`}
        description={postDescription}
        keywords={`${keywords}, AI webapp, psychological insights, momentum, self-discovery`}
        image={postImage}
        url={`/blog/${post.slug}`}
        type="article"
        author={post.author_name ?? 'Therai'}
        publishedTime={post.created_at ?? undefined}
        modifiedTime={post.created_at ?? undefined}
        structuredData={articleStructuredData}
      />
      <div className="flex min-h-screen flex-col bg-white">
        <UnifiedNavigation />

        <main className="flex-grow py-16">
          <div className="max-w-7xl mx-auto px-4">
            <BlogPostComponent post={{
              id: post.id,
              title: post.title,
              slug: post.slug,
              content: post.content,
              cover_image_url: post.cover_image_url ?? undefined,
              author_name: post.author_name ?? undefined,
              created_at: post.created_at ?? new Date().toISOString(),
              like_count: post.like_count ?? 0,
              share_count: post.share_count ?? 0,
              tags: post.tags ?? undefined,
            }} />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default BlogPost;