
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { safeConsoleError } from '@/utils/safe-logging';
interface ModalState {
  showNewClientModal: boolean;
  showJournalModal: boolean;
  showInsightModal: boolean;
  showReportModal: boolean;
  showEditModal: boolean;
  selectedClientId: string | null;
}

interface ModalStateContextType {
  modalState: ModalState;
  setModalState: (key: keyof ModalState, value: boolean | string | null) => void;
  resetModalState: () => void;
  preserveModalState: () => void;
  restoreModalState: () => void;
}

const defaultModalState: ModalState = {
  showNewClientModal: false,
  showJournalModal: false,
  showInsightModal: false,
  showReportModal: false,
  showEditModal: false,
  selectedClientId: null,
};

const ModalStateContext = createContext<ModalStateContextType | null>(null);

interface ModalStateProviderProps {
  children: ReactNode;
}

export const ModalStateProvider = ({ children }: ModalStateProviderProps) => {
  const [modalState, setModalStateInternal] = useState<ModalState>(defaultModalState);

  // Restore modal state from session storage on mount (tab-scoped)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = sessionStorage.getItem('modalState');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          setModalStateInternal(prevState => ({ ...prevState, ...parsedState }));
        } catch (error) {
          safeConsoleError('Failed to restore modal state:', error);
        }
      }
    }
  }, []);

  const setModalState = useCallback((key: keyof ModalState, value: boolean | string | null) => {
    setModalStateInternal(prevState => {
      const newState = { ...prevState, [key]: value };
      // Save to session storage (tab-scoped) for persistence
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('modalState', JSON.stringify(newState));
      }
      return newState;
    });
  }, []);

  const resetModalState = useCallback(() => {
    setModalStateInternal(defaultModalState);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('modalState');
    }
  }, []);

  const preserveModalState = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('modalState', JSON.stringify(modalState));
    }
  }, [modalState]);

  const restoreModalState = useCallback(() => {
    if (typeof window !== 'undefined') {
      const savedState = sessionStorage.getItem('modalState');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          setModalStateInternal(prevState => ({ ...prevState, ...parsedState }));
        } catch (error) {
          safeConsoleError('Failed to restore modal state:', error);
        }
      }
    }
  }, []);

  return (
    <ModalStateContext.Provider value={{
      modalState,
      setModalState,
      resetModalState,
      preserveModalState,
      restoreModalState
    }}>
      {children}
    </ModalStateContext.Provider>
  );
};

export const useModalState = () => {
  const context = useContext(ModalStateContext);
  if (!context) {
    throw new Error('useModalState must be used within a ModalStateProvider');
  }
  return context;
};
