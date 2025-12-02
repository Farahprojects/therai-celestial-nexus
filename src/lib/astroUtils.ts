// lib/astroUtils.ts - Shared astrological utilities
export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

export const ZODIAC_GLYPHS = [
  '♈︎', '♉︎', '♊︎', '♋︎',
  '♌︎', '♍︎', '♎︎', '♏︎',
  '♐︎', '♑︎', '♒︎', '♓︎'
];

export const PLANET_NAMES: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
  chiron: 'Chiron',
  northnode: 'North Node',
  truenode: 'True Node',
  southnode: 'South Node'
};

export const ASPECT_NAMES: Record<string, string> = {
  conjunction: 'Conjunction',
  opposition: 'Opposition',
  trine: 'Trine',
  square: 'Square',
  sextile: 'Sextile',
  quincunx: 'Quincunx',
  semisextile: 'Semi-sextile',
  semisquare: 'Semi-square',
  sesquisquare: 'Sesquisquare'
};

export const degreesToSign = (lon: number) => {
  const norm = ((lon % 360) + 360) % 360;
  const signIdx = Math.floor(norm / 30);
  const deg = Math.floor(norm % 30);
  const min = Math.round(((norm % 30) - deg) * 60);
  return { 
    sign: ZODIAC_SIGNS[signIdx], 
    glyph: ZODIAC_GLYPHS[signIdx], 
    deg, 
    min 
  };
};