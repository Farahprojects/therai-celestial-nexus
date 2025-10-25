import React, { useEffect, Suspense, lazy, useState } from 'react';
import { useChatStore } from '@/core/store';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MotionConfig } from 'framer-motion';
import { useConversationUIStore } from '@/features/chat/conversation-ui-store';
import { SwissNewChartButton } from './SwissNewChartButton';
import { SwissChartSelector } from './SwissChartSelector';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { useMessageStore } from '@/stores/messageStore';
import { SwissDataModal } from '@/components/swiss/SwissDataModal';
import { useSwissDataPolling } from '@/hooks/useSwissDataPolling';
import { useReportModal } from '@/contexts/ReportModalContext';

// Lazy load components for better performance
const ConversationOverlay = lazy(() => import('@/features/chat/ConversationOverlay/ConversationOverlay').then(module => ({ default: module.ConversationOverlay })));
const ChatSidebarControls = lazy(() => import('@/features/chat/ChatSidebarControls').then(module => ({ default: module.ChatSidebarControls })));
const ChatMenuButton = lazy(() => import('@/components/chat/ChatMenuButton').then(module => ({ default: module.ChatMenuButton })));

interface SwissBoxProps {
  className?: string;
  onDelete?: () => void;
}

export const SwissBox: React.FC<SwissBoxProps> = ({ onDelete }) => {
  const { error, chat_id } = useChatStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isConversationOpen = useConversationUIStore((s) => s.isConversationOpen);
  const [selectedChartType, setSelectedChartType] = useState<string | null>(null);
  const [showAstroForm, setShowAstroForm] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [activeChatIdForPolling, setActiveChatIdForPolling] = useState<string | null>(null);
  const { open: openReportModal } = useReportModal();

  // Poll for Swiss data when we have a chat_id
  const { isLoading, swissData, error: pollingError } = useSwissDataPolling(
    activeChatIdForPolling,
    !!activeChatIdForPolling
  );

  const handleSelectChart = (chartId: string) => {
    setSelectedChartType(chartId);
    setShowAstroForm(true);
  };

  const handleFormClose = () => {
    setShowAstroForm(false);
    setSelectedChartType(null);
  };

  const handleFormSubmit = async (data: any) => {
    if (!user) return;

    try {
      const newChatId = data.chat_id;
      
      if (!newChatId) {
        return;
      }
      
      // Set chat_id and start conversation
      const { setChatId } = useMessageStore.getState();
      setChatId(newChatId);
      
      const { startConversation } = useChatStore.getState();
      startConversation(newChatId);
      
      // Swiss mode doesn't need WebSocket - we'll poll for data instead
      // Start polling for the Swiss data
      setActiveChatIdForPolling(newChatId);
      setShowDataModal(true);
      
      // Close form
      setShowAstroForm(false);
      setSelectedChartType(null);
    } catch (error) {
      // Handle error silently or show user-friendly message
    }
  };

  const handleCloseDataModal = () => {
    setShowDataModal(false);
    setActiveChatIdForPolling(null);
  };

  const handleViewAstroData = () => {
    // Close the Swiss data modal
    setShowDataModal(false);
    // Open the report modal with the current chat_id
    if (activeChatIdForPolling) {
      openReportModal(activeChatIdForPolling);
    }
    setActiveChatIdForPolling(null);
  };

  return (
    <>
      <MotionConfig
        transition={{
          type: "spring",
          bounce: 0.2,
          duration: 0.6
        }}
      >
        <div className="flex flex-row flex-1 bg-white w-full min-h-0 mobile-chat-container" style={{ scrollBehavior: 'smooth', overscrollBehavior: 'contain' as any }}>
          {/* Left Sidebar (Desktop) - extends to left edge */}
          <div className="hidden md:flex w-64 border-r border-gray-100 flex-col bg-gray-50/50 h-full">
            <div className="py-4 flex flex-col h-full">
              <Suspense fallback={<div className="space-y-4"><div className="h-8 bg-gray-200 rounded animate-pulse"></div><div className="h-6 bg-gray-200 rounded animate-pulse"></div><div className="h-6 bg-gray-200 rounded animate-pulse"></div></div>}>
                <ChatSidebarControls onDelete={onDelete} conversationType="swiss" />
              </Suspense>
            </div>
          </div>

          {/* Main Content Area - centered */}
          <div className="flex flex-col flex-1 w-full min-w-0 mobile-chat-container">
            <div className="max-w-6xl mx-auto w-full h-full flex flex-col md:border-x border-gray-100">

              {/* Mobile Header */}
              <div className="md:hidden flex items-center justify-between gap-2 p-3 bg-white border-b border-gray-100 pt-safe">
                <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                  <SheetTrigger asChild>
                    <button
                      aria-label="Open menu"
                      className="p-2 rounded-md border border-gray-200 bg-white"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                  </SheetTrigger>
                  <SheetContent 
                    side="left" 
                    className="w-[85%] sm:max-w-xs p-0"
                    style={{
                      paddingTop: 'env(safe-area-inset-top)',
                      paddingBottom: 'env(safe-area-inset-bottom)',
                    }}
                  >
                    <div className="h-full flex flex-col bg-gray-50/50">
                      <div className="p-4 flex flex-col h-full bg-white">
                        <Suspense fallback={<div className="space-y-4"><div className="h-8 bg-gray-200 rounded animate-pulse"></div><div className="h-6 bg-gray-200 rounded animate-pulse"></div><div className="h-6 bg-gray-200 rounded animate-pulse"></div></div>}>
                          <ChatSidebarControls onDelete={onDelete} onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)} conversationType="swiss" />
                        </Suspense>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
                
                {/* Mobile header elements hidden for Swiss route */}
                {/* <div className="flex items-center gap-2">
                  <Suspense fallback={<div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse" />}>
                    <SwissNewChartButton />
                  </Suspense>
                  
                  <Suspense fallback={<div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse" />}>
                    <ChatMenuButton />
                  </Suspense>
                </div> */}
              </div>

              {/* Desktop Header - Hidden for Swiss route */}
              {/* <div className="hidden md:flex items-center justify-end p-4 gap-2">
                <SwissNewChartButton />
                <ChatMenuButton />
              </div> */}

              {/* Main Content - Chart Selector */}
              <div className="flex-1 min-h-0 overflow-y-auto" style={{ overflowAnchor: 'none' as any }}>
                <div className="h-full flex items-start md:items-center justify-center pt-4 md:pt-0">
                  <SwissChartSelector onSelectChart={handleSelectChart} />
                </div>
              </div>

              {/* Astro Form Modal */}
              {showAstroForm && selectedChartType && (
                <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                    <AstroDataForm
                      onClose={handleFormClose}
                      onSubmit={handleFormSubmit}
                      mode="swiss"
                      preselectedType={selectedChartType}
                    />
                  </div>
                </div>
              )}

              {/* Swiss Data Modal - Shows loading/data/copy */}
              <SwissDataModal
                isOpen={showDataModal}
                onClose={handleCloseDataModal}
                onViewData={handleViewAstroData}
                swissData={swissData}
                isLoading={isLoading}
                error={pollingError}
                chartType={(() => {
                  // Detect chart type from Swiss data structure (same logic as ReportSlideOver)
                  const detectChartType = (swissData: any): string | null => {
                    if (!swissData) return null;
                    
                    // Check for block_type at top level (weekly, focus)
                    if (swissData.block_type) {
                      return swissData.block_type;
                    }
                    
                    // Check for blocks structure
                    if (swissData.blocks) {
                      // Sync/compatibility charts have natal_set
                      if (swissData.blocks.natal_set) return 'sync';
                      if (swissData.blocks.synastry) return 'sync';
                      
                      // Essence charts have both natal and transits
                      if (swissData.blocks.natal && swissData.blocks.transits) return 'essence';
                      
                      // Single block types
                      if (swissData.blocks.natal) return 'natal';
                      if (swissData.blocks.progressions) return 'progressions';
                      if (swissData.blocks.return) return 'return';
                    }
                    
                    return null;
                  };

                  const detectedType = detectChartType(swissData);
                  const type = detectedType || selectedChartType || 'Swiss Data';
                  console.log('[SwissBox] Passing chartType to modal:', type);
                  return type;
                })()}
              />

              {/* Error Display */}
              {error && (
                <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border-t border-red-200">
                  {error}
                </div>
              )}

              {/* Conversation Overlay */}
              <Suspense fallback={null}>
                <ConversationOverlay />
              </Suspense>
            </div>
          </div>
        </div>
      </MotionConfig>
    </>
  );
};

