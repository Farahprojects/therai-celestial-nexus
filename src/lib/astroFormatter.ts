// lib/astroFormatter.ts - Astrological data formatter for Swiss Ephemeris sync v1.1+
import { ZODIAC_SIGNS } from './astroUtils';

type PlanetDetail = {
  deg: number;
  sign: string;
  house: number | null;
  retrograde: boolean;
};

type EnrichedPlanet = PlanetDetail & {
  name: string;
  sign_num: number;
  sign_icon: string;
  unicode: string;
};

type Aspect = {
  a: string;
  b: string;
  orb: number;
  type: string;
};

type EnrichedAspect = Aspect & {
  a_unicode: string;
  b_unicode: string;
  aspect_unicode: string;
  aspect_group: 'easy' | 'hard' | 'neutral';
  orb_band: 'tight' | 'medium' | 'wide' | 'exact';
  orbMin: number;
};

const ZODIAC_TO_NUM = ZODIAC_SIGNS.reduce((acc, sign, i) => {
  acc[sign.toLowerCase()] = i;
  return acc;
}, {} as Record<string, number>);

const PLANET_UNICODE: { [key: string]: string } = {
  Sun: '☉',
  Moon: '☽',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
  Chiron: '⚷',
  TrueNode: '☊',
  ASC: 'Asc',
  MC: 'MC',
  DSC: 'Dsc',
  IC: 'IC'
};

const ASPECT_UNICODE: { [key: string]: string } = {
  Conjunction: '☌',
  Opposition: '☍',
  Trine: '△',
  Square: '□',
  Sextile: ' sextile ',
  Quintile: '☌☌☌☌☌',
  Septile: '☌☌☌☌☌☌☌',
  Trisection: '☌☍☌',
  Decile: '☌☌☌☌☌☌☌☌☌'
};

const ASPECT_GROUP: { [key: string]: 'easy' | 'hard' | 'neutral' } = {
  Conjunction: 'neutral',
  Opposition: 'hard',
  Trine: 'easy',
  Square: 'hard',
  Sextile: 'easy',
  Quintile: 'easy',
  Septile: 'neutral',
  Trisection: 'neutral',
  Decile: 'neutral'
};

const getOrbBand = (orb: number): 'tight' | 'medium' | 'wide' | 'exact' => {
  if (orb < 0.5) return 'exact';
  if (orb < 2) return 'tight';
  if (orb < 5) return 'medium';
  return 'wide';
};

const enrichPlanets = (planets: { [key: string]: PlanetDetail }): EnrichedPlanet[] => {
  if (!planets || typeof planets !== 'object') return [];
  return Object.entries(planets).map(([name, details]) => {
    const signNum = ZODIAC_TO_NUM[details.sign.toLowerCase()] || 0;
    return {
      ...details,
      name,
      sign_num: signNum,
      sign_icon: ZODIAC_SIGNS[signNum],
      unicode: PLANET_UNICODE[name]
    };
  });
};

const enrichAspects = (aspects: Aspect[]): EnrichedAspect[] => {
  if (!Array.isArray(aspects)) return [];
  return aspects.map(a => {
    const orbMin = Math.floor(a.orb);
    return {
      ...a,
      a_unicode: PLANET_UNICODE[a.a],
      b_unicode: PLANET_UNICODE[a.b],
      aspect_unicode: ASPECT_UNICODE[a.type],
      aspect_group: ASPECT_GROUP[a.type],
      orb_band: getOrbBand(a.orb),
      orbMin
    };
  });
};

const parseNatal = (block: any) => {
  if (!block) return null;
  const personData = block; // In single reports, the block is the person data

  const anglesArray = personData.angles
    ? Object.entries(personData.angles).map(([name, data]: [string, any]) => ({
        name,
        ...data
      }))
    : [];

  return {
    name: personData.name || 'Unknown',
    planets: enrichPlanets(personData.planets ?? {}),
    angles: anglesArray,
    houses: personData.houses ?? [],
    aspects: enrichAspects(personData.aspects ?? [])
  };
};

