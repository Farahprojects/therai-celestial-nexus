import React, { useEffect, useRef } from 'react';
import { directBarsAnimationService, FourBarLevels } from '@/services/voice/DirectBarsAnimationService';

interface Props {
  isActive: boolean;
}

export const SpeakingBarsOptimized: React.FC<Props> = ({ isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<HTMLDivElement[]>([]);
  const targetLevelsRef = useRef<FourBarLevels>([0.2, 0.2, 0.2, 0.2]);
  const currentLevelsRef = useRef<FourBarLevels>([0.2, 0.2, 0.2, 0.2]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  // Per-bar phase offsets for subtle desync
  const phaseRef = useRef<number[]>([0.0, 0.5, 1.1, 1.7]);

  // Subscribe to analyser-driven levels (read-only)
  useEffect(() => {
    if (!isActive) return;
    const onLevels = (levels: FourBarLevels) => {
      targetLevelsRef.current = levels;
    };
    const unsubscribe = directBarsAnimationService.subscribe(onLevels);
    return unsubscribe;
  }, [isActive]);

  // Lightweight RAF loop with easing and wobble
  useEffect(() => {
    if (!isActive) return;
    if (!containerRef.current) return;

    const animate = (ts: number) => {
      const prev = lastTsRef.current || ts;
      const dt = Math.min(0.05, (ts - prev) / 1000); // clamp dt for stability
      lastTsRef.current = ts;

      const wobbleFreq = 4.2; // Hz-like feel (scaled by time below)
      const wobbleAmp = 0.08; // small wobble around target
      const ease = 12; // responsiveness for exponential smoothing
      const t = ts * 0.001;

      const target = targetLevelsRef.current;
      const current = currentLevelsRef.current;

      for (let i = 0; i < 4; i++) {
        // Base target with subtle per-bar phase wobble
        const wobble = 1 + wobbleAmp * Math.sin(t * wobbleFreq + phaseRef.current[i]);
        const targetWithWobble = Math.min(1, Math.max(0.15, target[i] * wobble));

        // Exponential smoothing toward target (spring-like without heavy physics)
        const alpha = 1 - Math.exp(-ease * dt);
        current[i] = current[i] + (targetWithWobble - current[i]) * alpha;

        // Apply height directly to each bar (preserves border radius)
        const barEl = barRefs.current[i];
        if (barEl) {
          // Make outer bars (0,3) a bit bigger than before, but still smaller than middle bars (1,2)
          const maxHeight = (i === 0 || i === 3) ? 128 : 192; // Outer bars max 128px, middle bars max 192px
          const height = Math.max(8, current[i] * maxHeight);
          barEl.style.height = `${height}px`;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
    };
  }, [isActive]);

  // 🎯 DESIGN: Two middle bars 2x taller than outer bars, all taller starting point
  const bars = [
    { id: 0, className: 'h-24' }, // Outer bar - taller starting point
    { id: 1, className: 'h-48' }, // Middle bar - 2x taller than outer
    { id: 2, className: 'h-48' }, // Middle bar - 2x taller than outer
    { id: 3, className: 'h-24' }, // Outer bar - taller starting point
  ];

  return (
    <div 
      ref={containerRef}
      className="flex items-center justify-center gap-3 h-48 w-40"
      style={{ willChange: 'transform' } as React.CSSProperties}
    >
      {bars.map((bar, idx) => (
        <div
          key={bar.id}
          ref={(el) => { if (el) barRefs.current[idx] = el; }}
          className={`bg-black ${bar.className}`}
          style={{
            width: '32px',
            height: idx === 0 || idx === 3 ? '26px' : '38px', // Initial height: outer bars 26px (0.2 * 128px), middle bars 38px (0.2 * 192px)
            borderRadius: '16px', // Half the width for perfectly round ends
            willChange: 'height',
            transition: 'none',
          }}
        />
      ))}
    </div>
  );
};
