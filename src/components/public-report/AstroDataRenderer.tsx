
import React from 'react';
import { IndividualAstroFormatter } from '@/components/astro-formatters/IndividualAstroFormatter';
import { SynastryAstroFormatter } from '@/components/astro-formatters/SynastryAstroFormatter';
import { MonthlyAstroFormatter } from '@/components/astro-formatters/MonthlyAstroFormatter';
import { WeeklyAstroFormatter } from '@/components/astro-formatters/WeeklyAstroFormatter';
import { SolarReturnFormatter } from '@/components/astro-formatters/SolarReturnFormatter';
import { ProgressionsFormatter } from '@/components/astro-formatters/ProgressionsFormatter';
import { FocusAstroFormatter } from '@/components/astro-formatters/FocusAstroFormatter';
import { ReportData } from '@/utils/reportContentExtraction';
import { useIsMobile } from '@/hooks/use-mobile';
import { parseAstroData } from '@/lib/astroFormatter';

interface AstroDataRendererProps {
  swissData: any;
  reportData: ReportData;
}

// New helper to detect the specific type of astro report
  const getAstroReportType = (swissData: any): 'weekly' | 'monthly' | 'synastry' | 'solar_return' | 'progressions' | 'focus' | 'individual' => {
    if (!swissData) return 'individual'; // Fallback
    
    // Check for weekly data structure (block_type: "weekly")
    if (swissData.block_type === 'weekly') {
      return 'weekly';
    }
    
    // Check for focus data structure (block_type: "focus")
    if (swissData.block_type === 'focus') {
      return 'focus';
    }
    
    // Check for Progressions data structure (aspects_to_natal + progressed_planets)
    if (swissData.aspects_to_natal && swissData.progressed_planets) {
      return 'progressions';
    }
    
    // Check for flat structure with return_type (Solar Return)
    if (swissData.return_type === 'solar' || swissData.return_type) {
      return 'solar_return';
    }
    
    // Check for flat structure with planets at root level (could be solar return)
    if (swissData.planets && !swissData.blocks && !swissData.natal_set) {
      // If it has datetime_local, it's likely a solar return
      if (swissData.datetime_local) {
        return 'solar_return';
      }
      // Otherwise assume individual
      return 'individual';
    }
    
    const parsed = parseAstroData(swissData);
    
    if (parsed.monthly) return 'monthly';
    if (parsed.natal_set?.personB) return 'synastry';
    
    return 'individual';
  };

export const AstroDataRenderer = ({ swissData, reportData }: AstroDataRendererProps) => {
  const isMobile = useIsMobile();
  const reportType = getAstroReportType(swissData);

  const renderContent = () => {
    switch(reportType) {
      case 'weekly':
        return <WeeklyAstroFormatter swissData={swissData} reportData={reportData} />;
      case 'monthly':
        return <MonthlyAstroFormatter swissData={swissData} reportData={reportData} />;
      case 'synastry':
        return <SynastryAstroFormatter swissData={swissData} reportData={reportData} />;
      case 'solar_return':
        return <SolarReturnFormatter swissData={swissData} reportData={reportData} />;
      case 'progressions':
        return <ProgressionsFormatter swissData={swissData} reportData={reportData} />;
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
