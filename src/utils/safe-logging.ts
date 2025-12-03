
/**
 * Safe logging utilities that redact sensitive data
 */

export interface SafeError {
  message: string;
  name: string;
  code?: string | number;
}

/**
 * Safely extracts error information without exposing sensitive data
 */
export function extractSafeError(error: unknown): SafeError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      code: (error as Error & { code?: string | number }).code,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      name: 'Error',
    };
  }

  return {
    message: 'Unknown error',
    name: 'Error',
  };
}

/**
 * Safe console error that only logs redacted error information
 */
export function safeConsoleError(context: string, error: unknown): void {
  const safeError = extractSafeError(error);
  console.error(`${context}:`, safeError);
}

/**
 * Safe console warn that only logs redacted error information
 */
export function safeConsoleWarn(context: string, error: unknown): void {
  const safeError = extractSafeError(error);
  console.warn(`${context}:`, safeError);
}

/**
 * Safe console log for operational data - only log what you need
 */
export function safeConsoleLog(context: string, data?: Record<string, unknown>): void {
  if (data) {
    // Remove potentially sensitive keys
    const safeData = { ...data };
    delete safeData.user_id;
    delete safeData.userId;
    delete safeData.email;
    delete safeData.password;
    delete safeData.token;
    delete safeData.api_key;
    delete safeData.apiKey;
    delete safeData.secret;

    console.log(`${context}:`, safeData);
  } else {
    console.log(context);
  }
}
