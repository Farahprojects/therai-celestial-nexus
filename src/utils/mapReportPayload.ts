
// Memoize removed to reduce bundle size
import { MappedReport, MappedReportSchema, RawReportPayload } from '@/types/mappedReport';
import { safeConsoleLog } from '@/utils/safe-logging';
function _mapReportPayload({
  guest_report,
  report_content,
  swiss_data,
  metadata
}: RawReportPayload): MappedReport {
  safeConsoleLog('mapReportPayload received payload:', {
    guest_report,
    has_report_data: !!guest_report?.report_data,
    report_data_keys: guest_report?.report_data ? Object.keys(guest_report.report_data) : [],
    report_data_name: guest_report?.report_data?.name
  });
  
  const reportData = guest_report?.report_data;
  if (!reportData?.name) {
    console.error('Missing person A name - detailed debug:', {
      reportData,
      guest_report,
      metadata
    });
    throw new Error(`Missing person A name in guest_report.report_data. Received: ${JSON.stringify(reportData)}`);
  }

  const personA = {
    name: reportData.name,
    birthDate: reportData.birthDate,
    birthTime: reportData.birthTime,
    location: reportData.birthLocation,
    latitude: reportData.birthLatitude,
    longitude: reportData.birthLongitude,
  };

  const personB = reportData.secondPersonName
    ? {
        name: reportData.secondPersonName,
        birthDate: reportData.secondPersonBirthDate,
        birthTime: reportData.secondPersonBirthTime,
        location: reportData.secondPersonBirthLocation,
        latitude: reportData.secondPersonLatitude,
        longitude: reportData.secondPersonLongitude,
      }
    : undefined;

  const isRelationship = !!personB;
  const reportType = guest_report?.report_type ?? metadata?.content_type ?? reportData?.reportType ?? '';

  const title = isRelationship 
    ? `${personA.name} × ${personB.name}`
    : `${personA.name} – ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`;

  const customerName = personA.name;

  // Strictly use AI report content only (text with markdown), no fallbacks
  const extractedReportContent = report_content ?? '';

  // Do not fallback — trust DB flags as single source of truth
  const isPureAstroReport = (reportType === 'essence' || reportType === 'sync') && !report_content;
  const hasReport = guest_report?.is_ai_report ?? guest_report?.swiss_boolean ?? !!swiss_data;
  const swissBoolean = guest_report?.swiss_boolean ?? metadata?.is_astro_report ?? !!swiss_data;

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
    pdfData: guest_report?.report_pdf_base64,
  };

  const validated = MappedReportSchema.parse(mappedReport);
  return Object.freeze(validated);
}

// Simple export without memoization to reduce bundle size
export const mapReportPayload = _mapReportPayload;

export const mapReportPayloadFresh = _mapReportPayload;
