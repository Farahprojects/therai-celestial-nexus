import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface BlogContentFilterProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  postCounts?: {
    all: number;
    tutorial: number;
    guide: number;
    blog: number;
    news: number;
  };
}

export const BlogContentFilter: React.FC<BlogContentFilterProps> = ({ 
  activeFilter, 
  onFilterChange,
  postCounts 
}) => {
  const filters = [
    { value: 'all', label: 'All Content', count: postCounts?.all },
    { value: 'tutorial', label: 'Tutorials', count: postCounts?.tutorial },
    { value: 'guide', label: 'Guides', count: postCounts?.guide },
    { value: 'blog', label: 'Articles', count: postCounts?.blog },
    { value: 'news', label: 'News', count: postCounts?.news },
  ];

  return (
    <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-10 py-4">
      <div className="max-w-7xl mx-auto px-4">
        <Tabs value={activeFilter} onValueChange={onFilterChange} className="w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-2 border-none w-full justify-start overflow-x-auto">
            {filters.map((filter) => (
              <TabsTrigger
                key={filter.value}
                value={filter.value}
                className="data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-xl font-light px-4 py-2 whitespace-nowrap"
              >
                {filter.label}
                {typeof filter.count === 'number' && filter.count > 0 && (
                  <span className="ml-2 text-xs opacity-75">({filter.count})</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};

