
import React from 'react';
import { ParsedBlock, ReportParser } from '@/utils/reportParser';
import { ReportData, extractReportContent } from '@/utils/reportContentExtraction';

interface ReportRendererProps {
  reportData: ReportData;
  className?: string;
}

export const ReportRenderer: React.FC<ReportRendererProps> = ({ 
  reportData, 
  className = '' 
}) => {
  // Only handle AI-generated report content
  const content = extractReportContent(reportData);
  
  if (!content) {
    return (
      <div className={`text-center text-gray-500 ${className}`}>
        <p>No AI report content available.</p>
      </div>
    );
  }

  const blocks = ReportParser.parseReport(content);

  const renderBlock = (block: ParsedBlock, index: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <h3 key={index} className="font-light text-gray-900 text-lg mt-8 mb-4 first:mt-0 tracking-tight leading-relaxed">
            {block.text}
          </h3>
        );
      
      case 'action':
        return (
          <div key={index} className="ml-6 mb-3 text-gray-700 font-light leading-relaxed text-sm">
            {block.text}
          </div>
        );
      
      case 'tag':
        return (
          <div key={index} className="ml-6 mb-2 text-gray-500 text-xs font-light tracking-wide">
            {block.text}
          </div>
        );
      
      case 'spacer':
        return <div key={index} className="mb-6" />;
      
      default: // normal paragraph
        return (
          <p key={index} className="text-gray-700 font-light leading-relaxed mb-4 text-sm">
            {block.text}
          </p>
        );
    }
  };

  return (
    <div className={`prose prose-sm max-w-none font-light text-left ${className}`} style={{ fontFamily: 'Inter, sans-serif' }}>
      {blocks.map(renderBlock)}
    </div>
  );
};
