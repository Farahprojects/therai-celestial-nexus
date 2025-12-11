
import { ReportData } from './reportContentExtraction';

import { isSynastryData, parseAstroData } from '@/lib/astroFormatter';
import { safeConsoleError } from '@/utils/safe-logging';
const isSynastryReport = (reportData: ReportData): boolean => {
  if (!reportData.swiss_data) return false;

  // Use report_type from metadata for routing
  const reportTypeRaw = reportData.metadata?.report_type || '';
  const reportType = String(reportTypeRaw).toLowerCase();

  // Route based on explicit type first
  if (reportType.includes('sync') || reportType.includes('synastry')) {
    return true;
  }
  if (reportType.startsWith('essence') || reportType.includes('personal') || reportType === 'essence') {
    return false;
  }
  if (reportType === 'monthly' || reportType.startsWith('month')) {
    return false;
  }

  // Fallback to structural detection
  return isSynastryData(reportData.swiss_data);
};

export const renderAstroDataAsText = (reportData: ReportData): string => {
  if (!reportData.swiss_data) {
    return 'No astronomical data available.';
  }

  try {
    const isSynastry = isSynastryReport(reportData);
    
    if (isSynastry) {
      return renderSynastryAsText(reportData);
    } else {
      return renderIndividualAsText(reportData);
    }
  } catch (error) {
    safeConsoleError('Error rendering astro data as text:', error);
    return 'Error: Unable to process astronomical data.';
  }
};

const renderIndividualAsText = (reportData: ReportData): string => {
  if (!reportData.swiss_data) return 'No astro data available';
  const parsed = parseAstroData(reportData.swiss_data);
  const natal = parsed.natal;

  let text = '';

  const name = 'Individual';
  text += `${name}'s Astro Data\n`;
  text += '='.repeat(name.length + 12) + '\n\n';

  // Birth info removed as guest reports are no longer supported
  text += '\n';
  if (natal?.angles && natal.angles.length > 0) {
    text += 'CHART ANGLES\n------------\n';
    natal.angles.forEach((angle: unknown) => {
      const angleObj = angle as { deg?: number; name?: string; sign?: string };
      const degInt = Math.floor(angleObj.deg || 0);
      text += `${angleObj.name || 'Unknown'}: ${String(degInt)}' in ${angleObj.sign || 'Unknown'}\n`;
    });
    text += '\n';
  }

  if (natal?.planets && natal.planets.length > 0) {
    text += 'NATAL PLANETARY POSITIONS\n-------------------------\n';
    natal.planets.forEach((planet: unknown) => {
      const planetObj = planet as { deg?: number; sign?: string; name?: string; house?: number; retrograde?: boolean };
      const degInt = Math.floor(planetObj.deg || 0);
      const sign = String(planetObj.sign || '').padEnd(10);
      let line = `${(planetObj.name || '').padEnd(10)}: ${String(degInt).padStart(2, '0')}° ${sign}`;
      if (planetObj.house) line += ` (H${planetObj.house})`;
      if (planetObj.retrograde) line += ' R';
      text += line + '\n';
    });
    text += '\n';
  }

  if (natal?.aspects && natal.aspects.length > 0) {
    text += 'NATAL ASPECTS\n-------------\n';
    natal.aspects.forEach((aspect: unknown) => {
      const aspectObj = aspect as { orb?: number; a?: string; type?: string; b?: string };
      const orb = typeof aspectObj.orb === 'number' ? aspectObj.orb.toFixed(2) : 'N/A';
      text += `${aspectObj.a || ''} ${aspectObj.type || ''} ${aspectObj.b || ''} (Orb: ${orb}°)\n`;
    });
    text += '\n';
  }

  return text;
};

const renderSynastryAsText = (reportData: ReportData): string => {
  if (!reportData.swiss_data) return 'No astro data available';
  const data = parseAstroData(reportData.swiss_data);
  const { natal_set, synastry_aspects } = data;

  if (!natal_set) {
    return 'Synastry data is incomplete.';
  }

  const personA = natal_set.personA;
  const personB = natal_set.personB;

  if (!personA || !personB) {
    return 'Synastry data is missing person information.';
  }

  let text = 'Synastry Chart Analysis\n';
  text += '======================\n\n';

  text += `Compatibility Analysis between ${personA.name} and ${personB.name}\n\n`;

  const renderPerson = (person: unknown) => {
    const personObj = person as { name?: string; planets?: unknown[] };
    let personText = `${(personObj.name || 'Unknown').toUpperCase()}'S NATAL DATA\n`;
    personText += '-'.repeat((personObj.name || 'Unknown').length + 12) + '\n\n';
    if (personObj.planets && personObj.planets.length > 0) {
      personObj.planets.forEach((planet: unknown) => {
        const planetObj = planet as { name?: string; deg?: number; sign?: string; house?: number; retrograde?: boolean };
        let line = `${(planetObj.name || '').padEnd(10)}: ${String(Math.floor(planetObj.deg || 0)).padStart(2, '0')}° ${(planetObj.sign || '').padEnd(10)}`;
        if (planetObj.house) line += ` (H${planetObj.house})`;
        if (planetObj.retrograde) line += ' R';
        personText += line + '\n';
      });
      personText += '\n';
    }
    return personText;
  };

  text += renderPerson(personA);
  if (personB) {
    text += renderPerson(personB);
  }

  if (synastry_aspects?.aspects && synastry_aspects.aspects.length > 0) {
    text += 'SYNASTRY ASPECTS\n';
    text += '----------------\n';
    synastry_aspects.aspects.forEach((aspect: unknown) => {
      const aspectObj = aspect as { a?: string; type?: string; b?: string; orb?: number };
      text += `${aspectObj.a || ''} ${aspectObj.type || ''} ${aspectObj.b || ''} (Orb: ${aspectObj.orb?.toFixed(2)}°)\n`;
    });
    text += '\n';
  }

  return text;
};

export const renderUnifiedContentAsText = (reportData: ReportData): string => {
  const reportContent = reportData.report_content || '';
  const astroContent = renderAstroDataAsText(reportData);

  if (reportContent && astroContent && astroContent !== 'No astronomical data available.') {
    return `${reportContent}\n\n--- ASTROLOGICAL DATA ---\n\n${astroContent}`;
  }

  return reportContent || astroContent;
};
