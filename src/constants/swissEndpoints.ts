/**
 * Swiss API Endpoints
 * 
 * These are the request values that get passed to the translator-edge/Swiss API
 * to generate different types of astrological charts.
 */

export const SWISS_ENDPOINTS = {
  NATAL: 'natal',
  TRANSITS: 'transits',
  PROGRESSIONS: 'progressions',
  SYNASTRY: 'synastry',
  POSITIONS: 'positions',
  MOONPHASES: 'moonphases',
  RETURN: 'return',
  FOCUS: 'focus',
  MINDSET: 'mindset',
  MONTHLY: 'monthly',
  ESSENCE: 'essence',
  BODY_MATRIX: 'body_matrix',
  SYNC: 'sync',
} as const;

export type SwissEndpoint = typeof SWISS_ENDPOINTS[keyof typeof SWISS_ENDPOINTS];

/**
 * Chart type mappings for the Swiss Data Generator UI
 * Maps user-friendly chart names to their corresponding API endpoints
 */
export const SWISS_CHART_TYPES = [
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
    id: SWISS_ENDPOINTS.RETURN,
    name: 'Solar Return',
    description: 'Your yearly chart',
  },
  {
    id: SWISS_ENDPOINTS.PROGRESSIONS,
    name: 'Progressed Chart',
    description: 'Your evolved chart',
  },
  {
    id: SWISS_ENDPOINTS.SYNASTRY,
    name: 'Synastry',
    description: 'Relationship compatibility',
  },
  {
    id: SWISS_ENDPOINTS.SYNC,
    name: 'Composite',
    description: 'Relationship midpoint chart',
  },
] as const;

