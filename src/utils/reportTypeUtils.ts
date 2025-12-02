/**
 * Utility functions for interpreting report types and handling Astro-only views
 */

export interface ReportDetectionData {
  reportContent?: string;
  swissData?: unknown;
  swissBoolean?: boolean;
  reportType?: string;
  hasReport?: boolean;
}

export type ReportContentType = 'hybrid' | 'astro-only' | 'ai-only' | 'empty';

export interface ToggleDisplayLogic {
  showToggle: boolean;
  defaultView: 'report' | 'astro';
  title: string;
  availableViews: ('report' | 'astro')[];
}

/**
 * Determines the actual content type based on available data
 */
export const getReportContentType = (data: ReportDetectionData): ReportContentType => {
  const hasReportContent = !!data.reportContent && data.reportContent.trim().length > 0;
  const hasSwissData = data.swissData && Object.keys(data.swissData).length > 0;
  
  if (hasReportContent && hasSwissData) return 'hybrid';
  if (hasReportContent) return 'ai-only';
  if (hasSwissData) return 'astro-only';
  return 'empty';
};

/**
 * Determines toggle logic and default view based on available data
 */
export const getToggleDisplayLogic = (data: ReportDetectionData): ToggleDisplayLogic => {
  const hasReportContent = !!data.reportContent && data.reportContent.trim().length > 0;
  const hasSwissData = data.swissData && Object.keys(data.swissData).length > 0;
  
  if (hasReportContent && hasSwissData) {
    return {
      showToggle: true,
      defaultView: 'report',
      title: 'Your Report',
      availableViews: ['report', 'astro']
    };
  }

  if (hasReportContent) {
    return {
      showToggle: false,
      defaultView: 'report',
      title: 'Your Report',
      availableViews: ['report']
    };
  }

  return {
    showToggle: false,
    defaultView: 'astro',
    title: 'Your Astro Data',
    availableViews: ['astro']
  };
};
