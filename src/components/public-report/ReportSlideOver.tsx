import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Paperclip, Check, ChevronDown, ChevronRight } from 'lucide-react';
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
import { useSystemPrompts, SystemPrompt } from '@/hooks/useSystemPrompts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [showPromptSelector, setShowPromptSelector] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<{ name: string; text: string } | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();
  const { prompts } = useSystemPrompts();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPrompt(null);
      setExpandedCategory(null);
      setCopied(false);
      setShowPromptSelector(false);
    }
  }, [isOpen]);

  // Reset prompt-related state when report ID changes
  useEffect(() => {
    setSelectedPrompt(null);
    setExpandedCategory(null);
    setShowPromptSelector(false);
  }, [reportId]);

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

  // Auto-expand the single category (e.g., compatibility for sync charts)
  // Must be here at top level before any early returns
  useEffect(() => {
    if (!reportData) return;
    
    const chartType = (reportData?.metadata as any)?.request_type || null;
    if (!chartType) return;
    
    const getVisibleCategories = (): string[] => {
      if (chartType === 'essence') {
        return ['mindset', 'health', 'wealth', 'soul', 'career', 'compatibility'];
      }
      if (chartType === 'sync') {
        return ['compatibility'];
      }
      if (chartType === 'weekly' || chartType === 'focus') {
        return [];
      }
      return [];
    };
    
    const categories = getVisibleCategories().filter(cat => prompts[cat] && prompts[cat].length > 0);
    
    if (categories.length === 1 && !expandedCategory) {
      setExpandedCategory(categories[0]);
    }
  }, [reportData, prompts, expandedCategory]);

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

  const handleOpenPromptSelector = () => {
    setShowPromptSelector(true);
  };

  const handleCategoryClick = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const handleSubcategoryClick = (subcategory: string, promptText: string) => {
    setSelectedPrompt({ name: subcategory, text: promptText });
    setExpandedCategory(null);
  };

  const handleCopyAstroData = async () => {
    try {
      if (!reportData?.swiss_data) {
        toast.error('No astro data available to copy');
        return;
      }

      const dataString = JSON.stringify(reportData.swiss_data, null, 2);
      const finalText = selectedPrompt 
        ? `${dataString}\n\n---\n\nSystem Prompt:\n${selectedPrompt.text}`
        : dataString;

      await navigator.clipboard.writeText(finalText);
      setCopied(true);
      toast.success(selectedPrompt 
        ? 'Astro data with system prompt copied!' 
        : 'Astro data copied to clipboard!'
      );
      
      setTimeout(() => {
        setCopied(false);
        setShowPromptSelector(false);
      }, 2000);
    } catch (err) {
      console.error('[ReportSlideOver] Failed to copy:', err);
      toast.error('Failed to copy data');
    }
  };

  // Get chart type directly from metadata.request_type (deterministic, no guessing)
  const chartType = (reportData?.metadata as any)?.request_type || null;

  // Filter categories based on chart type - deterministic and fail-fast
  const getVisibleCategories = (): string[] => {
    if (!chartType) {
      // Fail fast - no chart type means no prompts
      return [];
    }
    
    if (chartType === 'essence') {
      // Essence shows all standard categories + compatibility
      return ['mindset', 'health', 'wealth', 'soul', 'career', 'compatibility'];
    }
    
    if (chartType === 'sync') {
      // Sync shows compatibility only
      return ['compatibility'];
    }
    
    // weekly/focus auto-inject, no manual selection needed
    if (chartType === 'weekly' || chartType === 'focus') {
      return [];
    }
    
    // Unknown chart type - fail fast, show no prompts
    return [];
  };

  const categories = getVisibleCategories().filter(cat => prompts[cat] && prompts[cat].length > 0);

  return (
    <>
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
            <div className="flex items-center gap-3 flex-1">
              <SheetTitle className="text-lg font-medium text-gray-900">Astro data</SheetTitle>
              {/* Copy Astro Data Button - Only show when Swiss data is available */}
              {reportData?.swiss_data && (activeView === 'astro' || !hasReport) && (
                <button
                  onClick={handleOpenPromptSelector}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="Copy astro data with prompt"
                >
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>
              )}
            </div>
            {/* Close button is handled by Sheet component on the right */}
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

    {/* System Prompt Selector Dialog - Using shadcn Dialog component */}
    <Dialog open={showPromptSelector} onOpenChange={setShowPromptSelector}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-light">Add System Prompt</DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            Select a system prompt to include with your astro data
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          
          <div className="space-y-2">
            {categories.map((category) => {
              const categoryPrompts = prompts[category];
              const displayName = category === 'chart_type' 
                ? `${chartType?.charAt(0).toUpperCase()}${chartType?.slice(1)} Prompts`
                : category.charAt(0).toUpperCase() + category.slice(1);
              
              return (
                <div key={category}>
                  <button
                    onClick={() => handleCategoryClick(category)}
                    className="w-full text-left py-3 text-gray-700 font-light text-base hover:text-gray-900 transition-colors flex items-center justify-between"
                  >
                    <span>{displayName}</span>
                    {expandedCategory === category ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {expandedCategory === category && categoryPrompts && (
                    <div className="space-y-1 mb-2">
                      {categoryPrompts
                        .filter((prompt: SystemPrompt) => {
                          // For chart_type category, only show prompts matching current chart type
                          if (category === 'chart_type') {
                            return prompt.subcategory.toLowerCase() === chartType?.toLowerCase();
                          }
                          return true;
                        })
                        .map((prompt: SystemPrompt) => {
                          const isSelected = selectedPrompt?.name === prompt.subcategory;
                          return (
                            <button
                              key={prompt.id}
                              onClick={() => handleSubcategoryClick(prompt.subcategory, prompt.prompt_text)}
                              className={`w-full text-left pl-4 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                                isSelected 
                                  ? 'bg-green-50 text-green-800 border border-green-200' 
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span>{prompt.subcategory}</span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 text-center font-light pt-4">
            The system prompt will be appended to your astro data when copied
          </p>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={() => setShowPromptSelector(false)}
            variant="outline"
            className="flex-1 h-12 rounded-full border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 font-light"
          >
            Cancel
          </Button>

          <Button
            onClick={handleCopyAstroData}
            className="flex-1 h-12 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5 mr-2" />
                {selectedPrompt ? 'Copy with Prompt' : 'Copy Data'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
