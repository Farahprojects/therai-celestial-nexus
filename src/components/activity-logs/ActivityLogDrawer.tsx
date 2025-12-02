import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
// PDF functionality removed to reduce bundle size
import { ReportRenderer } from '@/components/shared/ReportRenderer';
import { ReportData } from '@/utils/reportContentExtraction';

// Strict types for report data structures
interface StructuredReport {
  title: string;
  content: string | unknown;
  generated_at?: string | number | Date;
}

interface LegacyReportData {
  report_content: string;
  swiss_data: null;
  metadata: {
    content_type: string;
    has_ai_report: boolean;
    has_swiss_data: boolean;
    is_ready: boolean;
    report_type: string;
  };
}

type ReportData = string | StructuredReport | Record<string, unknown>;

type ActivityLogItem = {
  id: string;
  created_at: string;
  response_status: number;
  endpoint?: string;
  request_type?: string;
  report_tier: string | null;
  total_cost_usd: number;
  processing_time_ms: number | null;
  response_payload?: Record<string, unknown>;
  request_payload?: Record<string, unknown>;
  error_message?: string;
  google_geo?: boolean;
};

interface ActivityLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logData: ActivityLogItem | null;
}

// Type guards for report data validation
const isStringReport = (report: ReportData): report is string => {
  return typeof report === 'string';
};

const isStructuredReport = (report: ReportData): report is StructuredReport => {
  return (
    report !== null &&
    typeof report === 'object' &&
    !Array.isArray(report) &&
    'title' in report &&
    'content' in report &&
    typeof (report as StructuredReport).title === 'string'
  );
};

// Helper function to convert legacy string content to ReportData format
const createLegacyReportData = (content: string): LegacyReportData => {
  return {
    report_content: content,
    swiss_data: null,
    metadata: {
      content_type: 'ai',
      has_ai_report: true,
      has_swiss_data: false,
      is_ready: true,
      report_type: 'legacy'
    }
  };
};

const ActivityLogDrawer = ({ isOpen, onClose, logData }: ActivityLogDrawerProps) => {
  const [viewMode, setViewMode] = useState<'report' | 'payload'>('report');

  // Handle download as CSV
  const handleDownloadCSV = () => {
    if (!logData) return;
    
    // Create CSV content
    const headers = "Timestamp,Status,Endpoint/Type,Report Type,Cost,Processing Time\n";
    const row = [
      new Date(logData.created_at).toLocaleString(),
      logData.response_status,
      logData.endpoint || logData.request_type || 'N/A',
      logData.report_tier || 'None',
      logData.total_cost_usd.toFixed(2),
      logData.processing_time_ms ? `${(logData.processing_time_ms / 1000).toFixed(2)}s` : 'N/A'
    ].join(',');
    
    const content = headers + row;
    
    // Create and trigger download
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api-log-${logData.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // PDF download functionality removed to reduce bundle size

  // Helper function to safely extract report data
  const getReportData = (): ReportData | null => {
    if (!logData?.response_payload?.report) {
      return null;
    }
    return logData.response_payload.report as ReportData;
  };

  // Determine which view to show by default
  useEffect(() => {
    if (logData) {
      const hasReport = getReportData() !== null;
      setViewMode(hasReport ? "report" : "payload");
    }
  }, [logData]);

  // Helper function to safely render a report using ReportRenderer
  const renderReport = (report: ReportData) => {
    // Handle string reports (legacy format)
    if (isStringReport(report)) {
      const reportData = createLegacyReportData(report);
      return <ReportRenderer reportData={reportData} className="text-gray-700" />;
    }

    // Handle structured reports with title/content
    if (isStructuredReport(report)) {
      const { title, content, generated_at } = report;

      return (
        <div>
          <h4 className="font-medium mb-2">{title}</h4>
          {typeof content === 'string' ? (
            <ReportRenderer reportData={createLegacyReportData(content)} className="text-gray-700" />
          ) : (
            <div className="whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</div>
          )}
          {generated_at && (
            <p className="text-sm text-muted-foreground mt-2">
              Generated at: {new Date(generated_at).toLocaleString()}
            </p>
          )}
        </div>
      );
    }

    // Handle other object types - stringify them
    if (report && typeof report === 'object' && !Array.isArray(report)) {
      return <pre className="whitespace-pre-wrap font-mono text-xs md:text-sm overflow-x-auto bg-gray-100 p-2 rounded">{JSON.stringify(report, null, 2)}</pre>;
    }

    return 'No report content available';
  };

  // Helper function to get filtered response payload (without report field)
  const getFilteredResponsePayload = (responsePayload: Record<string, unknown>) => {
    if (!responsePayload || typeof responsePayload !== 'object') {
      return responsePayload;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { report: reportIgnored, ...filteredPayload } = responsePayload;
    return filteredPayload;
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[95vh] md:h-[90vh] w-full md:max-w-[60vw] md:mx-auto">
        <DrawerHeader className="flex flex-row items-center justify-between border-b p-4">
          <div className="flex items-center gap-2 md:gap-4">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as 'report' | 'payload')}
                className="flex-wrap"
              >
                <ToggleGroupItem
                  value="report"
                  disabled={getReportData() === null}
                  className="text-xs md:text-sm"
                >
                  Report
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="payload"
                  disabled={!logData?.response_payload && !logData?.request_payload}
                  className="text-xs md:text-sm"
                >
                  Payload
                </ToggleGroupItem>
              </ToggleGroup>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-xs md:text-sm font-normal p-0 h-auto hover:bg-transparent">
                  <Download className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white">
                <DropdownMenuItem onClick={handleDownloadCSV}>
                  CSV Format
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        
        <div className="p-3 md:p-4 flex-1 overflow-hidden">
          {logData && (
            <div className="h-full flex flex-col">
              {logData.error_message && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-medium text-red-600">Error</p>
                  <p className="text-red-600">{logData.error_message}</p>
                </div>
              )}
              
              <div className="flex-1 min-h-0">
                {viewMode === 'report' && (
                  <ScrollArea className="h-full">
                    <div className="p-3 md:p-4 bg-gray-50 rounded-md">
                      {(() => {
                        const reportData = getReportData();
                        return reportData ? (
                          renderReport(reportData)
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            No report available
                          </div>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                )}
                
                {viewMode === 'payload' && (
                  <ScrollArea className="h-full">
                    <div className="p-3 md:p-4 bg-gray-50 rounded-md">
                      {(logData.response_payload || logData.request_payload) ? (
                        <div>
                          {logData.request_payload && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium mb-2">Request Payload</h4>
                              <pre className="whitespace-pre-wrap font-mono text-xs md:text-sm overflow-x-auto bg-gray-100 p-2 rounded">
                                {JSON.stringify(logData.request_payload, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {logData.response_payload && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Response Payload</h4>
                              <pre className="whitespace-pre-wrap font-mono text-xs md:text-sm overflow-x-auto bg-gray-100 p-2 rounded">
                                {JSON.stringify(getFilteredResponsePayload(logData.response_payload), null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No payload available
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ActivityLogDrawer;
