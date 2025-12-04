
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { initAuthManager } from './services/authManager';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { safeConsoleError } from '@/utils/safe-logging';
import './index.css';

// Dev-only: suppress noisy Lovable editor console errors (CORS/504 polling)
import { initDevConsoleFilter } from './utils/devConsoleFilter';
// One-time cleanup of old storage keys
import { cleanupOldStorage } from './utils/cleanupOldStorage';
// Initialize WebSocket early for fast message fetching
import './stores/initializeApp';
// 🔥 Initialize memory cleanup handlers (development only)
import { setupDevCleanup, logMemoryStats } from './utils/memoryCleanup';
// 🚨 Initialize comprehensive environment monitoring and error catching
import './utils/environmentMonitor';

// Initialize StatusBar for native apps
const initStatusBar = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch (error) {
      safeConsoleError('StatusBar initialization error:', error);
    }
  }
};

// Force deploy - 2025-06-29
if (typeof window !== 'undefined') {
  // One-time cleanup of old storage keys
  cleanupOldStorage();
  
  // Enable console filter in development only
  if (import.meta.env.DEV) {
    initDevConsoleFilter();
    // 🔥 Setup memory cleanup handlers for development
    setupDevCleanup();
    // Log initial memory stats
    logMemoryStats();
  }
  // Initialize StatusBar for native platforms
  initStatusBar();
  // Initialize unified auth manager AFTER window is available
  // Ensures Capacitor bridge is ready before platform detection
  initAuthManager();
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}
