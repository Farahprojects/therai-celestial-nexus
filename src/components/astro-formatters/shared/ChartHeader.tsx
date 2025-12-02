
import React from 'react';

interface ChartHeaderProps {
  name: string;
  birthDate?: string;
  birthLocation?: string;
  latitude?: number;
  longitude?: number;
  title?: string;
  date?: string;       // Analysis date for sync reports
  subtitle?: string;   // Additional subtitle text
}

export const ChartHeader: React.FC<ChartHeaderProps> = ({
  name,
  birthDate,
  birthLocation,
  latitude,
  longitude,
  title,
  date,
  subtitle
}) => {
  const coordinates = latitude && longitude ? `${latitude}°, ${longitude}°` : '';
  
  return (
    <div className="text-center mb-6 md:mb-12 pb-4 md:pb-8 border-b border-gray-200">
      <h1 className="text-3xl md:text-4xl font-light text-gray-900 mb-6 md:mb-8 tracking-tight">
        {title || `${name}'s Astro Data`}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 text-sm md:text-sm text-gray-700 max-w-lg mx-auto">
        <div className="md:text-right">
          {birthDate && <p className="text-gray-600">{birthDate}</p>}
        </div>
        <div className="md:text-left">
          {birthLocation && <p className="font-medium text-gray-900">{birthLocation}</p>}
          {coordinates && <p className="text-xs text-gray-500">{coordinates}</p>}
        </div>
        {(date || subtitle) && (
          <div className="md:col-span-2 text-sm md:text-xs text-gray-500 pt-2 md:pt-3 mt-2 md:mt-3 border-t border-gray-100">
            {date && <p>Analysis: {date}</p>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
      </div>
    </div>
  );
};
