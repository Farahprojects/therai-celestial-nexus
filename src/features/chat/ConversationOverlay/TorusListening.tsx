import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from 'framer-motion';

const torusData = {
  "image_width": 326,
  "image_height": 338,
  "center": { "x": 158.175, "y": 173.308 },
  "dots": [
    { "cx": 20.745, "cy": 167.254, "r": 8.368 }, { "cx": 47.759, "cy": 161.066, "r": 7.269 },
    { "cx": 12.069, "cy": 148.853, "r": 6.746 }, { "cx": 36.502, "cy": 144.174, "r": 8.425 },
    { "cx": 29.337, "cy": 125.054, "r": 8.406 }, { "cx": 56.923, "cy": 127.748, "r": 7.377 },
    { "cx": 26.841, "cy": 104.820, "r": 6.793 }, { "cx": 51.3, "cy": 108.034, "r": 8.556 },
    { "cx": 50.5, "cy": 87.629, "r": 8.291 }, { "cx": 75.921, "cy": 98.536, "r": 7.269 },
    { "cx": 54.5, "cy": 67.533, "r": 6.909 }, { "cx": 76.911, "cy": 78.368, "r": 8.462 },
    { "cx": 82.457, "cy": 58.565, "r": 8.253 }, { "cx": 103.024, "cy": 76.861, "r": 7.269 },
    { "cx": 92.068, "cy": 40.712, "r": 6.817 }, { "cx": 110.071, "cy": 57.582, "r": 8.462 },
    { "cx": 121.465, "cy": 40.849, "r": 8.349 }, { "cx": 135.520, "cy": 64.461, "r": 7.290 },
    { "cx": 136.4, "cy": 26.862, "r": 6.793 }, { "cx": 148.274, "cy": 48.639, "r": 8.406 },
    { "cx": 164.211, "cy": 35.972, "r": 8.311 }, { "cx": 170.177, "cy": 62.928, "r": 7.334 },
    { "cx": 182.689, "cy": 27.241, "r": 6.793 }, { "cx": 187.222, "cy": 51.666, "r": 8.462 },
    { "cx": 206.474, "cy": 44.455, "r": 8.272 }, { "cx": 203.794, "cy": 72.082, "r": 7.356 },
    { "cx": 226.75, "cy": 42.035, "r": 6.675 }, { "cx": 223.646, "cy": 66.455, "r": 8.481 },
    { "cx": 243.821, "cy": 65.564, "r": 8.330 }, { "cx": 232.947, "cy": 91.052, "r": 7.420 },
    { "cx": 263.841, "cy": 69.655, "r": 6.793 }, { "cx": 253.25, "cy": 91.916, "r": 8.519 },
    { "cx": 272.742, "cy": 97.434, "r": 8.253 }, { "cx": 254.527, "cy": 118.208, "r": 7.203 },
    { "cx": 290.722, "cy": 107.243, "r": 6.770 }, { "cx": 273.885, "cy": 125.268, "r": 8.500 },
    { "cx": 290.637, "cy": 136.692, "r": 8.330 }, { "cx": 267.087, "cy": 150.807, "r": 7.377 },
    { "cx": 304.659, "cy": 151.605, "r": 6.840 }, { "cx": 282.897, "cy": 163.386, "r": 8.462 },
    { "cx": 295.525, "cy": 179.4, "r": 8.272 }, { "cx": 268.575, "cy": 185.406, "r": 7.247 },
    { "cx": 304.183, "cy": 197.897, "r": 6.840 }, { "cx": 279.912, "cy": 202.328, "r": 8.519 },
    { "cx": 287.013, "cy": 221.576, "r": 8.406 }, { "cx": 259.5, "cy": 219.0, "r": 7.269 },
    { "cx": 289.5, "cy": 241.680, "r": 6.770 }, { "cx": 264.930, "cy": 238.611, "r": 8.537 },
    { "cx": 265.817, "cy": 258.904, "r": 8.349 }, { "cx": 240.451, "cy": 248.024, "r": 7.225 },
    { "cx": 261.894, "cy": 278.957, "r": 6.723 }, { "cx": 239.631, "cy": 268.445, "r": 8.368 },
    { "cx": 234.101, "cy": 288.027, "r": 8.291 }, { "cx": 213.184, "cy": 269.672, "r": 7.312 },
    { "cx": 224.262, "cy": 305.882, "r": 6.793 }, { "cx": 206.181, "cy": 288.915, "r": 8.481 },
    { "cx": 194.810, "cy": 305.731, "r": 8.291 }, { "cx": 180.633, "cy": 282.266, "r": 7.334 },
    { "cx": 179.971, "cy": 319.830, "r": 6.723 }, { "cx": 168.152, "cy": 298.013, "r": 8.556 },
    { "cx": 152.078, "cy": 310.663, "r": 8.311 }, { "cx": 145.928, "cy": 283.646, "r": 7.290 },
    { "cx": 133.755, "cy": 319.286, "r": 6.746 }, { "cx": 129.114, "cy": 294.929, "r": 8.500 },
    { "cx": 109.898, "cy": 302.285, "r": 8.311 }, { "cx": 112.538, "cy": 274.556, "r": 7.290 },
    { "cx": 89.621, "cy": 304.621, "r": 6.863 }, { "cx": 92.925, "cy": 280.184, "r": 8.519 },
    { "cx": 72.522, "cy": 280.954, "r": 8.406 }, { "cx": 83.518, "cy": 255.518, "r": 7.269 },
    { "cx": 52.431, "cy": 276.993, "r": 6.817 }, { "cx": 63.139, "cy": 254.772, "r": 8.537 },
    { "cx": 43.393, "cy": 249.25, "r": 8.291 }, { "cx": 61.772, "cy": 228.377, "r": 7.290 },
    { "cx": 25.493, "cy": 239.459, "r": 6.863 }, { "cx": 42.586, "cy": 221.284, "r": 8.462 },
    { "cx": 25.538, "cy": 209.990, "r": 8.387 }, { "cx": 49.518, "cy": 195.843, "r": 7.269 },
    { "cx": 11.794, "cy": 195.061, "r": 6.817 }, { "cx": 33.617, "cy": 183.16, "r": 8.462 }
  ]
};

