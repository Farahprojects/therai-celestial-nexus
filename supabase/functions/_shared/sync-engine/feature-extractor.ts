// Layer 1: Raw Feature Extraction
// Takes Swiss data and extracts meaningful signals without interpretation

import type { AspectData, SwissData, FeatureSet } from './types.ts';

const HARMONIOUS_ASPECTS = ['trine', 'sextile', 'conjunction'];
const CHALLENGING_ASPECTS = ['square', 'opposition'];
const NEUTRAL_ASPECTS = ['semisquare', 'sesquiquadrate', 'quincunx'];

const ELEMENTS = ['fire', 'earth', 'air', 'water'];
const MODES = ['cardinal', 'fixed', 'mutable'];

const SIGN_ELEMENTS: Record<string, string> = {
  'Aries': 'fire', 'Leo': 'fire', 'Sagittarius': 'fire',
  'Taurus': 'earth', 'Virgo': 'earth', 'Capricorn': 'earth',
  'Gemini': 'air', 'Libra': 'air', 'Aquarius': 'air',
  'Cancer': 'water', 'Scorpio': 'water', 'Pisces': 'water',
};

const SIGN_MODES: Record<string, string> = {
  'Aries': 'cardinal', 'Cancer': 'cardinal', 'Libra': 'cardinal', 'Capricorn': 'cardinal',
  'Taurus': 'fixed', 'Leo': 'fixed', 'Scorpio': 'fixed', 'Aquarius': 'fixed',
  'Gemini': 'mutable', 'Virgo': 'mutable', 'Sagittarius': 'mutable', 'Pisces': 'mutable',
};

/**
 * Main feature extraction function
 * Organizes raw data without interpretation
 */
export function extractFeatures(swissData: SwissData): FeatureSet {
  const aspects = swissData?.blocks?.synastry_aspects?.pairs || 
                  swissData?.synastry_aspects?.pairs || 
                  [];

  // Count aspect types
  let harmoniousCount = 0;
  let challengingCount = 0;
  let neutralCount = 0;
  
  // Track planet links
  let moonVenusLinks = 0;
  let mercuryLinks = 0;
  let marsLinks = 0;
  let plutoLinks = 0;
  let saturnLinks = 0;
  let jupiterLinks = 0;
  let nodeLinks = 0;
  
  // Track orbs and conjunctions
  const orbs: number[] = [];
  let tightConjunctions = 0;
  
  // Track planet involvement
  let hasSaturn = false;
  let hasPluto = false;
  let hasNodes = false;
  
  // Key connections
  const keyConnections: string[] = [];

  aspects.forEach((aspect: AspectData) => {
    // Guard against malformed data
    if (!aspect?.type || !aspect?.a || !aspect?.b) {
      return;
    }

    const aspectType = aspect.type.toLowerCase();
    const planetA = aspect.a;
    const planetB = aspect.b;
    const orb = aspect.orb || 0;

    // Categorize aspect
    if (HARMONIOUS_ASPECTS.includes(aspectType)) {
      harmoniousCount++;
    } else if (CHALLENGING_ASPECTS.includes(aspectType)) {
      challengingCount++;
    } else if (NEUTRAL_ASPECTS.includes(aspectType)) {
      neutralCount++;
    }

    // Track orbs
    if (orb > 0) {
      orbs.push(orb);
    }

    // Tight conjunctions (fated/karmic indicator)
    if (aspectType === 'conjunction' && orb < 2) {
      tightConjunctions++;
    }

    // Moon-Venus links (emotional bonding)
    if ((planetA === 'Moon' || planetA === 'Venus' || planetA === 'Neptune') &&
        (planetB === 'Moon' || planetB === 'Venus' || planetB === 'Neptune')) {
      moonVenusLinks++;
    }

    // Mercury links (mental connection)
    if (planetA === 'Mercury' || planetB === 'Mercury') {
      mercuryLinks++;
    }

    // Mars links (passion, energy)
    if (planetA === 'Mars' || planetB === 'Mars') {
      marsLinks++;
    }

    // Pluto links (transformation)
    if (planetA === 'Pluto' || planetB === 'Pluto') {
      plutoLinks++;
      hasPluto = true;
    }

    // Saturn links (karma, structure, lessons)
    if (planetA === 'Saturn' || planetB === 'Saturn') {
      saturnLinks++;
      hasSaturn = true;
    }

    // Jupiter links (growth, expansion)
    if (planetA === 'Jupiter' || planetB === 'Jupiter') {
      jupiterLinks++;
    }

    // Node links (destiny, past life)
    if (planetA.includes('Node') || planetB.includes('Node')) {
      nodeLinks++;
      hasNodes = true;
    }

    // Track key connections (important planets)
    const importantPlanets = ['Sun', 'Moon', 'Venus', 'Mars', 'Mercury', 'Ascendant'];
    if (importantPlanets.includes(planetA) || importantPlanets.includes(planetB)) {
      keyConnections.push(`${planetA} ${aspect.type} ${planetB}`);
    }
  });

  // Calculate average orb
  const averageOrb = orbs.length > 0
    ? orbs.reduce((sum, orb) => sum + orb, 0) / orbs.length
    : 0;

  // Calculate elemental and modal dominance
  const { dominantElement, missingElement } = calculateElementDominance(swissData);
  const dominantMode = calculateModeDominance(swissData);

  return {
    totalAspects: aspects.length,
    harmoniousAspects: harmoniousCount,
    challengingAspects: challengingCount,
    neutralAspects: neutralCount,
    
    moonVenusLinks,
    mercuryLinks,
    marsLinks,
    plutoLinks,
    saturnLinks,
    jupiterLinks,
    nodeLinks,
    
    dominantElement,
    dominantMode,
    missingElement,
    
    averageOrb,
    tightConjunctions,
    
    hasSaturn,
    hasPluto,
    hasNodes,
    
    keyConnections: keyConnections.slice(0, 5), // Top 5
  };
}

