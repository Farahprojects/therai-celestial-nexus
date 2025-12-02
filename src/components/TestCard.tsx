
import React, { useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TestCardProps {
  title: string;
  description: string;
  subDescriptions?: string[];
  path: string;
  isActive: boolean;
  onHover: () => void;
  onExplore?: () => void;
  icon: LucideIcon;
  mobileLayout?: 'text-first' | 'image-first';
}

export const TestCard = ({ title, description, subDescriptions, isActive, onHover, onExplore }: TestCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();

  const handleExploreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onExplore) {
      onExplore();
    }
  };

  const handleCardClick = () => {
    if (isMobile && onExplore) {
      onExplore();
    }
  };

  return (
    <div 
      className={`py-2 px-4 transition-all duration-500 group ${
        isMobile ? 'cursor-pointer' : 'cursor-pointer'
      }`}
      onMouseEnter={() => {
        onHover();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={isMobile ? handleCardClick : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center md:text-left">
          <h3 className={`text-sm sm:text-base md:text-3xl lg:text-4xl font-light transition-all duration-500 tracking-tight transform ${
            isActive || isHovered 
              ? 'text-gray-900 scale-105 drop-shadow-sm' 
              : 'text-gray-500 scale-100'
          }`}>
            {title}
          </h3>
          {subDescriptions && subDescriptions.length > 0 ? (
            <div className="mt-1 space-y-1">
              {subDescriptions.map((subDesc, index) => (
                <p key={index} className="text-xs text-gray-600 font-normal leading-relaxed">
                  {subDesc}
                </p>
              ))}
            </div>
          ) : description && (
            <p className="text-xs sm:text-sm text-gray-700 mt-1 font-normal">{description}</p>
          )}
        </div>
        
        <div className="ml-8 hidden md:block">
          <button
            onClick={handleExploreClick}
            className={`px-8 py-3 rounded-full font-medium transition-all duration-500 transform ${
              isHovered
                ? 'bg-gray-900 text-white opacity-100 translate-x-0 scale-100 shadow-lg'
                : 'bg-gray-100 text-gray-500 opacity-0 -translate-x-4 scale-95'
            }`}
          >
            Explore
          </button>
        </div>
      </div>
    </div>
  );
};
