// src/services/voice/stt-errors.ts
// Custom error class for STT limit exceeded
export class STTLimitExceededError extends Error {
  errorCode: string;
  currentUsage: number;
  limit: number;
  remaining: number;

  constructor(message: string, errorCode: string, currentUsage: number, limit: number, remaining: number) {
    super(message);
    this.name = 'STTLimitExceededError';
    this.errorCode = errorCode;
    this.currentUsage = currentUsage;
    this.limit = limit;
    this.remaining = remaining;
  }
}
