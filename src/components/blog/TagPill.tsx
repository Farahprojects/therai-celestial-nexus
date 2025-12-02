import React from 'react';

interface TagPillProps {
  tag: string;
}

export const TagPill: React.FC<TagPillProps> = ({ tag }) => {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-light bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
      {tag}
    </span>
  );
};