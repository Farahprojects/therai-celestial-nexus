/**
 * 🔥 MEMORY CLEANUP UTILITY
 * 
 * Provides a centralized cleanup mechanism for all singleton services
 * to prevent memory leaks during hot reloads, navigation, or app termination.
 */

import { unifiedWebSocketService } from '@/services/websocket/UnifiedWebSocketService';
import { unifiedChannel } from '@/services/websocket/UnifiedChannelService';
import { chatController } from '@/features/chat/ChatController';
import { ttsPlaybackService } from '@/services/voice/TTSPlaybackService';
import { useAudioStore } from '@/stores/audioStore';
import { audioArbitrator } from '@/services/audio/AudioArbitrator';
import { environmentMonitor } from '@/utils/environmentMonitor';
import { directBarsAnimationService } from '@/services/voice/DirectBarsAnimationService';

const DEBUG = import.meta.env.DEV;

/**
 * Clean up all singleton services to prevent memory leaks
 * Call this on app unmount or when switching contexts
 */
export async function cleanupAllServices(): Promise<void> {
  if (DEBUG) console.log('[MemoryCleanup] 🧹 Starting global cleanup...');
  
  try {
    // 1. Stop all audio systems
    if (DEBUG) console.log('[MemoryCleanup] Stopping audio systems...');
    audioArbitrator.forceReleaseAll();
    await ttsPlaybackService.destroy().catch((error) => {
      console.warn('[MemoryCleanup] Failed to destroy TTS playback service:', error);
    });
    directBarsAnimationService.destroy();
    
    // 2. Close AudioContext
    if (DEBUG) console.log('[MemoryCleanup] Closing AudioContext...');
    await useAudioStore.getState().cleanup().catch((error) => {
      console.warn('[MemoryCleanup] Failed to cleanup audio store:', error);
    });
    
    // 3. Clean up chat controller
    if (DEBUG) console.log('[MemoryCleanup] Cleaning up ChatController...');
    chatController.cleanup();
    
    // 4. Clean up WebSocket services
    if (DEBUG) console.log('[MemoryCleanup] Cleaning up WebSocket services...');
    unifiedWebSocketService.cleanup();
    unifiedChannel.cleanup();
    
    // 5. Clean up message store auth listener
    if (DEBUG) console.log('[MemoryCleanup] Cleaning up MessageStore auth listener...');
    if ((window as any).__msgStoreAuthCleanup) {
      try {
        (window as any).__msgStoreAuthCleanup();
        (window as any).__msgStoreAuthCleanup = null;
      } catch (e) {
        console.error('[MemoryCleanup] Failed to cleanup auth listener:', e);
      }
    }

    // 6. Clean up environment monitor
    if (DEBUG) console.log('[MemoryCleanup] Cleaning up EnvironmentMonitor...');
    try {
      environmentMonitor.cleanup();
    } catch (e) {
      console.error('[MemoryCleanup] Failed to cleanup EnvironmentMonitor:', e);
    }
    
    if (DEBUG) console.log('[MemoryCleanup] ✅ Global cleanup complete');
  } catch (error) {
    console.error('[MemoryCleanup] ❌ Error during cleanup:', error);
  }
}

/**
 * Setup cleanup handlers for development hot reloads
 * This helps prevent memory leaks during development
 */
export function setupDevCleanup(): void {
  if (!DEBUG || typeof window === 'undefined') return;
  
  // Track if cleanup is already setup
  if ((window as any).__cleanupHandlerInstalled) return;
  (window as any).__cleanupHandlerInstalled = true;
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (DEBUG) console.log('[MemoryCleanup] Page unloading, cleaning up...');
    cleanupAllServices();
  });
  
  // Cleanup on Vite hot reload (development only)
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      if (DEBUG) console.log('[MemoryCleanup] Hot reload detected, cleaning up...');
      cleanupAllServices();
    });
  }
  
  if (DEBUG) console.log('[MemoryCleanup] 🔧 Dev cleanup handlers installed');
}

/**
 * Get memory usage statistics (development only)
 */
export function getMemoryStats(): object | null {
  if (!DEBUG || typeof window === 'undefined') return null;
  
  const performance = (window as any).performance;
  if (!performance || !performance.memory) return null;
  
  const memory = performance.memory;
  return {
    usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
    totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
    jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
    heapUsagePercent: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2) + '%'
  };
}

/**
 * Log memory stats to console (development only)
 */
export function logMemoryStats(): void {
  if (!DEBUG) return;
  const stats = getMemoryStats();
  if (stats) {
    console.log('[MemoryCleanup] 📊 Memory Stats:', stats);
  }
}

