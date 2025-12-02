// Minimal report reference - no full payload data
export interface ReportReference {
  guestReportId: string;
  reportType: string;
  engine: string;
  timestamp: number;
  metadata?: {
    content_type: string;
    report_type: string;
  };
}

// Cache entry with TTL
export interface CachedReport {
  data: Record<string, unknown> | string | null;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// Report cache management
export interface ReportCache {
  [guestReportId: string]: CachedReport;
} 