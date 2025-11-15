import React, { useState, useEffect, useRef } from 'react';
import { X, User, Users, Briefcase, Heart, UserCheck, Users2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { ReportFormData } from '@/types/public-report';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId?: string;
  folderProfileId?: string | null;
}
interface ReportCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  isDualPerson: boolean;
  onClick: () => void;
}
const ReportCard: React.FC<ReportCardProps> = ({
  title,
  description,
  icon,
  isDualPerson,
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
  folderProfileId
}) => {
  const [showAstroForm, setShowAstroForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<string>('');
  const [isDualPerson, setIsDualPerson] = useState(false);
  const {
    user
  } = useAuth();
  const channelRef = useRef<any>(null);

  // Reset form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowAstroForm(false);
      setShowSuccess(false);
      setSelectedReportType('');
      setSelectedRequest('');
    }
  }, [isOpen]);

  // Cleanup WebSocket on unmount or close
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);
  if (!isOpen) return null;
  const handleReportClick = (reportType: string, request: string, isDual: boolean) => {
    setSelectedReportType(reportType);
    setSelectedRequest(request);
    setIsDualPerson(isDual);
    
    // If in folder context and single-person insight
    if (folderId && !isDual) {
      if (folderProfileId) {
        // Has profile - generate immediately
        handleDirectGeneration(reportType, request);
      } else {
        // No profile - show message
        alert('Please set up a folder profile first to generate insights.');
        onClose();
      }
    } else {
      // Show form (for compatibility or if no folder context)
      setShowAstroForm(true);
    }
  };
  
  const handleDirectGeneration = async (reportType: string, request: string) => {
    // Generate insight directly using folder's profile
    // This will be implemented to call the generate-insights edge function
    console.log('[InsightsModal] Generating insight with folder profile:', {
      folderId,
      folderProfileId,
      reportType,
      request
    });
    
    // Show success immediately
    setShowSuccess(true);
    
    // TODO: Call edge function to generate insight
    // For now, just show success and close after delay
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 2000);
  };
  const handleFormSubmit = (data: ReportFormData) => {
    // Show success screen
    setShowAstroForm(false);
    setShowSuccess(true);

    // Mount WebSocket listener for report completion
    if (user?.id) {
      const channel = supabase.channel('insight-completion').on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'insights',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        const insight = payload.new;
        if (insight.is_ready === true) {
          console.log('[InsightsModal] Report ready:', insight.id);
          // Close success screen and modal
          setShowSuccess(false);
          onClose();
          // Cleanup
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        }
      }).subscribe();
      channelRef.current = channel;
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
              <h2 className="text-2xl font-light text-gray-900">Insights - Generate and discover pattens </h2>
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
                  <h3 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">SINGLE INSIGHT </h3>
                  <div className="space-y-2">
                    <ReportCard title="Personal" description="Deep dive into your personality, strengths, and life patterns based on your birth chart." icon={<User className="w-6 h-6" />} isDualPerson={false} onClick={() => handleReportClick('essence_personal', 'essence', false)} />
                    
                    <ReportCard title="Professional" description="Career guidance and professional development insights tailored to your astrological profile." icon={<Briefcase className="w-6 h-6" />} isDualPerson={false} onClick={() => handleReportClick('essence_professional', 'essence', false)} />
                    
                    <ReportCard title="Relationship" description="Understanding your relationship patterns, love language, and romantic compatibility." icon={<Heart className="w-6 h-6" />} isDualPerson={false} onClick={() => handleReportClick('essence_relationship', 'essence', false)} />
                  </div>
                </div>

                {/* Dual Reports */}
                <div className="pt-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">COMPATIBILITY INSIGHT </h3>
                  <div className="space-y-2">
                    <ReportCard title="Compatibility" description="Analyze romantic compatibility, communication styles, and relationship dynamics between two people." icon={<Users className="w-6 h-6" />} isDualPerson={true} onClick={() => handleReportClick('sync_personal', 'sync', true)} />
                    
                    <ReportCard title="Co-working" description="Team dynamics, collaboration styles, and professional synergy between colleagues or partners." icon={<Users2 className="w-6 h-6" />} isDualPerson={true} onClick={() => handleReportClick('sync_professional', 'sync', true)} />
                  </div>
                </div>
              </div>
            </>}
        </div>
      </div>
    </div>;
};