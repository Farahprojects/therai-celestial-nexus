
import React from 'react';
import { IndividualAstroFormatter } from '@/components/astro-formatters/IndividualAstroFormatter';
import { SynastryAstroFormatter } from '@/components/astro-formatters/SynastryAstroFormatter';
import { MonthlyAstroFormatter } from '@/components/astro-formatters/MonthlyAstroFormatter';
import { WeeklyAstroFormatter } from '@/components/astro-formatters/WeeklyAstroFormatter';
import { FocusAstroFormatter } from '@/components/astro-formatters/FocusAstroFormatter';
import { ReportData } from '@/utils/reportContentExtraction';
import { parseAstroData } from '@/lib/astroFormatter';

interface AstroDataRendererProps {
  swissData: Record<string, unknown>;
  reportData: ReportData;
}

// New helper to detect the specific type of astro report
  const getAstroReportType = (swissData: Record<string, unknown>): 'weekly' | 'monthly' | 'synastry' | 'focus' | 'individual' => {
    if (!swissData) return 'individual'; // Fallback
    
    // Check for weekly data structure (block_type: "weekly")
    if (swissData.block_type === 'weekly') {
      return 'weekly';
    }
    
    // Check for focus data structure (block_type: "focus")
    if (swissData.block_type === 'focus') {
      return 'focus';
    }
    
    
    const parsed = parseAstroData(swissData);
    
    if (parsed.monthly) return 'monthly';
    if (parsed.natal_set?.personB) return 'synastry';
    
    return 'individual';
  };

export const AstroDataRenderer = ({ swissData, reportData }: AstroDataRendererProps) => {
  const reportType = getAstroReportType(swissData);

  const renderContent = () => {
    switch(reportType) {
      case 'weekly':
        return <WeeklyAstroFormatter swissData={swissData} reportData={reportData} />;
      case 'monthly':
        return <MonthlyAstroFormatter swissData={swissData} reportData={reportData} />;
      case 'synastry':
        return <SynastryAstroFormatter swissData={swissData} reportData={reportData} />;
      case 'focus':
        return <FocusAstroFormatter swissData={swissData} reportData={reportData} />;
      case 'individual':
      default:
        return <IndividualAstroFormatter swissData={swissData} reportData={reportData} />;
    }
  };

  return (
    <div>
      {renderContent()}
    </div>
  );
};

// Export the detection function for use elsewhere
export { getAstroReportType };
