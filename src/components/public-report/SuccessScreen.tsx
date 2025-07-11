import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { CheckCircle, Clock, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGuestReportStatus } from '@/hooks/useGuestReportStatus';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';

import { useNavigate } from 'react-router-dom';
import { getGuestToken, clearAllSessionData } from '@/utils/urlHelpers';
import { supabase } from '@/integrations/supabase/client';
import EntertainmentWindow from './EntertainmentWindow';

type ReportType = 'essence' | 'sync';
const VIDEO_SRC = 'https://auth.theraiastro.com/storage/v1/object/public/therai-assets/loading-video.mp4';

const isAstroOnlyType = (type?: ReportType): boolean => type === 'essence' || type === 'sync';

const VideoLoader: React.FC<{ onVideoReady?: () => void }> = ({ onVideoReady }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !isMuted;
    if (!vid.muted) vid.volume = 1;
    setIsMuted(!isMuted);
  };
  const handleVideoReady = () => onVideoReady?.();
  return (
    <div className="relative w-full h-0 pt-[56.25%] overflow-hidden rounded-xl shadow-lg">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        controls={false}
        onCanPlay={handleVideoReady}
        onLoadedData={handleVideoReady}
      />
      <button
        onClick={toggleMute}
        className="absolute bottom-3 right-3 bg-black/50 text-white rounded-full p-2 backdrop-blur-sm hover:bg-black/70 transition"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
    </div>
  );
};

