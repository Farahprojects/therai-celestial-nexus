// Core types for the sync engine interpretive system

export interface AspectData {
  type: string;
  a: string; // planet name A
  b: string; // planet name B
  orb?: number;
}

export interface SwissData {
  blocks?: {
    synastry_aspects?: {
      pairs?: AspectData[];
    };
  };
  synastry_aspects?: {
    pairs?: AspectData[];
  };
  person1?: {
    planets?: Record<string, { sign?: string }>;
  };
  person2?: {
    planets?: Record<string, { sign?: string }>;
  };
}

export interface FeatureSet {
  // Quantitative signals
  totalAspects: number;
  harmoniousAspects: number;
  challengingAspects: number;
  neutralAspects: number;
  
  // Planet link patterns
  moonVenusLinks: number;
  mercuryLinks: number;
  marsLinks: number;
  plutoLinks: number;
  saturnLinks: number;
  jupiterLinks: number;
  nodeLinks: number;
  
  // Qualitative patterns
  dominantElement: string | null;
  dominantMode: string | null;
  missingElement: string | null;
  
  // Aspect quality
  averageOrb: number;
  tightConjunctions: number; // orb < 2
  
  // Specific planet involvement
  hasSaturn: boolean;
  hasPluto: boolean;
  hasNodes: boolean;
  
  // Key connections for reference
  keyConnections: string[];
}

export interface Theme {
  name: string;
  weight: number; // 0-1, how strongly this theme is present
  signals: string[]; // What triggered this theme
}

export interface Archetype {
  id: string;
  name: string; // e.g., "The Phoenix Pair"
  description: string; // Short archetypal description
  tone: string; // e.g., "intense, renewing, growth through contrast"
  keywords: string[];
  colorScheme: string; // For image generation
}

export interface ConnectionProfile {
  score: number; // 0-100
  features: FeatureSet;
  themes: Theme[];
  dominantTheme: Theme;
  archetype: Archetype;
  headline: string;
  insight: string;
  keywords: string[];
  colorScheme: string;
}

