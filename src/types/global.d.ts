// Global type declarations

interface Window {
  __authTrace?: {
    providerMounts: number;
    listeners: number;
    initialSessionChecks: number;
    shellLoads?: number;
  };
  CONVO_DEBUG?: boolean;
  webkitAudioContext?: typeof AudioContext;
}

// Extend Crypto interface for randomUUID support
interface Crypto {
  randomUUID(): string;
}