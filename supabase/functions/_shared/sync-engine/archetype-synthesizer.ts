// Layer 3: Archetype Synthesis
// Maps themes to archetypal identities and mythic personas

import type { Theme, Archetype } from './types.ts';

/**
 * Archetype library - mythic personas for different connection types
 */
const ARCHETYPE_LIBRARY: Record<string, Archetype[]> = {
  emotional: [
    {
      id: 'the-mirror',
      name: 'The Mirror',
      description: 'Two souls reflecting each other\'s depths',
      tone: 'reflective, empathetic, deeply understanding',
      keywords: ['empathy', 'reflection', 'understanding', 'depth'],
      colorScheme: 'soft blue and silver gradient',
    },
    {
      id: 'the-ocean',
      name: 'The Ocean',
      description: 'Emotions flow together like tides',
      tone: 'fluid, nurturing, ever-changing',
      keywords: ['flow', 'tides', 'nurture', 'depth'],
      colorScheme: 'deep teal and aquamarine gradient',
    },
    {
      id: 'two-hearts',
      name: 'Two Hearts, One Rhythm',
      description: 'Hearts beating in perfect synchrony',
      tone: 'harmonious, tender, unified',
      keywords: ['harmony', 'unity', 'tenderness', 'love'],
      colorScheme: 'rose pink and lavender gradient',
    },
  ],
  
  mental: [
    {
      id: 'the-thinkers',
      name: 'The Thinkers',
      description: 'Minds that dance in conversation',
      tone: 'intellectual, curious, stimulating',
      keywords: ['intellect', 'conversation', 'ideas', 'curiosity'],
      colorScheme: 'bright yellow and cyan gradient',
    },
    {
      id: 'the-inventors',
      name: 'The Inventors',
      description: 'Creating new worlds through shared vision',
      tone: 'innovative, visionary, collaborative',
      keywords: ['innovation', 'vision', 'creation', 'future'],
      colorScheme: 'electric blue and silver gradient',
    },
    {
      id: 'perfect-conversation',
      name: 'A Perfect Conversation',
      description: 'Words flow like music between you',
      tone: 'articulate, flowing, effortless',
      keywords: ['communication', 'flow', 'understanding', 'expression'],
      colorScheme: 'sky blue and white gradient',
    },
  ],
  
  transformational: [
    {
      id: 'the-phoenix',
      name: 'The Phoenix Pair',
      description: 'Rising from ashes, transformed together',
      tone: 'intense, renewing, growth through contrast',
      keywords: ['rebirth', 'transformation', 'power', 'depth'],
      colorScheme: 'deep purple and magenta gradient',
    },
    {
      id: 'the-alchemists',
      name: 'The Alchemists',
      description: 'Turning pain into gold together',
      tone: 'transformative, powerful, healing',
      keywords: ['alchemy', 'healing', 'power', 'transformation'],
      colorScheme: 'gold and deep violet gradient',
    },
    {
      id: 'the-catalyst',
      name: 'The Catalyst',
      description: 'Each one changes the other forever',
      tone: 'intense, evolutionary, profound',
      keywords: ['change', 'evolution', 'intensity', 'depth'],
      colorScheme: 'crimson and indigo gradient',
    },
  ],
  
  karmic: [
    {
      id: 'soul-contracts',
      name: 'The Soul Contract',
      description: 'Written in the stars before you met',
      tone: 'fated, meaningful, destined',
      keywords: ['destiny', 'fate', 'lessons', 'purpose'],
      colorScheme: 'midnight blue and gold gradient',
    },
    {
      id: 'the-teachers',
      name: 'The Teachers',
      description: 'Here to teach each other the hardest lessons',
      tone: 'challenging, meaningful, growth-oriented',
      keywords: ['lessons', 'growth', 'wisdom', 'purpose'],
      colorScheme: 'deep navy and silver gradient',
    },
    {
      id: 'ancient-souls',
      name: 'Ancient Souls',
      description: 'You\'ve known each other across lifetimes',
      tone: 'timeless, familiar, profound',
      keywords: ['timeless', 'recognition', 'depth', 'eternity'],
      colorScheme: 'dark purple and moonlight silver gradient',
    },
  ],
  
  dynamic: [
    {
      id: 'fire-meets-fire',
      name: 'Fire Meets Fire',
      description: 'Passion and energy create sparks',
      tone: 'passionate, energetic, exciting',
      keywords: ['passion', 'energy', 'spark', 'action'],
      colorScheme: 'orange and red gradient',
    },
    {
      id: 'the-warriors',
      name: 'The Warriors',
      description: 'Fighting for the same cause, side by side',
      tone: 'courageous, action-oriented, powerful',
      keywords: ['courage', 'action', 'strength', 'partnership'],
      colorScheme: 'ruby red and gold gradient',
    },
    {
      id: 'electric-connection',
      name: 'Electric Connection',
      description: 'Energy crackles between you',
      tone: 'electrifying, dynamic, alive',
      keywords: ['electricity', 'energy', 'alive', 'dynamic'],
      colorScheme: 'bright yellow and electric blue gradient',
    },
  ],
  
  growth: [
    {
      id: 'infinite-potential',
      name: 'Infinite Potential',
      description: 'Together, anything is possible',
      tone: 'expansive, optimistic, limitless',
      keywords: ['expansion', 'possibility', 'growth', 'adventure'],
      colorScheme: 'bright gold and sky blue gradient',
    },
    {
      id: 'the-explorers',
      name: 'The Explorers',
      description: 'Discovering new worlds together',
      tone: 'adventurous, curious, expanding',
      keywords: ['adventure', 'discovery', 'exploration', 'growth'],
      colorScheme: 'sunrise orange and turquoise gradient',
    },
    {
      id: 'journey-together',
      name: 'Journey Together',
      description: 'The path unfolds as you walk it',
      tone: 'progressive, optimistic, evolving',
      keywords: ['journey', 'progress', 'growth', 'partnership'],
      colorScheme: 'warm yellow and green gradient',
    },
  ],
  
  stable: [
    {
      id: 'the-foundation',
      name: 'The Foundation',
      description: 'Built to last through any storm',
      tone: 'stable, enduring, reliable',
      keywords: ['stability', 'endurance', 'trust', 'foundation'],
      colorScheme: 'forest green and brown gradient',
    },
    {
      id: 'earth-roots',
      name: 'Earth Roots',
      description: 'Grounded together in reality',
      tone: 'grounded, practical, secure',
      keywords: ['grounded', 'practical', 'roots', 'security'],
      colorScheme: 'earth brown and sage green gradient',
    },
    {
      id: 'unshakeable',
      name: 'Unshakeable',
      description: 'A connection that cannot be moved',
      tone: 'solid, dependable, lasting',
      keywords: ['solid', 'dependable', 'lasting', 'trust'],
      colorScheme: 'stone gray and forest green gradient',
    },
  ],
  
  balanced: [
    {
      id: 'cosmic-counterparts',
      name: 'Cosmic Counterparts',
      description: 'Different but perfectly complementary',
      tone: 'balanced, harmonious, complementary',
      keywords: ['balance', 'harmony', 'complement', 'wholeness'],
      colorScheme: 'purple and gold gradient',
    },
    {
      id: 'natural-connection',
      name: 'Natural Connection',
      description: 'It just works, effortlessly',
      tone: 'natural, easy, comfortable',
      keywords: ['natural', 'ease', 'comfort', 'flow'],
      colorScheme: 'soft blue and warm beige gradient',
    },
    {
      id: 'yin-yang',
      name: 'Yin & Yang',
      description: 'Opposite energies creating perfect balance',
      tone: 'balanced, complementary, unified',
      keywords: ['balance', 'opposites', 'unity', 'wholeness'],
      colorScheme: 'black and white with purple accent gradient',
    },
  ],
};

