import { ReportTypeOption } from '@/types/public-report';
import { User, Heart, Target, Briefcase, Users } from 'lucide-react';

export const reportTypes: ReportTypeOption[] = [
  { value: 'sync', label: 'Compatibility Report' },
  { value: 'essence', label: 'The Self Report' },
  { value: 'flow', label: 'Flow Report' },
  { value: 'mindset', label: 'Mindset Report' },
  { value: 'monthly', label: 'Energy Month Report' },
  { value: 'focus', label: 'Focus Report' },
];

export const relationshipTypes: ReportTypeOption[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'professional', label: 'Professional' },
];

export const essenceTypes: ReportTypeOption[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'professional', label: 'Professional' },
  { value: 'relational', label: 'Relational' },
];

export const reportCategories = [
  {
    value: 'the-self',
    title: 'The Self',
    description: 'Unlock your authentic self and discover your hidden potential',
    icon: User,
    reportType: 'essence',
  },
  {
    value: 'compatibility',
    title: 'Compatibility',
    description: 'Discover relationship dynamics & unlock deeper connections',
    icon: Users,
    reportType: 'sync',
  },
  {
    value: 'astro-data',
    title: 'Astro Data',
    description: 'Raw astrological data - instant ephemeris calculations',
    icon: Target,
    reportType: 'astro-data', // used only for category selection, will be cleared later
  },
];

export const snapshotSubCategories = [];

export const detailedEssenceTypes = [
  {
    value: 'personal',
    title: 'Personal',
    description: 'Deep self-awareness and unlock your authentic potential',
    icon: User,
  },
  {
    value: 'professional',
    title: 'Professional',
    description: 'Career mastery and unlock your professional strengths',
    icon: Briefcase,
  },
  {
    value: 'relational',
    title: 'Relational',
    description: 'Master connections and deepen your relationship',
    icon: Heart,
  },
];

export const detailedRelationshipTypes = [
  {
    value: 'personal',
    title: 'Personal',
    description: 'Romantic chemistry and build deeper personal bonds',
    icon: Users,
  },
  {
    value: 'professional',
    title: 'Professional',
    description: 'Unlock powerful collaboration dynamics with a team',
    icon: Briefcase,
  },
];

// 🔥 Astro Data subcategories - raw ephemeris data
export const astroRequestCategories = [
  {
    value: 'essence',
    title: 'The Self',
    description: 'Discover your unique internal world',
    icon: User,
    request: 'essence',
  },
  {
    value: 'sync',
    title: 'Compatibility',
    description: 'Explore dynamics and shared potential',
    icon: Users,
    request: 'synastry',
  },
];

// 🧠 Canonical map: request → reportType
export const requestToReportTypeMap: Record<string, string> = {
  essence: 'essence',
  synastry: 'sync',
  // Add others here if needed later (e.g., positions → astro-positions)
};

// Optional reverse map if needed
export const reportTypeToRequestMap: Record<string, string> = {
  essence: 'essence',
  sync: 'synastry',
};

/**
 * Returns metadata about a report from either request or reportType
 */
export function getReportMeta(input: string) {
  const resolvedType = requestToReportTypeMap[input] ?? input;
  const isAstroOnly = Object.keys(requestToReportTypeMap).includes(input);

  return {
    reportType: resolvedType,
    isAstroOnly,
    hasAIContent: !isAstroOnly,
    label:
      reportTypes.find(r => r.value === resolvedType)?.label ??
      reportCategories.find(r => r.reportType === resolvedType)?.title ??
      'Unknown Report',
  };
}
