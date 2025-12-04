import { IndividualAstroFormatter } from '@/components/astro-formatters/IndividualAstroFormatter';
import { SynastryAstroFormatter } from '@/components/astro-formatters/SynastryAstroFormatter';
import { MonthlyAstroFormatter } from '@/components/astro-formatters/MonthlyAstroFormatter';
import { WeeklyAstroFormatter } from '@/components/astro-formatters/WeeklyAstroFormatter';
import { FocusAstroFormatter } from '@/components/astro-formatters/FocusAstroFormatter';
import { ProgressionsFormatter } from '@/components/astro-formatters/ProgressionsFormatter';
import { SolarReturnFormatter } from '@/components/astro-formatters/SolarReturnFormatter';
import { ReportData } from '@/utils/reportContentExtraction';
import { parseAstroData } from '@/lib/astroFormatter';

interface AstroDataRendererProps {
  swissData: Record<string, unknown>;
  reportData: ReportData;
}

// Helper to detect the specific type of astro report
const getAstroReportType = (swissData: Record<string, unknown>, reportData: ReportData): 'weekly' | 'monthly' | 'synastry' | 'focus' | 'progressions' | 'solar_return' | 'individual' => {
  if (!swissData) return 'individual';

  // Check request_type from metadata first (most reliable)
  const requestType = reportData?.metadata?.request_type;
  if (requestType === 'progressions') return 'progressions';
  if (requestType === 'return') return 'solar_return';

  // Check for weekly reports
  if (swissData.block_type === 'weekly') return 'weekly';

  // Check for focus reports
  if (swissData.block_type === 'focus') return 'focus';

  // Check for solar return by presence of datetime_local
  if (swissData.datetime_local) return 'solar_return';

  // Check for progressions by presence of progressed_planets
  if (swissData.progressed_planets) return 'progressions';

  const parsed = parseAstroData(swissData);

  if (parsed.monthly) return 'monthly';
  if (parsed.natal_set?.personB) return 'synastry';

  return 'individual';
};

export const AstroDataRenderer = ({ swissData, reportData }: AstroDataRendererProps) => {
  const reportType = getAstroReportType(swissData, reportData);

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
      case 'progressions':
        return <ProgressionsFormatter swissData={swissData} reportData={reportData} />;
      case 'solar_return':
        return <SolarReturnFormatter swissData={swissData} reportData={reportData} />;
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
