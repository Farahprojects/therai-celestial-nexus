/**
 * Viewport utilities: centralized helpers for mobile/desktop quirks.
 * - Safe area + VisualViewport aware bottom detection
 * - Samsung Internet and iOS Safari quirks encapsulated
 */

export const isSamsungInternet = (): boolean => /SamsungBrowser/i.test(navigator.userAgent);
export const isIos = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Get visual viewport height when available, otherwise window.innerHeight.
 * Applies a small buffer on Samsung Internet to account for persistent nav bars.
 */
export function getViewportHeight(): number {
  const vv = (window as typeof window & { visualViewport?: VisualViewport }).visualViewport as VisualViewport | undefined;
  let height = vv?.height ?? window.innerHeight;
  if (isSamsungInternet()) {
    // Conservative buffer for gesture/navigation bars that overlay content
    height = Math.max(0, height - 50);
  }
  return height;
}

/**
 * Distance in pixels from current scroll to the document bottom.
 * Uses visual viewport height when possible.
 */
export function getDistanceToBottom(): number {
  const contentHeight = document.documentElement.scrollHeight;
  const viewportHeight = getViewportHeight();
  const scrollPosition = window.scrollY || window.pageYOffset || 0;
  const dist = contentHeight - (scrollPosition + viewportHeight);
  return Math.max(0, Math.round(dist));
}

/**
 * Observe when the bottom sentinel enters the viewport. Returns a cleanup fn.
 * A sentinel will be created and appended to document.body if one isn't supplied.
 */
export function onReachBottom(
  callback: () => void,
  options?: IntersectionObserverInit & { sentinel?: HTMLElement }
): () => void {
  const sentinel = options?.sentinel ?? document.createElement('div');
  let appended = false;

  if (!options?.sentinel) {
    sentinel.setAttribute('data-bottom-sentinel', 'true');
    sentinel.style.cssText = 'width:1px;height:1px;opacity:0;';
    document.body.appendChild(sentinel);
    appended = true;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) callback();
    },
    {
      root: null,
      threshold: 1.0,
      ...options,
    }
  );

  observer.observe(sentinel);

  return () => {
    try {
      observer.disconnect();
      // eslint-disable-next-line no-empty
    } catch {
      // Silently ignore observer disconnect errors during cleanup
    }
    if (appended && sentinel.parentNode) {
      sentinel.parentNode.removeChild(sentinel);
    }
  };
}

/**
 * Subscribe to viewport changes (visual viewport where available). Returns cleanup fn.
 */
export function onViewportChange(handler: () => void): () => void {
  const vv = (window as typeof window & { visualViewport?: VisualViewport }).visualViewport as VisualViewport | undefined;
  if (vv) {
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
  }
  window.addEventListener('resize', handler);
  return () => {
    if (vv) {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    }
    window.removeEventListener('resize', handler);
  };
}


