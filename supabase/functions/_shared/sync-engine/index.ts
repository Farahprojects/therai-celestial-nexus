// Sync Engine: Main Pipeline Orchestrator
// The semantic interpreter that turns astrological data into meaningful narratives

import type { SwissData, ConnectionProfile } from './types.ts';
import { extractFeatures } from './feature-extractor.ts';
import { detectThemes, getDominantTheme } from './theme-detector.ts';
import { deriveArchetype } from './archetype-synthesizer.ts';
import {
  generatePoeticHeadline,
  generateAiInsight,
  generateKeywords,
  generateSubheadline,
} from './text-renderer.ts';

/**
 * Calculate weighted score from features
 * Formula: Base 50 + (harmonious weight) - (challenging weight)
 * Incorporates aspect quality, orbs, and planet importance
 */
function calculateScore(features: any): number {
  // Base calculation using aspect ratios
  const totalAspects = features.totalAspects || 1; // Avoid division by zero
  const harmoniousRatio = features.harmoniousAspects / totalAspects;
  const challengingRatio = features.challengingAspects / totalAspects;
  
  // Weight harmonious aspects more heavily
  let baseScore = 50;
  baseScore += harmoniousRatio * 50; // Max +50 from harmonious
  baseScore -= challengingRatio * 25; // Max -25 from challenging
  
  // Bonuses for quality indicators
  if (features.moonVenusLinks >= 2) baseScore += 5; // Emotional bonding
  if (features.tightConjunctions >= 2) baseScore += 5; // Fated connections
  if (features.averageOrb < 2) baseScore += 5; // Tight orbs = strong connection
  if (features.keyConnections.length >= 3) baseScore += 5; // Many key connections
  
  // Penalties
  if (features.challengingAspects > features.harmoniousAspects * 2) baseScore -= 10;
  
  // Normalize to 0-100
  return Math.min(100, Math.max(0, Math.round(baseScore)));
}

/**
 * Main pipeline: Generate complete connection profile
 * This is the semantic engine that translates data into meaning
 */
export function generateConnectionProfile(swissData: SwissData): ConnectionProfile {
  // Layer 1: Extract raw features
  const features = extractFeatures(swissData);
  
  // Layer 2: Detect themes
  const themes = detectThemes(features);
  const dominantTheme = getDominantTheme(themes);
  
  // Calculate numerical score
  const score = calculateScore(features);
  
  // Layer 3: Derive archetype (mythic persona)
  const archetype = deriveArchetype(themes, score);
  
  // Layer 4: Render linguistic content
  const headline = generatePoeticHeadline(archetype, score);
  const insight = generateAiInsight(archetype, dominantTheme, features, score);
  const keywords = generateKeywords(archetype, themes);
  
  // Return complete profile
  return {
    score,
    features,
    themes,
    dominantTheme,
    archetype,
    headline,
    insight,
    keywords,
    colorScheme: archetype.colorScheme,
  };
}

/**
 * Export all sub-modules for direct access if needed
 */
export { extractFeatures } from './feature-extractor.ts';
export { detectThemes, getDominantTheme } from './theme-detector.ts';
export { deriveArchetype, getArchetypesForTheme, getArchetypeById } from './archetype-synthesizer.ts';
export {
  generatePoeticHeadline,
  generateAiInsight,
  generateKeywords,
  generateSubheadline,
} from './text-renderer.ts';

// Export types
export type * from './types.ts';

