import React, { useEffect, ReactNode } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  pullThreshold?: number;
  maxPullDistance?: number;
  resistance?: number;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  pullThreshold = 80,
  maxPullDistance = 120,
  resistance = 2.5,
  disabled = false,
}) => {
  const {
    pullDistance,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePullToRefresh({
    onRefresh,
    pullThreshold,
    maxPullDistance,
    resistance,
  });

  useEffect(() => {
    if (disabled) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  const opacity = Math.min(pullDistance / pullThreshold, 1);
  const iconRotation = isRefreshing ? 360 : (pullDistance / pullThreshold) * 180;
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div className="relative h-full" data-pull-to-refresh-container>
      {/* Minimal refresh indicator */}
      {showIndicator && (
        <div
          className="absolute left-1/2 z-50 pointer-events-none"
          style={{
            transform: `translate(-50%, ${Math.min(pullDistance, maxPullDistance) - 30}px)`,
            transition: pullDistance === 0 ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        >
          <div
            className="flex items-center justify-center w-8 h-8"
            style={{
              opacity,
              transition: 'opacity 0.2s ease',
            }}
          >
            <RefreshCw
              className="w-5 h-5 text-gray-400"
              style={{
                transform: `rotate(${iconRotation}deg)`,
                transition: isRefreshing ? 'transform 0.6s linear infinite' : 'transform 0.2s ease',
                animation: isRefreshing ? 'spin 0.6s linear infinite' : 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Content with smooth transform */}
      <div
        className="h-full"
        style={{
          transform: `translateY(${pullDistance > 0 ? Math.min(pullDistance * 0.5, maxPullDistance * 0.5) : 0}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