type TorusListeningProps = {
  active: boolean;
  size?: number;
  isThinking?: boolean;
  audioLevelRef?: React.MutableRefObject<number>; // Use external audio level ref instead of getUserMedia
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function TorusListening({
  active,
  size = 180,
  isThinking = false,
  audioLevelRef,
}: TorusListeningProps) {
  const [time, setTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  
  // Use external audio level ref instead of managing our own stream
  const level = audioLevelRef?.current || 0;

  const dots = useMemo(() => {
    return torusData.dots
      .map(dot => {
        const dx = dot.cx - torusData.center.x;
        const dy = dot.cy - torusData.center.y;
        return { ...dot, dist: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort((a, b) => b.dist - a.dist);
  }, []);

  useEffect(() => {
    let mounted = true;

    function loop() {
      const tick = () => {
        if (!mounted) return;
        setTime(performance.now());
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }

    function stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (active) loop();
    else stop();

    return () => {
      mounted = false;
      stop();
    };
  }, [active]);

  const energy = Math.min(1, level * 3);
  const t = time / 4000;
  const rotation = isThinking ? (time / 50) % 360 : 0;
  const scale = size / torusData.image_width;
  const dotColor = "rgb(60, 60, 65)"; // A single, elegant dark grey color

  return (
    <div style={{ 
      width: size, 
      height: torusData.image_height * scale,
      position: 'relative',
      display: 'grid',
      placeItems: 'center',
    }}>
      <motion.div
        style={{ width: '100%', height: '100%' }}
        animate={{ rotate: rotation }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      >
        <svg
          width={size}
          height={torusData.image_height * scale}
          viewBox={`0 0 ${torusData.image_width} ${torusData.image_height}`}
          style={{ background: 'transparent' }}
          aria-hidden
        >
          {dots.map((dot, idx) => {
            let opacity = 0;
            let dotScale = 1;

            if (isThinking) {
              const angle = Math.atan2(dot.cy - torusData.center.y, dot.cx - torusData.center.x);
              const breathe = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 + angle);
              opacity = lerp(0.2, 0.5, breathe);
              dotScale = lerp(1, 1.05, breathe);
            } else { // Listening State
              const baseDotCount = Math.floor(dots.length * 0.3);
              const dynamicDotCount = (dots.length - baseDotCount) * energy;
              const visibleDots = baseDotCount + dynamicDotCount;
              opacity = idx < visibleDots ? 0.9 : 0.3; // Show inactive dots in light grey
              dotScale = idx < visibleDots ? 1 + energy * 0.1 : 1;
            }
            
            // Determine dot color based on whether it's active or inactive
            const isActive = idx < (isThinking ? dots.length : (Math.floor(dots.length * 0.3) + (dots.length - Math.floor(dots.length * 0.3)) * energy));
            const fillColor = isActive ? dotColor : "rgb(180, 180, 185)"; // Light grey for inactive dots
            
            return (
              <motion.circle
                key={idx}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill={fillColor}
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity, scale: dotScale }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            );
          })}
        </svg>
      </motion.div>
    </div>
  );
}
