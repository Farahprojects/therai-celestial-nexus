import React, { useEffect, useState } from 'react';
import { SwissBox } from '@/features/swiss/SwissBox';
import { ReportModalProvider } from '@/contexts/ReportModalContext';
import { useChatInitialization } from '@/hooks/useChatInitialization';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

/**
 * SwissContainer - Swiss Data Generator Page
 * 
 * Architecture:
 * - Clones ChatContainer structure but focused on Swiss data generation
 * - Reuses conversation management, report modal, and astro form
 * - No chat input or message list - pure data generation interface
 */
const SwissContainerContent: React.FC = () => {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Single responsibility: Initialize chat when threadId changes
  useChatInitialization();
  
  // Check for pending join token and open auth modal
  useEffect(() => {
    const pendingToken = localStorage.getItem('pending_join_token');
    if (pendingToken && !user) {
      setShowAuthModal(true);
    }
  }, [user]);

  return (
    <div 
      className="flex flex-col" 
      style={{ 
        height: '100dvh', 
        minHeight: '100vh', 
        overscrollBehavior: 'contain' as any,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      
      <ReportModalProvider>
        <SwissBox />
      </ReportModalProvider>
      
      {/* Auth modal for pending joins */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="login"
      />
    </div>
  );
};

const SwissContainer: React.FC = () => {
  return <SwissContainerContent />;
};

export default SwissContainer;

