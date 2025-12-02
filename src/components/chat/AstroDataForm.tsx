import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportFormData } from '@/types/public-report';
import { ReportType } from '@/utils/reportHelpers';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { getSwissChartDisplayName } from '@/constants/swissEndpoints';
import { getAstroTitle, getInsightTitle } from '@/utils/reportTitles';
import { astroRequestCategories } from '@/constants/report-types';

// Custom hooks
import { useAstroConversation } from '@/hooks/useAstroConversation';
import { useAstroFormValidation } from '@/hooks/useAstroFormValidation';
import { useAstroReportPayload } from '@/hooks/useAstroReportPayload';
import { useProfileSaver } from '@/hooks/useProfileSaver';

// Step components
import { AstroTypeStep } from './AstroForm/AstroTypeStep';
import { AstroDetailsStep } from './AstroForm/AstroDetailsStep';
import { AstroSecondPersonStep } from './AstroForm/AstroSecondPersonStep';

interface AstroDataFormProps {
  onClose: () => void;
  onSubmit: (data: ReportFormData & { chat_id?: string }) => void;
  onBack?: () => void;
  preselectedType?: ReportType;
  reportType?: ReportType;
  isProfileFlow?: boolean;
  variant?: 'standalone' | 'insights';
  mode?: 'chat' | 'astro' | 'insight' | 'swiss' | 'together' | 'sync_score';
  defaultName?: string;
  prefillPersonA?: {
    name: string;
    birthDate: string;
    birthTime: string;
    birthLocation: string;
    birthLatitude?: number;
    birthLongitude?: number;
    birthPlaceId?: string;
    timezone?: string;
  };
}

const DEFAULT_FORM_VALUES: ReportFormData = {
  name: '',
  email: '',
  birthDate: '',
  birthTime: '',
  birthLocation: '',
  birthLatitude: undefined,
  birthLongitude: undefined,
  birthPlaceId: '',
  secondPersonName: '',
  secondPersonBirthDate: '',
  secondPersonBirthTime: '',
  secondPersonBirthLocation: '',
  secondPersonLatitude: undefined,
  secondPersonLongitude: undefined,
  secondPersonPlaceId: '',
  request: '',
  reportType: null,
};

const resolveAstroRequest = (type?: string | null): string => {
  if (!type) return '';
  const matchedCategory = astroRequestCategories.find(category => category.value === type);
  return matchedCategory?.request ?? type;
};

