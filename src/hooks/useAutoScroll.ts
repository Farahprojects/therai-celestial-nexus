import { useEffect, useRef, useState, useCallback } from "react";

export function useAutoScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = useCallback(() => {
    // rAF avoids jank if messages just mounted
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, []);

  // Track whether user is near bottom (within 48px)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const distance =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setAutoScroll(distance < 48);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Call this whenever messages length changes (or streaming chunk arrives)
  const onContentChange = useCallback(() => {
    if (autoScroll) {
      // ⚡ OPTIMIZED: Single rAF is sufficient - cuts scroll latency from ~32ms to ~16ms
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
      });
    }
  }, [autoScroll]);

  return { containerRef, bottomRef, onContentChange, scrollToBottom };
}
