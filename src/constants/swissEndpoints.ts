/**
 * Swiss API Endpoints
 * 
 * These are the request values that get passed to the translator-edge/Swiss API
 * to generate different types of astrological charts.
 */

export const SWISS_ENDPOINTS = {
  NATAL: 'natal',
  TRANSITS: 'transits',
  SYNASTRY: 'synastry',
  POSITIONS: 'positions',
  MOONPHASES: 'moonphases',
  FOCUS: 'focus',
  MINDSET: 'mindset',
  WEEKLY: 'weekly',
  ESSENCE: 'essence',
  BODY_MATRIX: 'body_matrix',
  SYNC: 'sync',
} as const;

export type SwissEndpoint = typeof SWISS_ENDPOINTS[keyof typeof SWISS_ENDPOINTS];

/**
 * Chart type mappings for the Astro Data Generator UI
 * Maps user-friendly chart names to their corresponding API endpoints
 */
export const SWISS_CHART_TYPES = [
  {
    id: SWISS_ENDPOINTS.ESSENCE,
    name: 'The Self',
    description: 'Natal + Transit combined',
  },
  {
    id: SWISS_ENDPOINTS.SYNC,
    name: 'Compatibility',
    description: 'Relationship compatibility',
  },
  {
    id: SWISS_ENDPOINTS.WEEKLY,
    name: 'Weekly Snap',
    description: 'Weekly forecast',
  },
  {
    id: SWISS_ENDPOINTS.FOCUS,
    name: 'Daily Shot',
    description: 'Focus analysis',
  },
  // Legacy entries kept for backwards compatibility
  {
    id: SWISS_ENDPOINTS.NATAL,
    name: 'Natal Chart',
    description: 'Your birth chart',
  },
  {
    id: SWISS_ENDPOINTS.TRANSITS,
    name: 'Transit Chart',
    description: 'Current planetary positions',
  },
  {
    id: SWISS_ENDPOINTS.SYNASTRY,
    name: 'Synastry',
    description: 'Relationship compatibility',
  },
] as const;

/**
 * Get the display name for a Swiss chart type
 * @param chartId - The chart type ID (e.g., 'essence', 'sync', 'weekly', 'focus')
 * @returns The user-friendly display name for the chart type
 */
export const getSwissChartDisplayName = (chartId: string): string => {
  const chartType = SWISS_CHART_TYPES.find(ct => ct.id === chartId);
  return chartType?.name || 'Astro Data';
};