export const AstroDataForm: React.FC<AstroDataFormProps> = ({
  onClose,
  onSubmit,
  onBack,
  preselectedType,
  reportType,
  isProfileFlow = false,
  variant = 'standalone',
  mode: explicitMode,
  defaultName,
  prefillPersonA,
}) => {
  // State
  const isInsights = variant === 'insights';
  // If prefillPersonA is provided and type is sync, skip to secondPerson step
  const initialStep = prefillPersonA && preselectedType === 'sync' 
    ? 'secondPerson' 
    : isInsights ? 'details' : preselectedType ? 'details' : 'details';
  const [currentStep, setCurrentStep] = useState<'type' | 'details' | 'secondPerson'>(initialStep);
  const [selectedAstroType, setSelectedAstroType] = useState<string>(preselectedType || '');
  const [activeSelector, setActiveSelector] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [saveSecondPersonToProfile, setSaveSecondPersonToProfile] = useState(false);

  // Hooks
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { mode: contextMode } = useMode();
  const { createConversation: createAstroConversation } = useAstroConversation();
  const { validatePrimaryPerson, validateSecondPerson } = useAstroFormValidation();
  const { buildReportPayload } = useAstroReportPayload();
  const { saveProfile } = useProfileSaver();

  const mode = explicitMode || contextMode;
  const shouldDisableAnimations = isProfileFlow;

  // Form setup
  const initialRequest = resolveAstroRequest(preselectedType);
  const form = useForm<ReportFormData>({
    defaultValues: { ...DEFAULT_FORM_VALUES, request: initialRequest, reportType },
  });

  const { register, setValue, setError, watch, formState: { errors } } = form;
  const formValues = watch();

  // Pre-fill name if provided (for onboarding flow)
  useEffect(() => {
    if (defaultName && !formValues.name) {
      setValue('name', defaultName);
    }
  }, [defaultName, setValue, formValues.name]);

  // Pre-fill person A data from folder profile if provided
  useEffect(() => {
    if (prefillPersonA) {
      setValue('name', prefillPersonA.name);
      setValue('birthDate', prefillPersonA.birthDate);
      setValue('birthTime', prefillPersonA.birthTime);
      setValue('birthLocation', prefillPersonA.birthLocation);
      if (prefillPersonA.birthLatitude !== undefined) {
        setValue('birthLatitude', prefillPersonA.birthLatitude);
      }
      if (prefillPersonA.birthLongitude !== undefined) {
        setValue('birthLongitude', prefillPersonA.birthLongitude);
      }
      if (prefillPersonA.birthPlaceId) {
        setValue('birthPlaceId', prefillPersonA.birthPlaceId);
      }
    }
  }, [prefillPersonA, setValue]);

  useEffect(() => {
    if (preselectedType) {
      setSelectedAstroType(preselectedType);
      setValue('request', resolveAstroRequest(preselectedType));
    }
  }, [preselectedType, setValue]);

  // Handlers
  const handleAstroTypeSelect = (type: string) => {
    setSelectedAstroType(type);
    setValue('request', resolveAstroRequest(type));
    setValue('reportType', null);
    setCurrentStep('details');
  };

  const handleDetailsFormSubmit = async () => {
    if (!validatePrimaryPerson(formValues, setError)) return;

    // Save profile if checkbox is checked (for regular flow)
    if (saveToProfile && user && !isProfileFlow) {
      await saveProfile({
        name: formValues.name,
        birthDate: formValues.birthDate,
        birthTime: formValues.birthTime,
        birthLocation: formValues.birthLocation,
        birthLatitude: formValues.birthLatitude,
        birthLongitude: formValues.birthLongitude,
        birthPlaceId: formValues.birthPlaceId,
      });
    }

    if (selectedAstroType === 'sync') {
      setCurrentStep('secondPerson');
    } else {
      handleFormSubmission(formValues);
    }
  };

  const handleSecondPersonFormSubmit = async () => {
    if (!validateSecondPerson(formValues, setError)) return;

    // Save second person's profile if checkbox is checked
    if (saveSecondPersonToProfile && user) {
      await saveProfile({
        name: formValues.secondPersonName,
        birthDate: formValues.secondPersonBirthDate,
        birthTime: formValues.secondPersonBirthTime,
        birthLocation: formValues.secondPersonBirthLocation,
        birthLatitude: formValues.secondPersonLatitude,
        birthLongitude: formValues.secondPersonLongitude,
        birthPlaceId: formValues.secondPersonPlaceId,
      });
    }

    handleFormSubmission(formValues);
  };

  const handleFormSubmission = async (data: ReportFormData) => {
    if (!user) return;
    
    // Profile mode: save profile and link to folder
    if (isProfileFlow) {
      setIsProcessing(true);
      try {
        // Profile flow - always save profile and link to folder
        const result = await saveProfile({
          name: data.name,
          birthDate: data.birthDate,
          birthTime: data.birthTime,
          birthLocation: data.birthLocation,
          birthLatitude: data.birthLatitude,
          birthLongitude: data.birthLongitude,
          birthPlaceId: data.birthPlaceId,
          profileName: data.name,
        });
        
        if (!result.success) {
          setIsProcessing(false);
          return;
        }
        
        // Attach profile_id to form data before calling onSubmit
        await onSubmit({ ...data, request: 'essence', profile_id: result.profileId! });
        console.log('[AstroDataForm] Profile created successfully in profile flow');
        
        // FolderProfileSetup will handle:
        // - Linking profile to folder via updateFolderProfile
        // - Calling onProfileLinked callback
        
      } catch (error) {
        console.error('[AstroDataForm] Profile submission error:', error);
        toast.error('Failed to submit profile data. Please try again.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    
    // Regular mode: create conversation
    if (!mode || (mode !== 'astro' && mode !== 'insight' && mode !== 'swiss' && mode !== 'sync_score')) {
      toast.error('Please select a mode from the dropdown menu before submitting.');
      return;
    }

    setIsProcessing(true);

    try {
      // Always create new conversation for astro, insight, swiss, and sync_score modes
      const payload = buildReportPayload(data, selectedAstroType);
      // Determine the conversation mode and title using explicitMode to include 'swiss' and 'sync_score'
      let conversationMode: 'astro' | 'insight' | 'swiss' | 'sync_score' = 'astro';
      let title = data.name;
      
      if (explicitMode === 'insight' || mode === 'insight') {
        conversationMode = 'insight';
        // Use insight type name (Personal, Professional, Compatibility, etc.)
        title = getInsightTitle(reportType || '');
      } else if (explicitMode === 'swiss') {
        conversationMode = 'swiss';
        const chartTypeName = getSwissChartDisplayName(selectedAstroType || '');
        title = `${data.name} - ${chartTypeName}`;
      } else if (explicitMode === 'sync_score') {
        conversationMode = 'sync_score';
        title = `Sync Score: ${data.name} & ${data.secondPersonName}`;
      } else {
        // Regular astro mode - use chart type display name (e.g., "Weekly Snap", "Daily Shot")
        title = getAstroTitle(data.name, selectedAstroType, data.secondPersonName);
      }
      
      // For Swiss mode and sync_score mode, explicitly set reportType to null to skip orchestrator
      const payloadToSend = (explicitMode === 'swiss' || explicitMode === 'sync_score')
        ? { 
            ...payload, 
            report_data: { 
              ...payload.report_data, 
              reportType: null 
            }
          }
        : { reportType, ...payload };
      
      const currentChatId = await createAstroConversation(conversationMode, 
        title,
        payloadToSend
      );

      onSubmit({ ...data, chat_id: currentChatId });

      if (!isProfileFlow && variant !== 'insights') {
        onClose();
      }
    } catch (error) {
      console.error('[AstroDataForm] Submission error:', error);
      toast.error('Failed to submit astro data. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = async () => {
    try {
      // Restore scroll state on mobile
      if (isMobile) {
        const html = document.documentElement;
        const scrollY = html.getAttribute('data-scroll-y');
        html.classList.remove('lock-scroll');
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY, 10));
          html.removeAttribute('data-scroll-y');
        }
        document.body.classList.remove('astro-form-open');
      }
    } catch {
      // Intentionally ignore errors during form close
    }
    
    onClose();
  };

  const goBackToType = () => {
    // Use onBack prop if provided, otherwise close the form
    if (onBack) {
      onBack();
    } else {
      handleClose();
    }
  };

  const goBackToDetails = () => {
    setCurrentStep('details');
  };

  return (
    <>
      <motion.div
        initial={shouldDisableAnimations ? undefined : { opacity: 0, y: 20 }}
        animate={shouldDisableAnimations ? undefined : { opacity: 1, y: 0 }}
        exit={shouldDisableAnimations ? undefined : { opacity: 0, y: -20 }}
        transition={shouldDisableAnimations ? { duration: 0 } : undefined}
        className={`bg-white overflow-hidden ${
          isMobile
            ? 'fixed inset-0 z-50 rounded-none flex flex-col'
            : 'rounded-3xl'
        }`}
      >
        {/* Header with close button - only show on mobile or when not in a Dialog wrapper */}
        {isMobile && (
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-light text-gray-900">
              {explicitMode === 'sync_score'
                ? currentStep === 'details'
                  ? 'Calculate Sync Score'
                  : 'Partner Details'
                : currentStep === 'type'
                ? 'Choose Your Path'
                : currentStep === 'details'
                  ? 'Your Details'
                  : 'Partner Details'}
            </h2>
            <Button
              type="button"
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
            >
              <X className="h-5 w-5 text-gray-600" />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className={`${isMobile ? 'flex-1 overflow-y-auto p-4 pb-safe' : 'p-6'}`}>
          <AnimatePresence mode="wait">
            {currentStep === 'type' && !isInsights ? (
              <AstroTypeStep
                key="type"
                selectedType={selectedAstroType}
                onSelectType={handleAstroTypeSelect}
                shouldDisableAnimations={shouldDisableAnimations}
              />
            ) : currentStep === 'details' ? (
              <AstroDetailsStep
                key="details"
                register={register}
                errors={errors}
                setValue={setValue}
                watch={watch}
                isMobile={isMobile}
                activeSelector={activeSelector}
                setActiveSelector={setActiveSelector}
                onBack={goBackToType}
                onNext={handleDetailsFormSubmit}
                isProcessing={isProcessing}
                isInsights={isInsights}
                shouldDisableAnimations={shouldDisableAnimations}
                saveToProfile={saveToProfile}
                setSaveToProfile={setSaveToProfile}
                isProfileFlow={isProfileFlow}
              />
            ) : currentStep === 'secondPerson' ? (
              <AstroSecondPersonStep
                key="secondPerson"
                register={register}
                errors={errors}
                setValue={setValue}
                watch={watch}
                isMobile={isMobile}
                activeSelector={activeSelector}
                setActiveSelector={setActiveSelector}
                onBack={goBackToDetails}
                onSubmit={handleSecondPersonFormSubmit}
                isProcessing={isProcessing}
                shouldDisableAnimations={shouldDisableAnimations}
                saveSecondPersonToProfile={saveSecondPersonToProfile}
                setSaveSecondPersonToProfile={setSaveSecondPersonToProfile}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};