interface SuccessScreenProps {
  name: string;
  email: string;
  onViewReport?: (
    content: string,
    pdf?: string | null,
    swissData?: any,
    hasReport?: boolean,
    swissBoolean?: boolean,
    reportType?: string
  ) => void;
  guestReportId?: string;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ name, email, onViewReport, guestReportId }) => {
  const {
    report,
    error,
    caseNumber,
    fetchReport,
    triggerErrorHandling,
    fetchCompleteReport,
    setupRealtimeListener,
    setError,
    setCaseNumber,
  } = useGuestReportStatus();

  const firstName = name?.split(' ')[0] || 'there';
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  useViewportHeight();

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [modalTriggered, setModalTriggered] = useState(false);
  const [fetchedReportData, setFetchedReportData] = useState<any>(null);
  const [errorHandlingTriggered, setErrorHandlingTriggered] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isAiReport, setIsAiReport] = useState<boolean | null>(null);
  const [entertainmentMode, setEntertainmentMode] = useState<'text' | 'video' | 'image'>('text');
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownTime, setCountdownTime] = useState(24);

  const currentGuestReportId = useMemo(() => {
    return guestReportId || getGuestToken();
  }, [guestReportId]);

  if (!currentGuestReportId) {
    return (
      <div className="w-full py-10 px-4 flex justify-center">
        <Card className="border-2 border-gray-200 shadow-lg">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">Session expired. Please start a new report.</p>
            <Button onClick={() => navigate('/report')} className="mt-4 bg-gray-900 text-white font-light hover:bg-gray-800">
              Start New Report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reportType = report?.report_type as ReportType | undefined;
  const isAstroDataOnly = isAstroOnlyType(reportType);
  const hasSwissError = report?.has_swiss_error === true;
  const hasProcessingError = !!error;

  const handleVideoReady = useCallback(() => {
    setIsVideoReady(true);
  }, []);

  const handleViewReport = useCallback(async () => {
    console.log('🚀 View Report button clicked!', { currentGuestReportId, onViewReport });
    
    if (isLoadingReport) {
      console.log('⏳ Already loading, ignoring click');
      return;
    }

    setIsLoadingReport(true);
    setReportError(null);
    
    // Track modal view state for auto-reopen on refresh
    localStorage.setItem('autoOpenModal', 'true');
    
    try {
      console.log('📡 Fetching fresh report data...');
      
      // Add timeout to prevent indefinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      
      const data = await Promise.race([
        fetchCompleteReport(currentGuestReportId),
        timeoutPromise
      ]);
      
      console.log('📋 Fetched data:', data);
      
      if (!data) {
        console.log('❌ No data returned from edge function');
        throw new Error('No data returned from server');
      }

      const { report_content, swiss_data, guest_report, metadata } = data;
      const reportType = guest_report.report_type;
      const hasSwiss = !!swiss_data;
      const hasAi = !!report_content;
      const contentType = metadata?.content_type;

      console.log('📊 Data summary:', {
        hasSwiss,
        hasAi,
        reportType,
        contentType,
        hasReportContent: !!report_content,
        hasSwissData: !!swiss_data
      });

      setFetchedReportData(data);

      const isAstro = contentType === 'astro' || contentType === 'both';
      const isAi = contentType === 'ai' || contentType === 'both';

      console.log('🎯 Opening modal with data:', {
        content: report_content ? 'Present' : 'Missing',
        swiss_data: swiss_data ? 'Present' : 'Missing',
        isAi,
        isAstro,
        reportType
      });

      // Only open modal after successful data fetch
      if (onViewReport) {
        onViewReport(
          report_content || 'No content available', 
          null, 
          swiss_data, 
          hasAi, 
          isAstro, 
          reportType
        );
      } else {
        console.warn('⚠️ onViewReport callback is missing');
        throw new Error('Modal callback not available');
      }
    } catch (error) {
      console.error('❌ Error in handleViewReport:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setReportError(errorMessage);
      
      // Don't open modal on error, just show error state
      if (errorMessage.includes('timeout')) {
        setReportError('Request timed out. Please try again.');
      } else if (errorMessage.includes('No data')) {
        setReportError('Report data not ready yet. Please wait a moment and try again.');
      } else {
        setReportError('Failed to load report. Please try again.');
      }
    } finally {
      setIsLoadingReport(false);
    }
  }, [currentGuestReportId, onViewReport, fetchCompleteReport, isLoadingReport]);

  // Fetch is_ai_report flag to determine if we need countdown
  useEffect(() => {
    const checkReportType = async () => {
      if (!currentGuestReportId) return;
      
      try {
        const { data, error } = await supabase
          .from('guest_reports')
          .select('is_ai_report')
          .eq('id', currentGuestReportId)
          .single();
          
        if (!error && data) {
          setIsAiReport(data.is_ai_report);
        }
      } catch (err) {
        console.error('Error fetching report type:', err);
        // Default to showing countdown for safety
        setIsAiReport(true);
      }
    };
    
    checkReportType();
  }, [currentGuestReportId]);

  // Visual 24-second countdown for AI reports
  useEffect(() => {
    if (!currentGuestReportId || isAiReport !== true) {
      return;
    }

    const countdownKey = `countdown_shown_${currentGuestReportId}`;
    const hasShownCountdown = localStorage.getItem(countdownKey) === 'true';

    if (!hasShownCountdown) {
      setShowCountdown(true);
      localStorage.setItem(countdownKey, 'true');

      const timer = setInterval(() => {
        setCountdownTime((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setShowCountdown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentGuestReportId, isAiReport]);

  useEffect(() => {
    const scrollToProcessing = () => {
      const element = document.querySelector('[data-success-screen]');
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    scrollToProcessing();

    if (currentGuestReportId) {
      fetchReport(currentGuestReportId);
    }
  }, [currentGuestReportId, fetchReport]);

  // Auto-reopen modal after refresh if user was previously viewing it
  useEffect(() => {
    const shouldAutoOpen = localStorage.getItem('autoOpenModal') === 'true';
    const reportReady = report?.payment_status === 'paid' && !hasSwissError;

    if (shouldAutoOpen && reportReady && !modalTriggered) {
      console.log('🔁 Auto-opening report modal after refresh');
      handleViewReport();
      setModalTriggered(true);
      localStorage.removeItem('autoOpenModal');
    }
  }, [report, hasSwissError, modalTriggered, handleViewReport]);

  // 🔥 Check report_logs for reliable error detection
  useEffect(() => {
    const checkReportError = async () => {
      if (!currentGuestReportId || errorHandlingTriggered || caseNumber) return;
      
      try {
        const { data: reportLog, error } = await supabase
          .from('report_logs')
          .select('has_error, error_message')
          .eq('user_id', currentGuestReportId)
          .maybeSingle();
          
        if (!error && reportLog?.has_error) {
          console.warn('🚨 Error detected in report_logs:', reportLog.error_message);
          setErrorHandlingTriggered(true);
          triggerErrorHandling(currentGuestReportId);
        }
      } catch (err) {
        console.error('Error checking report_logs:', err);
      }
    };

    if (report?.payment_status === 'paid') {
      checkReportError();
    }
  }, [report, currentGuestReportId, errorHandlingTriggered, caseNumber, triggerErrorHandling]);

  const status = (() => {
    if (hasSwissError) return { title: 'We\'re sorry', desc: 'Technical issue encountered', icon: CheckCircle };
    if (!report) return { title: 'Processing Your Request', desc: 'Setting up your report', icon: Clock };
    if (report.payment_status === 'pending') return { title: 'Payment Processing', desc: 'Confirming payment', icon: Clock };
    return { title: 'Report Ready!', desc: 'Your report is ready', icon: CheckCircle };
  })();

  const StatusIcon = status.icon;

  const handleBackToForm = () => {
    clearAllSessionData();
    navigate('/report');
  };

  const handleContactSupport = () => {
    const errorMessage = `Hi, I'm experiencing an issue with my report generation.\n\nReport Details:\n- Name: ${name}\n- Email: ${email}\n- Report ID: ${currentGuestReportId || 'N/A'}\n- Case Number: ${caseNumber || 'N/A'}\n- Time: ${new Date().toLocaleString()}\n`;
    localStorage.setItem('contactFormPrefill', JSON.stringify({ name, email, subject: 'Report Issue', message: errorMessage }));
    navigate('/contact');
  };

  return (
    <div data-success-screen className={isMobile ? 'min-h-[calc(var(--vh,1vh)*100)] flex items-start justify-center pt-8 px-4 bg-gradient-to-b from-background to-muted/20 overflow-y-auto' : 'w-full py-10 px-4 flex justify-center'}>
      <div className={isMobile ? 'w-full max-w-md' : 'w-full max-w-4xl'}>
        <Card className="border-2 border-gray-200 shadow-lg">
          <CardContent className="p-8 text-center space-y-6">
            {(hasSwissError || hasProcessingError) ? (
              <>
                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <StatusIcon className="h-6 w-6 text-gray-600" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-light text-gray-900 mb-1 tracking-tight">{status.title}</h2>
                  <p className="text-gray-600 font-light">{status.desc}</p>
                </div>
                <div className="text-center space-y-3">
                  <p className="text-gray-800 font-medium">
                    We are having technical issues, your case has been logged as: {caseNumber || 'Processing...'}
                  </p>
                  <p className="text-gray-600">We will send you an email within 24 hours.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="outline" onClick={handleContactSupport} className="border-gray-900 text-gray-900 font-light hover:bg-gray-100">
                    Contact Support
                  </Button>
                  <Button variant="outline" onClick={handleBackToForm} className="border-gray-900 text-gray-900 font-light hover:bg-gray-100">
                    Back to Home
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Countdown timer at the top for AI reports */}
                {isAiReport && showCountdown && (
                  <div className="text-center mb-6">
                    <div className="text-3xl font-light text-gray-900 mb-2">{countdownTime}s</div>
                    <p className="text-sm text-gray-600">AI report generating...</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                      <motion.div
                        className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full"
                        initial={{ width: "100%" }}
                        animate={{ width: `${(countdownTime / 24) * 100}%` }}
                        transition={{ duration: 1, ease: "linear" }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Only show "Report Ready!" and description when actually ready */}
                {(report?.payment_status === 'paid' && !showCountdown) ? (
                  <div>
                    <h2 className="text-2xl font-light text-gray-900 mb-1 tracking-tight">Report Ready!</h2>
                    <p className="text-gray-600 font-light">Your report is ready</p>
                  </div>
                ) : null}
                   <div className="bg-muted/50 rounded-lg p-4 text-sm">
                    Hi {firstName}! Your report.<br />
                    <span className="font-medium">{email}</span>
                  </div>
                  
                  {/* Show entertainment window for AI reports only during countdown */}
                  {isAiReport && showCountdown && (
                    <EntertainmentWindow 
                      mode={entertainmentMode}
                      className="mb-4"
                    />
                  )}
                  
                   {showCountdown ? (
                     <div className="flex flex-col items-center gap-4">
                       <Button disabled className="bg-gray-400 text-white font-light cursor-not-allowed">
                         View Report ({countdownTime}s)
                       </Button>
                     </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Error display */}
                      {reportError && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <p className="text-sm">{reportError}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button 
                          onClick={handleViewReport} 
                          disabled={isLoadingReport}
                          className="bg-gray-900 hover:bg-gray-800 text-white font-light disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoadingReport ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading Report...
                            </>
                          ) : (
                            'View Report'
                          )}
                        </Button>
                        <Button variant="outline" onClick={handleBackToForm} className="border-gray-900 text-gray-900 font-light hover:bg-gray-100">
                          Home
                        </Button>
                      </div>
                      
                      {/* Retry button for errors */}
                      {reportError && (
                        <div className="text-center">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setReportError(null);
                              handleViewReport();
                            }}
                            disabled={isLoadingReport}
                            className="border-gray-400 text-gray-600 font-light hover:bg-gray-50"
                          >
                            Try Again
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuccessScreen;
