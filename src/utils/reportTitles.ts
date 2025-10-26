/**
 * Utility functions for generating conversation titles based on report types
 */

/**
 * Map insight report types to display names
 */
const INSIGHT_TYPE_NAMES: Record<string, string> = {
  'essence_personal': 'Personal',
  'essence_professional': 'Professional',
  'essence_relationship': 'Relationship',
  'sync_personal': 'Compatibility',
  'sync_professional': 'Co-working',
};

/**
 * Get display name for an insight report type
 * @param reportType - The report type (e.g., 'essence_personal', 'sync_professional')
 * @returns User-friendly display name
 */
export const getInsightTypeName = (reportType: string): string => {
  return INSIGHT_TYPE_NAMES[reportType] || 'Insight';
};

/**
 * Generate a conversation title for an astro reading
 * @param primaryName - Name of the primary person
 * @param secondaryName - Optional name of second person for compatibility readings
 * @returns Formatted title
 */
export const getAstroTitle = (primaryName: string, secondaryName?: string): string => {
  if (secondaryName) {
    return `${primaryName} & ${secondaryName} - Compatibility`;
  }
  return `${primaryName} - Self`;
};

/**
 * Generate a conversation title for an insight report
 * @param primaryName - Name of the primary person
 * @param reportType - The insight report type
 * @param secondaryName - Optional name of second person for dual-person insights
 * @returns Formatted title
 */
export const getInsightTitle = (
  primaryName: string, 
  reportType: string,
  secondaryName?: string
): string => {
  const typeName = getInsightTypeName(reportType);
  
  if (secondaryName) {
    return `${primaryName} & ${secondaryName} - ${typeName}`;
  }
  return `${primaryName} - ${typeName}`;
};

