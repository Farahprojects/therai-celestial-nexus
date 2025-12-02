
// Pure utility functions for report handling
export type ReportType = 
  | 'sync' 
  | 'essence' 
  | 'sync_compatibility' 
  | 'sync_personal' 
  | 'sync_professional'
  | 'essence_personal'
  | 'essence_professional'
  | 'essence_relationship'
  | string; // Allow any string for flexibility

const ASTRO_REPORTS = new Set<ReportType>(['sync', 'essence']);

export const isAstroReport = (reportType: string | null): boolean => {
  if (!reportType) return false;
  return ASTRO_REPORTS.has(reportType as ReportType);
};

export const getSwissErrorMessage = (reportType: string | null): string => {
  if (reportType === 'essence') {
    return 'Unable to generate your astrological essence data. This can happen due to incomplete birth information or system issues.';
  }
  return 'Astrological calculation failed. Please ensure your birth details are accurate and try again.';
};

export const getGuestReportId = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // Guest report ID is no longer stored in sessionStorage
  
  // Fallback to localStorage for backward compatibility
  return localStorage.getItem('currentGuestReportId');
};
