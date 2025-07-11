import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, ArrowLeft, X, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ReportContent } from './ReportContent';
import { PdfGenerator } from '@/services/pdf/PdfGenerator';
import { getToggleDisplayLogic } from '@/utils/reportTypeUtils';
import { MappedReport } from '@/types/mappedReport';
import openaiLogo from '@/assets/openai-logo.png';

interface ReportViewerProps {
  mappedReport: MappedReport;
  onBack: () => void;
  isMobile?: boolean;
}

export const ReportViewer = ({ mappedReport, onBack, isMobile = false }: ReportViewerProps) => {
  const { toast } = useToast();
  const [isCopyCompleted, setIsCopyCompleted] = useState(false);
  const [showChatGPTConfirm, setShowChatGPTConfirm] = useState(false);
  const [isCopping, setIsCopping] = useState(false);

  // Use intelligent content detection
  const reportAnalysisData = { 
    reportContent: mappedReport.reportContent, 
    swissData: mappedReport.swissData, 
    swissBoolean: mappedReport.swissBoolean, 
    hasReport: mappedReport.hasReport 
  };
  const toggleLogic = getToggleDisplayLogic(reportAnalysisData);
  const [activeView, setActiveView] = useState<'report' | 'astro'>(toggleLogic.defaultView);

  // Enforce content-based view restrictions
  useEffect(() => {
    if (!toggleLogic.showToggle) {
      setActiveView(toggleLogic.defaultView);
    }
  }, [toggleLogic.showToggle, toggleLogic.defaultView]);

  const handleDownloadPdf = () => {
    if (!mappedReport.pdfData) {
      return;
    }

    try {
      const byteCharacters = atob(mappedReport.pdfData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mappedReport.customerName.replace(/\s+/g, '_')}_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadUnifiedPdf = async () => {
    if (!mappedReport.reportContent && !mappedReport.swissData) {
      toast({
        title: "No data available",
        description: "Unable to generate PDF without report or astro data.",
        variant: "destructive"
      });
      return;
    }

    try {
      await PdfGenerator.generateUnifiedPdf({
        reportContent: mappedReport.reportContent,
        swissData: mappedReport.swissData,
        customerName: mappedReport.customerName,
        reportPdfData: mappedReport.pdfData,
        reportType: mappedReport.reportType
      });

      const sections = [];
      if (mappedReport.reportContent) sections.push("AI Report");
      if (mappedReport.swissData) sections.push("Astro Data");
      
      toast({
        title: "PDF Generated!",
        description: `Your ${sections.join(" + ")} PDF has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: "PDF generation failed",
        description: "Unable to generate PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mappedReport.reportContent;
      const cleanText = tempDiv.textContent || tempDiv.innerText || '';
      await navigator.clipboard.writeText(cleanText);
      
      setIsCopyCompleted(true);
      
      toast({
        title: "Copied to clipboard!",
        description: "Your report has been copied and is ready to paste anywhere.",
        variant: "success"
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard. Please try selecting and copying the text manually.",
        variant: "destructive"
      });
    }
  };

  const handleChatGPT = () => {
    if (isMobile) {
      setShowChatGPTConfirm(true);
    } else {
      handleChatGPTDesktop();
    }
  };

  const handleChatGPTDesktop = async () => {
    if (isCopyCompleted) {
      window.open('https://chatgpt.com/g/g-68636dbe19588191b04b0a60bcbf3df3-therai', '_blank');
    } else {
      try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = mappedReport.reportContent;
        const cleanText = tempDiv.textContent || tempDiv.innerText || '';
        
        await navigator.clipboard.writeText(cleanText);
        setIsCopyCompleted(true);
        
        toast({
          title: "Report copied to clipboard!",
          description: "Redirecting to ChatGPT..."
        });
        
        setTimeout(() => {
          window.open('https://chatgpt.com/g/g-68636dbe19588191b04b0a60bcbf3df3-therai', '_blank');
        }, 2000);
        
      } catch (error) {
        toast({
          title: "Copy failed",
          description: "Unable to copy to clipboard. Please try copying manually first.",
          variant: "destructive"
        });
      }
    }
  };

  const handleChatGPTCopyAndGo = async () => {
    setIsCopping(true);
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mappedReport.reportContent;
      const cleanText = tempDiv.textContent || tempDiv.innerText || '';
      await navigator.clipboard.writeText(cleanText);
      toast({
        title: "Copied!",
        description: "Report copied to clipboard",
      });
      setTimeout(() => {
        const chatGPTUrl = `https://chat.openai.com/?model=gpt-4&prompt=${encodeURIComponent(`Please analyze this astrological report and provide additional insights or answer any questions I might have:\n\n${cleanText}`)}`;
        window.open(chatGPTUrl, '_blank');
        setShowChatGPTConfirm(false);
        setIsCopping(false);
      }, 2000);
    } catch (error) {
      setIsCopping(false);
      toast({
        title: "Copy failed",
        description: "Unable to copy. Please try manually.",
        variant: "destructive"
      });
    }
  };

  // Mobile layout
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Fixed Header */}
        <div className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-center relative px-6 py-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="absolute left-6 p-2 hover:bg-gray-50">
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </Button>
            <div className="absolute right-6 flex gap-2">
              <Button variant="ghost" size="icon" onClick={handleCopyToClipboard} className="p-2 hover:bg-gray-50">
                <Copy className="h-5 w-5 text-gray-700" />
              </Button>
              {mappedReport.pdfData && (
                <Button variant="ghost" size="icon" onClick={handleDownloadPdf} className="p-2 hover:bg-gray-50">
                  <Download className="h-5 w-5 text-gray-700" />
                </Button>
              )}
            </div>
          </div>

          {toggleLogic.showToggle && (
            <div className="px-6 pb-4">
              <div className="inline-flex bg-gray-100 rounded-full p-1 w-fit mx-auto">
                <button
                  onClick={() => setActiveView('report')}
                  className={`px-4 py-2 rounded-md text-sm font-light transition-all ${
                    activeView === 'report'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Report
                </button>
                <button
                  onClick={() => setActiveView('astro')}
                  className={`px-4 py-2 rounded-md text-sm font-light transition-all ${
                    activeView === 'astro'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Astro
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-6">
            <h1 className="text-xl font-light text-gray-900 tracking-tight mb-3">
              {toggleLogic.title} — Generated for {mappedReport.customerName}
            </h1>
            <ReportContent 
              mappedReport={mappedReport}
              activeView={activeView}
              setActiveView={setActiveView}
              isMobile={true}
            />
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="bg-white border-t border-gray-100 px-6 py-5 shadow-lg flex-shrink-0">
          <div className="flex gap-8 justify-center">
            <button onClick={handleCopyToClipboard} className="flex items-center text-gray-700 font-light text-lg hover:text-gray-900 transition-colors duration-300">
              <Paperclip className="h-5 w-5 mr-2" />
              Copy
            </button>
            <button onClick={handleChatGPT} className="flex items-center text-gray-700 font-light text-lg hover:text-gray-900 transition-colors duration-300">
              <img src={openaiLogo} alt="ChatGPT" className="h-5 w-5 mr-2" />
              GPT
            </button>
          </div>
        </div>

        {/* ChatGPT Confirmation Dialog */}
        <Dialog open={showChatGPTConfirm} onOpenChange={setShowChatGPTConfirm}>
          <DialogContent className="mx-6 rounded-xl">
            <DialogHeader className="text-center space-y-4">
              <DialogTitle className="text-2xl font-light text-gray-900 tracking-tight">
                Analyze with <em className="italic font-light">ChatGPT</em>
              </DialogTitle>
              <DialogDescription className="text-lg text-gray-500 font-light leading-relaxed">
                Ready to get AI insights on your report? We'll copy your report to clipboard and open ChatGPT for analysis.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowChatGPTConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 px-8 py-4 rounded-xl text-lg font-light hover:bg-gray-200 transition-all duration-300"
                disabled={isCopping}
              >
                Cancel
              </button>
              <button
                onClick={handleChatGPTCopyAndGo}
                className="flex-1 bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-light hover:bg-gray-800 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none disabled:shadow-lg"
                disabled={isCopping}
              >
                {isCopping ? "Copied!" : "Copy & Go"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Desktop layout
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      style={{ pointerEvents: 'auto' }}
      className="min-h-screen bg-background"
    >
      {/* Desktop Header */}
      <div className="sticky top-0 z-[100] bg-background border-b shadow-sm" style={{ position: 'relative' }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                onMouseDown={onBack}
                tabIndex={0}
                style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10 }}
                className="flex items-center gap-2 cursor-pointer pointer-events-auto !cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Form</span>
              </Button>
              {toggleLogic.showToggle && (
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setActiveView('report')}
                    className={`px-4 py-2 rounded-md text-sm font-light transition-all ${
                      activeView === 'report'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Report
                  </button>
                  <button
                    onClick={() => setActiveView('astro')}
                    className={`px-4 py-2 rounded-md text-sm font-light transition-all ${
                      activeView === 'astro'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Astro
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyToClipboard}
                onMouseDown={handleCopyToClipboard}
                tabIndex={0}
                style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10 }}
                className="flex items-center gap-2 pointer-events-auto !cursor-pointer"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              {(mappedReport.pdfData || mappedReport.swissData || (mappedReport.reportContent && mappedReport.reportContent.trim().length > 20)) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (mappedReport.pdfData && mappedReport.swissData) {
                      handleDownloadUnifiedPdf(); // Combined version
                    } else if (mappedReport.pdfData) {
                      handleDownloadPdf();
                    } else if (mappedReport.swissData) {
                      handleDownloadUnifiedPdf();
                    } else if (mappedReport.reportContent && mappedReport.reportContent.trim().length > 20) {
                      handleDownloadUnifiedPdf(); // Use unified PDF for AI content
                    }
                  }}
                  tabIndex={0}
                  style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10 }}
                  className="flex items-center gap-2 pointer-events-auto !cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleChatGPT}
                onMouseDown={handleChatGPT}
                tabIndex={0}
                style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10 }}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm hover:shadow-md font-inter transition-all duration-200 pointer-events-auto !cursor-pointer"
              >
                <img 
                  src="/lovable-uploads/a27cf867-e7a3-4d2f-af1e-16aaa70117e4.png" 
                  alt="ChatGPT" 
                  className="h-4 w-4"
                  onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23000'%3E%3Cpath d='M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0734a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'/%3E%3C/svg%3E";
                  }}
                />
                <span className="font-medium">ChatGPT</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                onMouseDown={onBack}
                tabIndex={0}
                style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10 }}
                className="p-2 pointer-events-auto !cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ReportContent 
        mappedReport={mappedReport}
        activeView={activeView} 
        setActiveView={setActiveView}
      />
    </motion.div>
  );
};