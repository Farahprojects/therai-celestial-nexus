// Simplified voice waveform - basic energy display

import React, { useEffect, useRef } from 'react';

interface VoiceWaveformProps {
  audioLevelRef: React.MutableRefObject<number>;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ audioLevelRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const barsRef = useRef<number[]>([]);
  const lastLevelRef = useRef<number>(0);
  const lastAddTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Calculate available space for waveform - more padding to avoid buttons
      // Left: 16px breathing room
      // Right: 72px to clear both buttons (2 × 32px buttons + 4px gap + 4px margin)
      const leftPadding = 16;
      const rightPadding = 72;
      const availableWidth = width - leftPadding - rightPadding;
      
      // Constrain waveform to center 85% of available space for elegance
      const constrainedWidth = Math.min(availableWidth * 0.85, 500); // max 500px wide
      const startX = leftPadding + (availableWidth - constrainedWidth) / 2;
      
      // Get current audio level
      const level = audioLevelRef.current || 0;
      
      // Only add new bars when there's significant audio energy
      const now = Date.now();
      const energyThreshold = 0.01;
      const minTimeBetweenBars = 80; // Slightly faster for smoother flow
      
      // Check if we should add a new bar based on energy and timing
      const hasSignificantEnergy = level > energyThreshold;
      const enoughTimePassed = now - lastAddTimeRef.current > minTimeBetweenBars;
      const energyChanged = Math.abs(level - lastLevelRef.current) > 0.005;
      
      if (hasSignificantEnergy && (enoughTimePassed || energyChanged)) {
        barsRef.current.push(level);
        lastAddTimeRef.current = now;
        
        // Keep only bars that fit in constrained space
        const barWidth = 3;
        const barGap = 2; // Slightly more spacing for breathing room
        const maxBars = Math.floor(constrainedWidth / (barWidth + barGap));
        if (barsRef.current.length > maxBars) {
          barsRef.current.shift();
        }
      }
      
      lastLevelRef.current = level;
      
      // Draw bars within the constrained space with smooth animation
      const barWidth = 3;
      const barGap = 2;
      const maxHeight = height * 0.7; // Reduced from 0.8 for subtlety
      
      barsRef.current.forEach((barLevel, index) => {
        const x = startX + (index * (barWidth + barGap));
        const barHeight = Math.max(3, barLevel * maxHeight);
        const y = (height - barHeight) / 2;
        
        // Only draw if within constrained bounds
        const maxX = startX + constrainedWidth;
        if (x + barWidth <= maxX) {
          // Fade out bars as they get older (left side)
          const fadeProgress = index / barsRef.current.length;
          const opacity = 0.3 + (fadeProgress * 0.7); // 0.3 to 1.0
          
          // Use gray color with fade effect
          ctx.fillStyle = `rgba(107, 114, 128, ${opacity})`;
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [audioLevelRef]);

  return (
    <div className="relative w-full h-full pointer-events-none" aria-hidden>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};