/**
 * Calculate which element dominates across both charts
 */
function calculateElementDominance(swissData: SwissData): {
  dominantElement: string | null;
  missingElement: string | null;
} {
  const elementCounts: Record<string, number> = {
    fire: 0,
    earth: 0,
    air: 0,
    water: 0,
  };

  // Count elements from both charts
  const person1Planets = swissData?.person1?.planets || {};
  const person2Planets = swissData?.person2?.planets || {};

  Object.values(person1Planets).forEach((planet: any) => {
    const sign = planet?.sign;
    if (sign && SIGN_ELEMENTS[sign]) {
      elementCounts[SIGN_ELEMENTS[sign]]++;
    }
  });

  Object.values(person2Planets).forEach((planet: any) => {
    const sign = planet?.sign;
    if (sign && SIGN_ELEMENTS[sign]) {
      elementCounts[SIGN_ELEMENTS[sign]]++;
    }
  });

  // Find dominant and missing elements
  let maxCount = 0;
  let dominantElement: string | null = null;
  let minCount = Infinity;
  let missingElement: string | null = null;

  ELEMENTS.forEach(element => {
    const count = elementCounts[element];
    if (count > maxCount) {
      maxCount = count;
      dominantElement = element;
    }
    if (count < minCount) {
      minCount = count;
      missingElement = element;
    }
  });

  // Only consider it "missing" if truly absent
  if (minCount > 0) {
    missingElement = null;
  }

  return { dominantElement, missingElement };
}

/**
 * Calculate which mode dominates
 */
function calculateModeDominance(swissData: SwissData): string | null {
  const modeCounts: Record<string, number> = {
    cardinal: 0,
    fixed: 0,
    mutable: 0,
  };

  const person1Planets = swissData?.person1?.planets || {};
  const person2Planets = swissData?.person2?.planets || {};

  Object.values(person1Planets).forEach((planet: any) => {
    const sign = planet?.sign;
    if (sign && SIGN_MODES[sign]) {
      modeCounts[SIGN_MODES[sign]]++;
    }
  });

  Object.values(person2Planets).forEach((planet: any) => {
    const sign = planet?.sign;
    if (sign && SIGN_MODES[sign]) {
      modeCounts[SIGN_MODES[sign]]++;
    }
  });

  let maxCount = 0;
  let dominantMode: string | null = null;

  MODES.forEach(mode => {
    if (modeCounts[mode] > maxCount) {
      maxCount = modeCounts[mode];
      dominantMode = mode;
    }
  });

  return dominantMode;
}