/**
 * Derive the archetypal identity from themes
 * Uses theme weights and score to select the most fitting archetype
 */
export function deriveArchetype(themes: Theme[], score: number): Archetype {
  if (themes.length === 0) {
    // Fallback to balanced archetype
    return ARCHETYPE_LIBRARY.balanced[0];
  }

  const dominantTheme = themes[0];
  const archetypes = ARCHETYPE_LIBRARY[dominantTheme.name] || ARCHETYPE_LIBRARY.balanced;

  // Select archetype based on score intensity
  // Higher scores get more intense/positive archetypes
  let selectedArchetype: Archetype;

  if (score >= 85) {
    // High score: Most positive archetype
    selectedArchetype = archetypes[0];
  } else if (score >= 70) {
    // Good score: Middle archetype
    selectedArchetype = archetypes[1] || archetypes[0];
  } else {
    // Moderate score: More nuanced archetype
    selectedArchetype = archetypes[2] || archetypes[1] || archetypes[0];
  }

  return selectedArchetype;
}

/**
 * Get all archetypes for a theme (useful for variety/randomization)
 */
export function getArchetypesForTheme(themeName: string): Archetype[] {
  return ARCHETYPE_LIBRARY[themeName] || ARCHETYPE_LIBRARY.balanced;
}

/**
 * Get archetype by ID (useful for retrieval/caching)
 */
export function getArchetypeById(archetypeId: string): Archetype | null {
  for (const archetypes of Object.values(ARCHETYPE_LIBRARY)) {
    const found = archetypes.find(a => a.id === archetypeId);
    if (found) return found;
  }
  return null;
}

