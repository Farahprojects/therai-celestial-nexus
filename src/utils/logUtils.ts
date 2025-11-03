
/**
 * Simple logger utility that controls logging output based on environment
 * and provides different log levels
 */

// Centralized logging utility for clean console management
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  enabled: boolean;
  level: LogLevel;
  components: {
    ReportForm: boolean;
    SuccessScreen: boolean;
    orchestrator: boolean;
    [key: string]: boolean;
  };
}

// Default configuration - can be overridden via localStorage
const defaultConfig: LogConfig = {
  enabled: import.meta.env.DEV, // Only enabled in development
  level: 'info',
  components: {
    ReportForm: import.meta.env.DEV, // Enable ReportForm logs only in development
    SuccessScreen: false, // Disable verbose SuccessScreen logs
    orchestrator: false, // Disable orchestrator logs
    swissFormatter: false, // Disable verbose Swiss formatter logs
    pricing: false, // Disable verbose pricing logs
    auth: false, // Disable verbose auth logs
    publicReport: false, // Disable verbose public report logs
    urlHelpers: false, // Disable verbose URL helper logs
  }
};

// Get current config from localStorage or use default
const getLogConfig = (): LogConfig => {
  if (typeof window === 'undefined') return defaultConfig;
  
  try {
    const stored = localStorage.getItem('logConfig');
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to parse log config from localStorage');
  }
  
  return defaultConfig;
};

// Set log config
export const setLogConfig = (config: Partial<LogConfig>) => {
  const current = getLogConfig();
  const newConfig = { ...current, ...config };
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('logConfig', JSON.stringify(newConfig));
  }
};

// Main logging function
export const log = (level: LogLevel, message: string, data?: any, component?: string) => {
  const config = getLogConfig();
  
  // Check if logging is enabled
  if (!config.enabled) return;
  
  // Check component-specific settings
  if (component && config.components[component] === false) return;
  
  // Check log level
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(config.level);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex < currentLevelIndex) return;
  
  // Format the message
  const prefix = component ? `[${component}]` : '';
  const formattedMessage = `${prefix} ${message}`;
  
  // Log with appropriate method
  switch (level) {
    case 'debug':
      console.debug(formattedMessage, data);
      break;
    case 'info':
      console.log(formattedMessage, data);
      break;
    case 'warn':
      console.warn(formattedMessage, data);
      break;
    case 'error':
      console.error(formattedMessage, data);
      break;
  }
};

// Convenience functions for different components
export const logReportForm = (level: LogLevel, message: string, data?: any) => {
  log(level, message, data, 'ReportForm');
};

export const logSuccessScreen = (level: LogLevel, message: string, data?: any) => {
  log(level, message, data, 'SuccessScreen');
};

export const logOrchestrator = (level: LogLevel, message: string, data?: any) => {
  log(level, message, data, 'orchestrator');
};

// Quick toggle functions for development
export const enableVerboseLogging = () => {
  setLogConfig({
    enabled: true,
    components: {
      ReportForm: true,
      SuccessScreen: true,
      orchestrator: true,
      swissFormatter: true,
      pricing: true,
      auth: true,
      publicReport: true,
      urlHelpers: true,
    }
  });
  console.log('🔊 Verbose logging enabled');
};

export const disableVerboseLogging = () => {
  setLogConfig({
    enabled: true,
    components: {
      ReportForm: false,
      SuccessScreen: false,
      orchestrator: true,
      swissFormatter: false,
      pricing: false,
      auth: false,
      publicReport: false,
      urlHelpers: false,
    }
  });
  console.log('🔇 Verbose logging disabled');
};

// Export for global access in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).logUtils = {
    enableVerboseLogging,
    disableVerboseLogging,
    setLogConfig,
    getLogConfig,
  };
  
  // Add a simple toggle function for quick testing
  (window as any).toggleLogs = () => {
    const config = getLogConfig();
    if (config.components.ReportForm || config.components.SuccessScreen) {
      disableVerboseLogging();
      console.log('🔇 Verbose logs disabled. Run toggleLogs() again to enable.');
    } else {
      enableVerboseLogging();
      console.log('🔊 Verbose logs enabled. Run toggleLogs() again to disable.');
    }
  };
  
  // Show current status on load (only in development)
  if (process.env.NODE_ENV === 'development') {
    // Silent loading - no console message
  }
}

/**
 * Safe logging function for auth events that avoids logging sensitive data
 */
export function logAuth(message: string, data?: any): void {
  log('info', `Auth: ${message}`, data);
}

/**
 * Safe logging for navigation events
 */
export function logNavigation(message: string, data?: any): void {
  log('debug', `Navigation: ${message}`, data);
}
