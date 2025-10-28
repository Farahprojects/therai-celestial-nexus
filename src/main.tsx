
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initAuthManager } from './services/authManager';
import './index.css';

// Dev-only: suppress noisy Lovable editor console errors (CORS/504 polling)
import { initDevConsoleFilter } from './utils/devConsoleFilter';
// One-time cleanup of old storage keys
import { cleanupOldStorage } from './utils/cleanupOldStorage';
// Initialize WebSocket early for fast message fetching
import './stores/initializeApp';

// Force deploy - 2025-06-29
if (typeof window !== 'undefined') {
  // One-time cleanup of old storage keys
  cleanupOldStorage();
  
  if (import.meta.env.DEV) {
    initDevConsoleFilter();
  }
  // Initialize unified auth manager AFTER window is available
  // Ensures Capacitor bridge is ready before platform detection
  try { 
    console.log('[main.tsx] Initializing authManager...');
    initAuthManager(); 
    console.log('[main.tsx] authManager initialized successfully');
  } catch (error) {
    console.error('[main.tsx] CRITICAL: authManager initialization failed:', error);
  }
  createRoot(document.getElementById("root")!).render(
    <App />
  );
}
