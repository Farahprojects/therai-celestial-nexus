// Layer 4: Linguistic Rendering
// Generates poetic headlines and insights from archetypal data

import type { Archetype, Theme, FeatureSet } from './types.ts';

/**
 * Generate a poetic headline from archetype
 * Uses archetype name as the primary headline
 */
export function generatePoeticHeadline(archetype: Archetype, score: number): string {
  // The archetype name IS the headline (e.g., "The Phoenix Pair", "Two Hearts, One Rhythm")
  return archetype.name;
}

/**
 * Generate AI insight - the soulful one-liner
 * This is the money shot: the line that makes someone say "wow, it gets us"
 */
export function generateAiInsight(
  archetype: Archetype,
  dominantTheme: Theme,
  features: FeatureSet,
  score: number
): string {
  // Template-based insights that feel AI-generated but are deterministic
  const insights = getInsightsForArchetype(archetype.id, score, features);
  
  // Select insight based on feature patterns
  if (score >= 90) {
    return insights.exceptional;
  } else if (score >= 75) {
    return insights.strong;
  } else if (score >= 60) {
    return insights.moderate;
  } else {
    return insights.challenging;
  }
}

/**
 * Get insight templates for each archetype
 */
function getInsightsForArchetype(
  archetypeId: string,
  score: number,
  features: FeatureSet
): {
  exceptional: string;
  strong: string;
  moderate: string;
  challenging: string;
} {
  const insightLibrary: Record<string, any> = {
    'the-mirror': {
      exceptional: 'Your souls create a rare space where vulnerability becomes strength.',
      strong: 'You see each other with a clarity most people spend lifetimes searching for.',
      moderate: 'Emotions flow between you, creating moments of profound recognition.',
      challenging: 'Learning to reflect each other\'s truths, even when they\'re difficult.',
    },
    
    'the-ocean': {
      exceptional: 'Your connection is deep enough to hold every wave, every storm.',
      strong: 'Emotions move between you like tides—powerful, natural, inevitable.',
      moderate: 'You navigate emotional depths together, learning each other\'s rhythms.',
      challenging: 'Finding your flow together, even when the waters are choppy.',
    },
    
    'two-hearts': {
      exceptional: 'Your energies create a rare space where logic and intuition can dance together.',
      strong: 'Hearts beating to the same cosmic rhythm, creating profound understanding.',
      moderate: 'A connection where feelings are understood before they\'re spoken.',
      challenging: 'Learning to sync your emotional frequencies.',
    },
    
    'the-thinkers': {
      exceptional: 'Conversation flows effortlessly between you, like a river finding its path.',
      strong: 'Your minds meet in that rare space where ideas catch fire.',
      moderate: 'You spark each other\'s curiosity in ways that feel both familiar and exciting.',
      challenging: 'Finding the bridge between your different ways of thinking.',
    },
    
    'the-inventors': {
      exceptional: 'Together, you see possibilities invisible to everyone else.',
      strong: 'Your shared vision creates realities others haven\'t imagined yet.',
      moderate: 'Ideas flow between you, building something neither could create alone.',
      challenging: 'Learning to merge your visions into one shared future.',
    },
    
    'perfect-conversation': {
      exceptional: 'Words flow like music, every conversation a symphony.',
      strong: 'You speak different languages yet somehow understand perfectly.',
      moderate: 'Communication feels effortless when you\'re on the same wavelength.',
      challenging: 'Finding the words when the connection feels right but expression is hard.',
    },
    
    'the-phoenix': {
      exceptional: 'Every challenge transforms you both into something more beautiful.',
      strong: 'Intensity becomes your teacher, transformation your shared language.',
      moderate: 'Growing through contrast, learning through depth.',
      challenging: 'The friction creates heat, but also the potential for profound change.',
    },
    
    'the-alchemists': {
      exceptional: 'Together, you turn lead into gold, pain into wisdom.',
      strong: 'Your connection has the power to heal what was broken.',
      moderate: 'Learning the art of transformation together.',
      challenging: 'The raw materials are here; the alchemy takes time.',
    },
    
    'the-catalyst': {
      exceptional: 'Each one changes the other in ways that feel both terrifying and inevitable.',
      strong: 'You trigger evolution in each other just by existing.',
      moderate: 'This connection won\'t leave either of you unchanged.',
      challenging: 'Growth through intensity, even when it\'s uncomfortable.',
    },
    
    'soul-contracts': {
      exceptional: 'Written in the stars before either of you were born.',
      strong: 'Some meetings aren\'t accidents—they\'re appointments.',
      moderate: 'A sense of purpose underlies everything between you.',
      challenging: 'Karmic connections aren\'t always easy, but they\'re always meaningful.',
    },
    
    'the-teachers': {
      exceptional: 'Here to teach each other the lessons no one else could.',
      strong: 'Every challenge between you carries a hidden gift.',
      moderate: 'Learning the hardest lessons together.',
      challenging: 'The teacher can feel like the adversary until the lesson is learned.',
    },
    
    'ancient-souls': {
      exceptional: 'You\'ve known each other across lifetimes—this is just one chapter.',
      strong: 'A familiarity that transcends this lifetime.',
      moderate: 'Something in this connection feels older than both of you.',
      challenging: 'Old patterns resurface, asking to be healed.',
    },
    
    'fire-meets-fire': {
      exceptional: 'Your combined energy could move mountains or start revolutions.',
      strong: 'Passion meets passion, creating something incandescent.',
      moderate: 'The spark between you is undeniable.',
      challenging: 'Too much fire can burn, but it also illuminates.',
    },
    
    'the-warriors': {
      exceptional: 'Side by side, nothing can stand in your way.',
      strong: 'You fight for each other, with each other, never against.',
      moderate: 'Shared battles create unbreakable bonds.',
      challenging: 'Learning to channel your warrior energy together, not at each other.',
    },
    
    'electric-connection': {
      exceptional: 'Energy crackles between you—impossible to ignore, impossible to contain.',
      strong: 'The air feels charged when you\'re together.',
      moderate: 'A dynamic that keeps both of you on your toes.',
      challenging: 'Electric connections can short-circuit as easily as they ignite.',
    },
    
    'infinite-potential': {
      exceptional: 'Together, you expand into versions of yourselves you never knew existed.',
      strong: 'Every moment together opens new doors to possibility.',
      moderate: 'A sense that this connection could take you anywhere.',
      challenging: 'So much potential it almost feels overwhelming.',
    },
    
    'the-explorers': {
      exceptional: 'You\'re not just discovering the world together—you\'re discovering each other.',
      strong: 'Adventure feels natural when you\'re side by side.',
      moderate: 'Always something new to learn, explore, experience.',
      challenging: 'Growth requires stepping into the unknown together.',
    },
    
    'journey-together': {
      exceptional: 'The path unfolds perfectly, as if it was waiting for you both.',
      strong: 'You\'re not walking the same path—you\'re creating it together.',
      moderate: 'A sense of forward momentum, of evolution.',
      challenging: 'Every journey has rough terrain, but you\'re walking it together.',
    },
    
    'the-foundation': {
      exceptional: 'Built to withstand any storm, to last beyond lifetimes.',
      strong: 'A rare stability in a chaotic world.',
      moderate: 'You\'re building something solid, brick by brick.',
      challenging: 'Foundations take time, but they\'re worth the wait.',
    },
    
    'earth-roots': {
      exceptional: 'Grounded together so deeply, nothing can uproot you.',
      strong: 'A connection that feels real, solid, dependable.',
      moderate: 'Finding security in each other\'s presence.',
      challenging: 'Learning to plant roots without feeling trapped.',
    },
    
    'unshakeable': {
      exceptional: 'A connection this solid is rarer than you might think.',
      strong: 'You\'ve found something immovable in a shifting world.',
      moderate: 'Building trust, one day at a time.',
      challenging: 'Stability is being built, even if it doesn\'t feel solid yet.',
    },
    
    'cosmic-counterparts': {
      exceptional: 'Your energies create a rare space where logic and intuition can dance together.',
      strong: 'A connection this balanced is rarer than you might think.',
      moderate: 'You complement each other in ways that feel both natural and magical.',
      challenging: 'Finding balance between your different energies.',
    },
    
    'natural-connection': {
      exceptional: 'It just works, and that simplicity is its own kind of magic.',
      strong: 'The best connections don\'t require force—they just flow.',
      moderate: 'An ease between you that feels rare.',
      challenging: 'Natural doesn\'t mean effortless, but it means right.',
    },
    
    'yin-yang': {
      exceptional: 'Opposite energies that create something more whole than either alone.',
      strong: 'Your differences aren\'t obstacles—they\'re the point.',
      moderate: 'Learning to embrace contrast as complement.',
      challenging: 'Opposites attract, but they also challenge.',
    },
  };

  return insightLibrary[archetypeId] || {
    exceptional: 'A rare connection with profound depth.',
    strong: 'Something meaningful is unfolding between you.',
    moderate: 'A connection with layers waiting to be discovered.',
    challenging: 'Growth happening beneath the surface.',
  };
}

/**
 * Generate sub-headline or tagline (optional enhancement)
 */
export function generateSubheadline(archetype: Archetype, dominantTheme: Theme): string {
  return archetype.description;
}

/**
 * Generate keywords for image prompts and metadata
 */
export function generateKeywords(archetype: Archetype, themes: Theme[]): string[] {
  // Start with archetype keywords
  const keywords = [...archetype.keywords];
  
  // Add theme-specific keywords
  themes.slice(0, 2).forEach(theme => {
    if (theme.name === 'emotional') keywords.push('emotional', 'empathy');
    if (theme.name === 'mental') keywords.push('intellectual', 'communication');
    if (theme.name === 'transformational') keywords.push('transformation', 'power');
    if (theme.name === 'karmic') keywords.push('destiny', 'fate');
    if (theme.name === 'dynamic') keywords.push('energy', 'passion');
    if (theme.name === 'growth') keywords.push('expansion', 'potential');
    if (theme.name === 'stable') keywords.push('stable', 'enduring');
  });
  
  // Remove duplicates
  return [...new Set(keywords)];
}

