import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { ReportContent } from './ReportContent';
import { supabase } from '@/integrations/supabase/client';
import { ReportData, extractReportContent, getPersonName } from '@/utils/reportContentExtraction';
import { renderUnifiedContentAsText } from '@/utils/componentToTextRenderer';
import { AstroDataRenderer } from './AstroDataRenderer';

interface ReportSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad?: (error?: string | null) => void;
  shouldFetch?: boolean;
  reportId?: string;
}



export const ReportSlideOver: React.FC<ReportSlideOverProps> = ({ 
  isOpen, 
  onClose, 
  onLoad, 
  shouldFetch = false,
  reportId 
}) => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'report' | 'astro'>('report');
  const isMobile = useIsMobile();

  // Determine what views to show based on metadata
  const hasReport = reportData?.metadata?.has_ai_report || false;
  const hasSwissData = reportData?.metadata?.has_swiss_data || false;
  const showToggle = hasReport && hasSwissData;
  const defaultView = hasReport ? 'report' : 'astro';

  // Set initial active view based on metadata when report data loads
  useEffect(() => {
    if (reportData && !showToggle) {
      setActiveView(defaultView);
    }
  }, [reportData, showToggle, defaultView]);

  // Direct edge function call - simplified approach
  const fetchReport = async (reportId: string) => {
    setIsLoading(true);
    setError(null);
    setReportData(null);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'get-report-data',
        { body: { chat_id: reportId } }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      setReportData(data.data as ReportData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch when explicitly told to via shouldFetch prop
  useEffect(() => {
    if (shouldFetch && reportId && reportId !== 'new') {
      fetchReport(reportId);
    } else if (shouldFetch && !reportId) {
      console.warn('[ReportSlideOver] No report ID provided');
    }
  }, [shouldFetch, reportId]);

  useEffect(() => {
    if (!isLoading) {
      onLoad?.(error);
    }
  }, [isLoading, error, onLoad]);

  if (isLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader className="px-6 py-4 border-b bg-white">
            <SheetTitle className="text-lg font-medium text-gray-900">Loading Report</SheetTitle>
            <SheetDescription className="text-sm text-gray-600">Please wait while we prepare your report</SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your report...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (error) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader className="px-6 py-4 border-b bg-white">
            <SheetTitle className="text-lg font-medium text-gray-900">Error</SheetTitle>
            <SheetDescription className="text-sm text-gray-600">There was a problem loading your report</SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">Error loading report: {error}</p>
              <Button onClick={() => reportId && fetchReport(reportId)}>
                Try Again
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Show astro data form for new users
  if (reportId === 'new') {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-2xl p-0"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="flex flex-col h-full">
            <SheetHeader className="flex flex-row items-center justify-between px-6 py-4 border-b bg-white">
              <SheetTitle className="text-lg font-medium text-gray-900">Add Astro Data</SheetTitle>
              <SheetDescription className="text-sm text-gray-600">Enter your birth details to get started</SheetDescription>
            </SheetHeader>
            <div className="flex-1 p-6">
              {/* Import and use the existing AstroDataForm component */}
              <div className="text-center py-8 text-gray-500">
                <p>Astro data form will be integrated here</p>
                <p className="text-sm mt-2">This will allow fresh users to add their birth details</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!reportData) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-2xl"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <SheetHeader className="px-6 py-4 border-b bg-white">
            <SheetTitle className="text-lg font-medium text-gray-900">Report</SheetTitle>
            <SheetDescription className="text-sm text-gray-600">Report information</SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-gray-600">No report data available.</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const personName = getPersonName(reportData);

  const handleCopyAstroData = async () => {
    try {
      // Only copy if Swiss data is available and we're viewing astro data
      if (!reportData?.swiss_data) {
        toast.error('No astro data available to copy');
        return;
      }

      const dataString = JSON.stringify(reportData.swiss_data, null, 2);
      await navigator.clipboard.writeText(dataString);
      toast.success('Astro data copied to clipboard!');
    } catch (err) {
      console.error('[ReportSlideOver] Failed to copy:', err);
      toast.error('Failed to copy data');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl p-0"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="flex flex-row items-center justify-between px-6 py-4 border-b bg-white">
            <SheetTitle className="text-lg font-medium text-gray-900">Astro data</SheetTitle>
            <div className="flex items-center gap-2">
              {/* Copy Astro Data Button - Only show when Swiss data is available */}
              {reportData?.swiss_data && (activeView === 'astro' || !hasReport) && (
                <button
                  onClick={handleCopyAstroData}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="Copy astro data"
                >
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>
              )}
              {/* Close button is handled by Sheet component */}
            </div>
          </SheetHeader>

          {/* View Toggle - Only show when both report and Swiss data are available */}
          {showToggle && (
            <div className="flex border-b bg-gray-50">
              <button
                onClick={() => setActiveView('report')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeView === 'report'
                    ? 'bg-white text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Report
              </button>
              <button
                onClick={() => setActiveView('astro')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeView === 'astro'
                    ? 'bg-white text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Astro Data
              </button>
            </div>
          )}

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {showToggle ? (
                // Show toggle-based content when both report and Swiss data are available
                activeView === 'report' ? (
                  <ReportContent
                    reportData={reportData}
                    activeView={activeView}
                    setActiveView={setActiveView}
                    isMobile={isMobile}
                  />
                ) : (
                  <div className="space-y-6">
                    <AstroDataRenderer swissData={reportData.swiss_data} reportData={reportData} />
                  </div>
                )
              ) : (
                // Show appropriate content based on what's available
                <ReportContent
                  reportData={reportData}
                  activeView={defaultView}
                  setActiveView={setActiveView}
                  isMobile={isMobile}
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};
