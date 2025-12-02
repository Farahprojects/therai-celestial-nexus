// TypeScript interfaces for astro data structures

export interface Planet {
  name: string;
  sign: string;
  deg: number;
  house: number | null;
  retrograde: boolean;
  sign_num: number;
  sign_icon: string;
  unicode: string;
}

export interface Angle {
  name: string;
  sign: string;
  deg: number;
}

export interface House {
  number: number;
  sign: string;
  deg: number;
}

export interface Aspect {
  a: string;
  b: string;
  orb: number;
  type: string;
  a_unicode: string;
  b_unicode: string;
  aspect_unicode: string;
  aspect_group: 'easy' | 'hard' | 'neutral';
  orb_band: 'tight' | 'medium' | 'wide' | 'exact';
  orbMin: number;
}

export interface NatalData {
  name: string;
  planets: Planet[];
  angles: Angle[];
  houses: House[];
  aspects: Aspect[];
}

export interface NatalSetData {
  personA: NatalData | undefined;
  personB: NatalData | undefined;
}

export interface TransitData {
  datetime_utc: string | undefined;
  timezone: string | undefined;
  planets: Planet[];
  aspects_to_natal: Aspect[];
}

export interface CompositeChartData {
  planets: Planet[];
}

export interface SynastryAspectsData {
  aspects: Aspect[];
}

export interface WeeklyData {
  block_type: string;
  // Weekly data structure - to be expanded as needed
  [key: string]: unknown;
}

export interface SubjectData {
  name?: string;
  location?: string;
  lat?: number;
  lon?: number;
  [key: string]: unknown;
}

export interface MetaData {
  [key: string]: unknown;
}

// Main parsed astro data interface
export interface ParsedAstroData {
  meta: MetaData;
  subject: SubjectData;
  natal?: NatalData | null;
  natal_set?: NatalSetData | null;
  transits?: TransitData | null;
  composite_chart?: CompositeChartData | null;
  synastry_aspects?: SynastryAspectsData | null;
  weekly?: WeeklyData | null;
  [key: string]: unknown; // Allow for additional unknown properties
}
