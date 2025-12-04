import React, { useState, useEffect, useRef } from 'react';
import { X, User, Users, Briefcase, Heart, Users2, ArrowLeft } from 'lucide-react';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { ReportFormData } from '@/types/report-form';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError, safeConsoleLog } from '@/utils/safe-logging';
interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId?: string;
  profileData?: {
    id: string;
    profile_name: string;
    name: string;
    birth_date: string;
    birth_time: string;
    birth_location: string;
    birth_latitude: number | null;
    birth_longitude: number | null;
    birth_place_id: string | null;
    timezone: string | null;
    house_system: string | null;
    is_primary: boolean;
  } | null;
  onReportReady?: (insightId: string) => void;
  onReportCreated?: (conversation: { id: string; title: string; mode?: string | null; reportType?: string }) => void;
}
interface ReportCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}
const ReportCard: React.FC<ReportCardProps> = ({
  title,
  description,
  icon,
  onClick
}) => {
  return <button onClick={onClick} className="w-full p-4 text-left bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 group">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-gray-900 mb-0.5">{title}</h3>
          <p className="text-xs text-gray-500 leading-snug">{description}</p>
        </div>
      </div>
    </button>;
};
export const InsightsModal: React.FC<InsightsModalProps> = ({
  isOpen,
  onClose,
  folderId,
  profileData,
  onReportReady,
  // onReportCreated is kept in props for backwards compatibility but no longer used
  // since insights no longer create conversations
}) => {
  const [showAstroForm, setShowAstroForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<string>('');
  const [pollingInsightId, setPollingInsightId] = useState<string | null>(null);
  const {
    user
  } = useAuth();
  const pollingIntervalRef = useRef<number | null>(null);

  // Reset form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowAstroForm(false);
      setShowSuccess(false);
      setSelectedReportType('');
      setSelectedRequest('');
      setPollingInsightId(null);
      // Stop polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen]);

  // Poll for insight completion when insight ID is set
  useEffect(() => {
    if (!pollingInsightId || !user?.id) return;

    const pollForCompletion = async () => {
      try {
        const { data, error } = await supabase
          .from('insights')
          .select('id, is_ready')
          .eq('id', pollingInsightId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          safeConsoleError('[InsightsModal] Polling error:', error);
          return;
        }

        if (data?.is_ready === true) {
          safeConsoleLog('[InsightsModal] Report ready:', { id: data.id });
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Close success screen and modal
          setShowSuccess(false);
          setPollingInsightId(null);
          onClose();
          onReportReady?.(data.id);
        }
      } catch (error) {
        safeConsoleError('[InsightsModal] Polling error:', error);
      }
    };

    // Start polling every 1.5 seconds (reports take ~8 seconds)
    pollingIntervalRef.current = window.setInterval(pollForCompletion, 1500);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pollingInsightId, user?.id, onClose, onReportReady]);
  if (!isOpen) return null;
  const handleReportClick = async (reportType: string, request: string, isDualPerson: boolean) => {
    setSelectedReportType(reportType);
    setSelectedRequest(request);

    // If single-person report AND profile exists, skip form and trigger report directly
    if (!isDualPerson && profileData && user) {
      safeConsoleLog('[InsightsModal] Using folder profile, creating insight report directly (no chat page)', {
        folderId,
        profileId: profileData.id,
      });

      try {
        // Build report payload using the same logic as AstroDataForm
        const reportData = {
          request: request,
          reportType: reportType,
          person_a: {
            birth_date: profileData.birth_date,
            birth_time: profileData.birth_time,
            location: profileData.birth_location,
            latitude: profileData.birth_latitude,
            longitude: profileData.birth_longitude,
            name: profileData.name,
          }
        };

        // Generate a UUID for the insight (no conversation created)
        const insightId = crypto.randomUUID();

        // Call initiate-auth-report directly (skip conversation creation)
        const { error } = await supabase.functions.invoke('initiate-auth-report', {
          body: {
            chat_id: insightId, // Used as insight ID
            report_data: reportData,
            email: user.email || '',
            name: profileData.name,
            mode: 'insight'
          }
        });

        if (error) {
          throw new Error(error.message || 'Failed to initiate insight report');
        }

        console.log('[InsightsModal] Insight report initiated (no chat page):', insightId);

        // Update the insights table with folder_id
        if (folderId) {
          await supabase
            .from('insights')
            .update({ folder_id: folderId })
            .eq('id', insightId);
        }

        // Show success screen and start polling (no onReportCreated - skip adding to conversations)
        setShowAstroForm(false);
        setShowSuccess(true);
        setPollingInsightId(insightId); // Start polling for this insight

      } catch (error) {
        safeConsoleError('[InsightsModal] Failed to create insight report:', error);
        // Fall back to showing the form
        setShowAstroForm(true);
      }
      return;
    }

    // Otherwise show the form (dual-person or no profile)
    setShowAstroForm(true);
  };
  
  const handleFormSubmit = (data: ReportFormData & { chat_id?: string }) => {
    // Note: We no longer call onReportCreated since insights don't create conversations
    // The insight will be visible in the insights list once ready

    // Show success screen and start polling
    setShowAstroForm(false);
    setShowSuccess(true);
    if (data.chat_id) {
      setPollingInsightId(data.chat_id); // Start polling for this insight
    }
  };
  const handleFormClose = () => {
    setShowAstroForm(false);
  };
  return <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {showAstroForm && <button onClick={() => setShowAstroForm(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>}
            <div>
              <h2 className="text-2xl font-light text-gray-900">Insights - Generate and discover patterns</h2>
              <p className="text-sm text-gray-500 mt-1">
            </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {showSuccess ? <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-light text-gray-900 mb-2">Report Submitted</h3>
              <p className="text-sm text-gray-600 text-center max-w-sm">
                Your insight report is being generated. It will appear in your chat history soon.
              </p>
            </div> : showAstroForm ? <AstroDataForm onClose={handleFormClose} onSubmit={handleFormSubmit} preselectedType={selectedRequest} reportType={selectedReportType} isProfileFlow={false} variant="insights" mode="insight" /> : <>
              <div className="space-y-3">
                {/* Solo Reports */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">SINGLE INSIGHT</h3>
                  <div className="space-y-2">
                    <ReportCard title="Personal" description="Deep dive into your personality, strengths, and life patterns based on your birth chart." icon={<User className="w-6 h-6" />} onClick={() => handleReportClick('essence_personal', 'essence', false)} />

                    <ReportCard title="Professional" description="Career guidance and professional development insights tailored to your astrological profile." icon={<Briefcase className="w-6 h-6" />} onClick={() => handleReportClick('essence_professional', 'essence', false)} />

                    <ReportCard title="Relationship" description="Understanding your relationship patterns, love language, and romantic compatibility." icon={<Heart className="w-6 h-6" />} onClick={() => handleReportClick('essence_relationship', 'essence', false)} />
                  </div>
                </div>

                {/* Dual Reports */}
                <div className="pt-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">COMPATIBILITY INSIGHT</h3>
                  <div className="space-y-2">
                    <ReportCard title="Compatibility" description="Analyze romantic compatibility, communication styles, and relationship dynamics between two people." icon={<Users className="w-6 h-6" />} onClick={() => handleReportClick('sync_personal', 'sync', true)} />

                    <ReportCard title="Co-working" description="Team dynamics, collaboration styles, and professional synergy between colleagues or partners." icon={<Users2 className="w-6 h-6" />} onClick={() => handleReportClick('sync_professional', 'sync', true)} />
                  </div>
                </div>
              </div>
            </>}
        </div>
      </div>
    </div>;
};