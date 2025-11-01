import React from 'react';
import { Badge } from '@/components/ui/badge';

interface ContentTypeBadgeProps {
  type?: string | null;
}

const contentTypeConfig: Record<string, { label: string; className: string }> = {
  'tutorial': { label: 'Tutorial', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  'guide': { label: 'Guide', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  'blog': { label: 'Article', className: 'bg-gray-50 text-gray-700 border-gray-200' },
  'case-study': { label: 'Story', className: 'bg-green-50 text-green-700 border-green-200' },
  'news': { label: 'News', className: 'bg-orange-50 text-orange-700 border-orange-200' },
};

export const ContentTypeBadge: React.FC<ContentTypeBadgeProps> = ({ type }) => {
  if (!type) return null;
  
  const config = contentTypeConfig[type] || contentTypeConfig.blog;
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.className} font-light border text-xs`}
    >
      {config.label}
    </Badge>
  );
};

