
// Content extraction helpers for raw report data
export interface ReportData {
  report_content: string | null;
  swiss_data: Record<string, unknown> | null;
  metadata: {
    content_type: 'astro' | 'ai' | 'both' | 'none';
    has_ai_report: boolean;
    has_swiss_data: boolean;
    is_ready: boolean;
    report_type: string | null;
    request_type?: string | null;
  };
  [key: string]: unknown; // Index signature for flexibility
}

export const extractReportContent = (reportData: ReportData): string => {
  return reportData.report_content || '';
};

export const getPersonName = (reportData: ReportData | null): string => {
  if (!reportData) return 'Report';
  // For now, return a generic name since we removed guest_report structure
  return 'Astrological Report';
};

export const getReportTitle = (reportData: ReportData): string => {
  const reportType = reportData.metadata?.report_type || 'astrological';
  return `Astrological Report – ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`;
};
