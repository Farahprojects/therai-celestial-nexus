import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SupportCategoryConfig } from '@/constants/supportContent';

interface CategoryCardProps {
  category: SupportCategoryConfig;
  onClick: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, onClick }) => {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer border border-gray-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl hover:border-gray-900 group"
    >
      <CardContent className="p-8 text-center space-y-4">
        <h3 className="text-xl font-light text-gray-900 tracking-tight">
          {category.title}
        </h3>
        <p className="text-sm text-gray-600 font-light leading-relaxed">
          {category.description}
        </p>
      </CardContent>
    </Card>
  );
};

