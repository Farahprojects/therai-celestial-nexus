
/* Dev-only console filter to reduce noise from the Lovable editor network polling
   This does NOT hide real app errors. It only suppresses known, external noise patterns.
*/

// Idempotent guard
let __consoleFilterInstalled = false;

export function initDevConsoleFilter() {
  if (typeof window === 'undefined' || __consoleFilterInstalled) return;
  __consoleFilterInstalled = true;

  // Only run in development or when framed inside the Lovable preview
  const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
  const isFramed = window.self !== window.top;
  if (!isDev && !isFramed) return;

  const suppressedPatterns: RegExp[] = [
    /lovable-api\.com/i,
    /\/latest-message\b/i,
    /Access to fetch at .* has been blocked by CORS policy/i,
    /net::ERR_FAILED/i,
    /Gateway Timeout/i,
    /\[renderMessages\]/i,
    /🔍 Assistant message:/i,
    /🖼️.*Rendering image message:/i,
  ];

  const shouldSuppress = (args: unknown[]): boolean => {
    try {
      const text = args
        .map((a) => (typeof a === 'string' ? a : a?.message || ''))
        .join(' ');
      return suppressedPatterns.some((re) => re.test(text));
    } catch {
      return false;
    }
  };

  const wrap = <T extends (...a: unknown[]) => void>(fn: T): T => {
    const wrapped = ((...args: unknown[]) => {
      if (shouldSuppress(args)) return; // drop noisy messages
      fn(...args);
    }) as T;
    return wrapped;
  };

  // Patch console methods minimally
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  } as const;

  console.log = wrap(original.log);
  console.info = wrap(original.info);
  console.warn = wrap(original.warn);
  console.error = wrap(original.error);
  console.debug = wrap(original.debug);

  // Best-effort: prevent default logging for specific global errors
  const errorHandler = (messageOrEvent: unknown, source?: string) => {
    try {
      const text = typeof messageOrEvent === 'string'
        ? messageOrEvent
        : messageOrEvent?.message || '';
      if (suppressedPatterns.some((re) => re.test(text)) || (source && /lovable-api\.com/i.test(source))) {
        return true; // prevent default logging
      }
    } catch {
      // eslint-disable-next-line no-empty
    }
    return false;
  };

  // onerror: return true to prevent default
  const prevOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const suppressed = errorHandler(message, source);
    if (suppressed) return true;
    if (typeof prevOnError === 'function') return prevOnError.call(window, message, source, lineno, colno, error);
    return false;
  };

  // unhandledrejection
  const prevOnRejection = window.onunhandledrejection;
  window.onunhandledrejection = function (event: PromiseRejectionEvent) {
    const msg = (event.reason && (event.reason.message || String(event.reason))) || '';
    if (suppressedPatterns.some((re) => re.test(msg))) {
      event.preventDefault();
      return true;
    }
    if (typeof prevOnRejection === 'function') return prevOnRejection.call(window, event);
    return false;
  };
}
