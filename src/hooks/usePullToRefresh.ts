import { useCallback, useRef, useState } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  pullThreshold?: number;
  maxPullDistance?: number;
  resistance?: number;
}

export function usePullToRefresh({
  onRefresh,
  pullThreshold = 80,
  maxPullDistance = 120,
  resistance = 2.5,
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const startScrollY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only trigger if we're at the top of the scroll container
    const scrollContainer = (e.target as HTMLElement).closest('[data-pull-to-refresh-container]');
    if (!scrollContainer) return;
    
    const scrollTop = scrollContainer.scrollTop;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      startScrollY.current = scrollTop;
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || isRefreshing) return;

    const scrollContainer = (e.target as HTMLElement).closest('[data-pull-to-refresh-container]');
    if (!scrollContainer || scrollContainer.scrollTop > 0) {
      isDragging.current = false;
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY.current;

    if (deltaY > 0) {
      // Apply resistance for smooth feel
      const distance = Math.min(deltaY / resistance, maxPullDistance);
      setPullDistance(distance);

      // Prevent default scroll if pulling down
      if (distance > 5) {
        e.preventDefault();
      }
    }
  }, [isRefreshing, maxPullDistance, resistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;

    isDragging.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(pullThreshold);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, pullThreshold, isRefreshing, onRefresh]);

  return {
    pullDistance,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    pullThreshold,
  };
}

