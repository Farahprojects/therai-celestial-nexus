
import { useEffect, useRef } from 'react';

interface UseTabVisibilityOptions {
  onTabHidden?: () => void;
  onTabVisible?: () => void;
  pausePollingOnHidden?: boolean;
}

export const useTabVisibility = (options: UseTabVisibilityOptions = {}) => {
  const { onTabHidden, onTabVisible, pausePollingOnHidden = true } = options;
  const isVisibleRef = useRef(true);
  const tabIdRef = useRef<string>(`tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;

      if (isVisible !== isVisibleRef.current) {
        isVisibleRef.current = isVisible;

        if (isVisible) {
          onTabVisible?.();
          // Broadcast that this tab is now active with unique tab ID
          const timestamp = Date.now().toString();
          localStorage.setItem('activeTab', timestamp);
          localStorage.setItem('activeTabId', tabIdRef.current);
        } else {
          onTabHidden?.();
        }
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check if another tab is already active
    const checkOtherTabs = () => {
      const lastActive = localStorage.getItem('activeTab');
      const lastActiveTabId = localStorage.getItem('activeTabId');

      if (lastActive && lastActiveTabId !== tabIdRef.current) {
        const timeSinceLastActive = Date.now() - parseInt(lastActive);
        // If another tab was active within last 5 seconds, this tab should pause
        if (timeSinceLastActive < 5000 && !document.hidden) {
          onTabHidden?.();
        }
      }
    };

    // Cleanup function to remove this tab's timestamp when tab closes
    const handleBeforeUnload = () => {
      const currentActiveTabId = localStorage.getItem('activeTabId');
      if (currentActiveTabId === tabIdRef.current) {
        localStorage.removeItem('activeTab');
        localStorage.removeItem('activeTabId');
      }
    };

    // Check on mount
    checkOtherTabs();

    // Add beforeunload listener for cleanup
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Capture ref value for cleanup
    const currentTabId = tabIdRef.current;

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Cleanup on unmount if this tab was the active one
      const currentActiveTabId = localStorage.getItem('activeTabId');
      if (currentActiveTabId === currentTabId) {
        localStorage.removeItem('activeTab');
        localStorage.removeItem('activeTabId');
      }
    };
  }, [onTabHidden, onTabVisible]);

  return {
    isVisible: isVisibleRef.current,
    pausePollingOnHidden
  };
};
