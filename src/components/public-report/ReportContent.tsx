
import React from 'react';
import { ReportRenderer } from '@/components/shared/ReportRenderer';
import { ReportData } from '@/utils/reportContentExtraction';
import { AstroDataRenderer } from './AstroDataRenderer';

interface ReportContentProps {
  reportData: ReportData;
  activeView: 'report' | 'astro';
  setActiveView: (view: 'report' | 'astro') => void;
  isMobile?: boolean;
}

export const ReportContent: React.FC<ReportContentProps> = ({
  reportData,
  activeView
}) => {
  const hasAiContent = !!reportData.report_content && reportData.report_content.trim().length > 20;
  const hasAstroContent = !!reportData.swiss_data;

  const renderAstroContent = () => {
    if (!hasAstroContent) return null;
    return <AstroDataRenderer swissData={reportData.swiss_data} reportData={reportData} />;
  };

  const renderContent = () => {
    if (hasAiContent && hasAstroContent) {
      // 'both' case: render with a toggle
      return (
        <div className="max-w-4xl mx-auto px-0 md:px-4 py-8">
          {activeView === 'astro' ? renderAstroContent() : <ReportRenderer reportData={reportData} />}
        </div>
      );
    } else if (hasAstroContent) {
      // 'astro' only case
      return (
        <div className="max-w-4xl mx-auto px-0 md:px-4 py-8">
          {renderAstroContent()}
        </div>
      );
    } else if (hasAiContent) {
      // 'ai' only case
      return (
        <div className="max-w-4xl mx-auto px-0 md:px-4 py-8">
          <ReportRenderer reportData={reportData} />
        </div>
      );
    } else {
      // Default empty case
      return (
        <div className="max-w-4xl mx-auto px-0 md:px-4 py-8">
          <div className="text-center text-gray-500">
            <p>No content available for this report.</p>
          </div>
        </div>
      );
    }
  };

  const content = renderContent();
  
  return content;
};
