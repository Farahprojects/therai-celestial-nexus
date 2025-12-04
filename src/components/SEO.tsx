import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  structuredData?: object;
}

export const SEO: React.FC<SEOProps> = ({
  title = 'Therai — Your Context-Aware AI Workspace',
  description = 'Therai is your intelligent AI workspace for psychological insights, astrology analysis, and personal growth. Get AI-powered psychological insights through astrology, birth charts, transits, and compatibility analysis in one unified platform.',
  keywords = 'Therai, AI workspace, psychological insights, astrology AI, birth chart analysis, AI astrology, horoscope app, synastry compatibility, astrological transits, psychological analysis, AI personal growth, intelligent workspace',
  image = 'https://api.therai.co/storage/v1/object/public/therai-assets/logowhite.jpeg',
  url,
  type = 'website',
  author = 'Therai',
  publishedTime,
  modifiedTime,
  structuredData,
}) => {
  const baseUrl = 'https://therai.co';
  const fullUrl = url ? `${baseUrl}${url}` : baseUrl;
  const fullImageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:site_name" content="Therai" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />

      {/* Article-specific meta tags */}
      {type === 'article' && (
        <>
          {publishedTime && <meta property="article:published_time" content={publishedTime} />}
          {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
          {author && <meta property="article:author" content={author} />}
        </>
      )}

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};