const parseNatalSet = (block: any) => {
  if (!block || !block.subjects) return null;

  const processPerson = (personData: any) => {
    if (!personData) return undefined;

    const anglesArray = personData.angles 
      ? Object.entries(personData.angles).map(([name, data]: [string, any]) => ({
          name,
          ...data
        }))
      : [];

    return {
      name: personData.name || 'Unknown',
      planets: enrichPlanets(personData.planets ?? {}),
      angles: anglesArray,
      houses: personData.houses ?? [],
      aspects: enrichAspects(personData.aspects ?? [])
    };
  };

  return {
    personA: processPerson(block.subjects.person_a),
    personB: processPerson(block.subjects.person_b)
  };
};

const parseTransits = (block: any) => {
  if (!block) return null;

  // For single-person transits, the data is at the root of the block.
  // The old implementation incorrectly looked for person_a/person_b.
  return {
    datetime_utc: block.datetime_utc,
    timezone: block.timezone,
    planets: enrichPlanets(block.planets ?? {}),
    aspects_to_natal: enrichAspects(block.aspects_to_natal ?? [])
  };
};

const parseCompositeChart = (block: any) => {
  if (!block || !block.planets) return null;
  // Return the enriched planets array directly to match the expected data structure.
  return enrichPlanets(block.planets);
};

const parseSynastryAspects = (block: any) => {
  if (!block || !block.pairs) return null;
  return {
    aspects: enrichAspects(block.pairs)
  };
};

/**
 * New dynamic parser for swiss ephemeris sync data (v1.1+)
 * It dispatches parsing to dedicated functions based on `block_type`.
 */
export const parseAstroData = (raw: any): any => {
  if (!raw || typeof raw !== 'object') {
    console.warn('⚠️ [parseAstroData] received invalid or empty data');
    return {};
  }

  const parsedData: any = {
    meta: raw.meta ?? {},
    subject: raw.subject ?? {} // Carry over subject info
  };

  // Handle single-block, top-level report types like 'weekly'
  if (raw.block_type) {
    switch(raw.block_type) {
      case 'weekly':
        // The core data is in the 'components' object for weekly reports
        parsedData.weekly = raw.components;
        // Also attach the top-level block type for easy identification
        if (parsedData.weekly) {
            parsedData.weekly.block_type = 'weekly';
        }
        return parsedData;
    }
  }

  // Continue with existing logic for multi-block reports (natal, synastry)
  const dataRoot = raw.blocks || raw;

  for (const key in dataRoot) {
    if (dataRoot.hasOwnProperty(key) && typeof dataRoot[key] === 'object' && dataRoot[key]?.block_type) {
      const block = dataRoot[key];
      switch (block.block_type) {
        case 'natal':
          parsedData.natal = parseNatal(block);
          break;
        case 'natal_set':
          parsedData.natal_set = parseNatalSet(block);
          break;
        case 'transits':
          parsedData.transits = parseTransits(block);
          break;
        case 'composite':
          parsedData.composite_chart = parseCompositeChart(block);
          break;
        case 'synastry':
          parsedData.synastry_aspects = parseSynastryAspects(block);
          break;
        default:
          console.warn(`[parseAstroData] Unknown block_type: "${block.block_type}"`);
          parsedData[key] = block; // Carry over unknown blocks
      }
    }
  }

  return parsedData;
};

// Helper to detect if data is synastry/sync format
export const isSynastryData = (raw: any): boolean => {
  if (!raw) return false;

  // The new format is identifiable by the explicit `block_type` keys.
  return (
    raw.block_type === 'monthly' ||
    raw.blocks?.natal?.block_type === 'natal' ||
    raw.natal?.block_type === 'natal_set' ||
    raw.synastry_aspects?.block_type === 'synastry' ||
    raw.composite_chart?.block_type === 'composite'
  );
};
