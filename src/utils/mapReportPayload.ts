
// Memoize removed to reduce bundle size
import { MappedReport, MappedReportSchema, RawReportPayload } from '@/types/mappedReport';
import { safeConsoleLog } from '@/utils/safe-logging';

interface PersonData {
  name?: string;
  birthDate?: string;
  birthTime?: string;
  birthLocation?: string;
  birthLatitude?: number;
  birthLongitude?: number;
  secondPersonName?: string;
  secondPersonBirthDate?: string;
  secondPersonBirthTime?: string;
  secondPersonBirthLocation?: string;
  secondPersonLatitude?: number;
  secondPersonLongitude?: number;
}

interface Metadata {
  content_type?: string;
  report_type?: string;
  is_astro_report?: boolean;
  [key: string]: unknown;
}

function _mapReportPayload({
  report_content,
  swiss_data,
  metadata
}: RawReportPayload): MappedReport {
  safeConsoleLog('mapReportPayload received payload:', {
    has_report_content: !!report_content,
    has_swiss_data: !!swiss_data,
    metadata_keys: metadata ? Object.keys(metadata) : []
  });

  // Extract person data from swiss_data or metadata
  const personData = (swiss_data as PersonData) || {};
  const metadataTyped = metadata as Metadata;
  const personAName = personData.name || metadataTyped?.name || 'User';

  const personA = {
    name: personAName,
    birthDate: personData.birthDate,
    birthTime: personData.birthTime,
    location: personData.birthLocation,
    latitude: personData.birthLatitude,
    longitude: personData.birthLongitude,
  };

  // Check for relationship data
  const personB = personData.secondPersonName
    ? {
        name: personData.secondPersonName,
        birthDate: personData.secondPersonBirthDate,
        birthTime: personData.secondPersonBirthTime,
        location: personData.secondPersonBirthLocation,
        latitude: personData.secondPersonLatitude,
        longitude: personData.secondPersonLongitude,
      }
    : undefined;

  const isRelationship = !!personB;
  const reportType = metadataTyped?.content_type || metadataTyped?.report_type || 'astrological';

  const title = isRelationship
    ? `${personA.name} × ${personB?.name || 'Partner'}`
    : `${personA.name} – ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`;

  const customerName = personA.name;

  // Strictly use AI report content only (text with markdown), no fallbacks
  const extractedReportContent = report_content ?? '';

  // Do not fallback — trust DB flags as single source of truth
  const isPureAstroReport = (reportType === 'essence' || reportType === 'sync') && !report_content;
  const hasReport = !!(report_content || swiss_data);
  const swissBoolean = !!(metadataTyped?.is_astro_report) || !!swiss_data;

  const mappedReport: MappedReport = {
    title,
    isRelationship,
    people: {
      A: personA,
      ...(personB && { B: personB })
    },
    reportContent: extractedReportContent,
    swissData: swiss_data,
    reportType,
    hasReport,
    swissBoolean,
    metadata,
    customerName,
    isPureAstroReport,
  };

  const validated = MappedReportSchema.parse(mappedReport);
  return Object.freeze(validated);
}

// Simple export without memoization to reduce bundle size
export const mapReportPayload = _mapReportPayload;

export const mapReportPayloadFresh = _mapReportPayload;
