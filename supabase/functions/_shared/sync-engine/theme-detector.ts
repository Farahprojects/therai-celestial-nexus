// Layer 2: Theme Classification
// Pattern recognition that tags semantic themes

import type { FeatureSet, Theme } from './types.ts';

/**
 * Detect all active themes and their weights
 * Returns themes sorted by weight (strongest first)
 */
export function detectThemes(features: FeatureSet): Theme[] {
  const themes: Theme[] = [];

  // EMOTIONAL THEME
  // Triggered by: Moon-Venus-Neptune links, water element, harmonious aspects
  const emotionalSignals: string[] = [];
  let emotionalWeight = 0;

  if (features.moonVenusLinks > 0) {
    emotionalWeight += 0.4;
    emotionalSignals.push(`${features.moonVenusLinks} emotional planet link(s)`);
  }

  if (features.dominantElement === 'water') {
    emotionalWeight += 0.3;
    emotionalSignals.push('water element dominance');
  }

  if (features.harmoniousAspects > features.challengingAspects * 1.5) {
    emotionalWeight += 0.2;
    emotionalSignals.push('harmonious flow');
  }

  if (emotionalWeight > 0) {
    themes.push({
      name: 'emotional',
      weight: Math.min(1, emotionalWeight),
      signals: emotionalSignals,
    });
  }

  // MENTAL THEME
  // Triggered by: Mercury links, air element, communication patterns
  const mentalSignals: string[] = [];
  let mentalWeight = 0;

  if (features.mercuryLinks >= 2) {
    mentalWeight += 0.5;
    mentalSignals.push(`${features.mercuryLinks} mental connection(s)`);
  }

  if (features.dominantElement === 'air') {
    mentalWeight += 0.4;
    mentalSignals.push('air element dominance');
  }

  if (mentalWeight > 0) {
    themes.push({
      name: 'mental',
      weight: Math.min(1, mentalWeight),
      signals: mentalSignals,
    });
  }

  // TRANSFORMATIONAL THEME
  // Triggered by: Pluto links, Scorpio emphasis, intensity
  const transformationalSignals: string[] = [];
  let transformationalWeight = 0;

  if (features.plutoLinks > 0) {
    transformationalWeight += 0.5;
    transformationalSignals.push(`${features.plutoLinks} Pluto connection(s)`);
  }

  if (features.hasSaturn && features.challengingAspects > 0) {
    transformationalWeight += 0.3;
    transformationalSignals.push('Saturn lessons present');
  }

  if (features.dominantElement === 'water' && features.marsLinks > 0) {
    transformationalWeight += 0.2;
    transformationalSignals.push('emotional intensity');
  }

  if (transformationalWeight > 0) {
    themes.push({
      name: 'transformational',
      weight: Math.min(1, transformationalWeight),
      signals: transformationalSignals,
    });
  }

  // KARMIC THEME
  // Triggered by: Saturn, Nodes, tight conjunctions, challenging aspects
  const karmicSignals: string[] = [];
  let karmicWeight = 0;

  if (features.hasNodes) {
    karmicWeight += 0.4;
    karmicSignals.push('nodal connections (past life)');
  }

  if (features.hasSaturn && features.saturnLinks >= 2) {
    karmicWeight += 0.4;
    karmicSignals.push('strong Saturn presence (karmic lessons)');
  }

  if (features.tightConjunctions >= 2) {
    karmicWeight += 0.3;
    karmicSignals.push('tight conjunctions (fated meeting)');
  }

  if (karmicWeight > 0) {
    themes.push({
      name: 'karmic',
      weight: Math.min(1, karmicWeight),
      signals: karmicSignals,
    });
  }

  // DYNAMIC THEME
  // Triggered by: Mars links, fire element, action-oriented energy
  const dynamicSignals: string[] = [];
  let dynamicWeight = 0;

  if (features.marsLinks >= 2) {
    dynamicWeight += 0.4;
    dynamicSignals.push(`${features.marsLinks} Mars connection(s)`);
  }

  if (features.dominantElement === 'fire') {
    dynamicWeight += 0.4;
    dynamicSignals.push('fire element dominance');
  }

  if (features.dominantMode === 'cardinal') {
    dynamicWeight += 0.2;
    dynamicSignals.push('cardinal mode (initiating energy)');
  }

  if (dynamicWeight > 0) {
    themes.push({
      name: 'dynamic',
      weight: Math.min(1, dynamicWeight),
      signals: dynamicSignals,
    });
  }

  // GROWTH THEME
  // Triggered by: Jupiter links, expansion, learning together
  const growthSignals: string[] = [];
  let growthWeight = 0;

  if (features.jupiterLinks >= 2) {
    growthWeight += 0.5;
    growthSignals.push(`${features.jupiterLinks} Jupiter expansion(s)`);
  }

  if (features.dominantElement === 'fire' && features.harmoniousAspects > features.challengingAspects) {
    growthWeight += 0.3;
    growthSignals.push('optimistic fire energy');
  }

  if (growthWeight > 0) {
    themes.push({
      name: 'growth',
      weight: Math.min(1, growthWeight),
      signals: growthSignals,
    });
  }

  // STABLE THEME
  // Triggered by: Earth element, fixed mode, Saturn in harmony
  const stableSignals: string[] = [];
  let stableWeight = 0;

  if (features.dominantElement === 'earth') {
    stableWeight += 0.4;
    stableSignals.push('earth element dominance');
  }

  if (features.dominantMode === 'fixed') {
    stableWeight += 0.3;
    stableSignals.push('fixed mode (enduring connection)');
  }

  if (features.hasSaturn && features.harmoniousAspects > features.challengingAspects) {
    stableWeight += 0.3;
    stableSignals.push('Saturn provides structure');
  }

  if (stableWeight > 0) {
    themes.push({
      name: 'stable',
      weight: Math.min(1, stableWeight),
      signals: stableSignals,
    });
  }

  // BALANCED THEME (fallback)
  // Triggered when no strong theme emerges or multiple themes are equally weighted
  if (themes.length === 0) {
    themes.push({
      name: 'balanced',
      weight: 0.5,
      signals: ['diverse aspects present'],
    });
  }

  // Sort by weight (strongest theme first)
  return themes.sort((a, b) => b.weight - a.weight);
}

/**
 * Get the single dominant theme
 */
export function getDominantTheme(themes: Theme[]): Theme {
  if (themes.length === 0) {
    return {
      name: 'balanced',
      weight: 0.5,
      signals: ['no specific dominance'],
    };
  }

  return themes[0];
}

