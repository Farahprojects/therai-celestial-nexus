import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  animate,
  PanInfo,
  useTransform,
} from 'framer-motion';

// Helper – clamp a value between two bounds
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

interface PickerWheelProps<T extends string | number> {
  options: T[];
  value: T;
  onChange: (next: T) => void;
  height?: number; // visible height of the wheel
  itemHeight?: number; // height of each row
  className?: string; // extra Tailwind classes
  infinite?: boolean; // enable infinite scrolling
}

/**
 * PickerWheel – polished iOS‑style scroll wheel with Apple-like feel.
 *
 * Features
 * • Apple-style spring snapping + momentum
 * • no blank entries, clean value alignment
 * • subtle dimming for off-center items
 * • buttery smooth scrolling with proper damping
 * • fade masks top/bottom
 * • clean selection lane with thin divider lines (iOS style)
 * • a11y listbox semantics
 * • infinite looping support
 */
function PickerWheel<T extends string | number = string>({
  options,
  value,
  onChange,
  height = 240,
  itemHeight = 40,
  className = '',
  infinite = false,
}: PickerWheelProps<T>) {
  /* --------------------------------------------------------------------- */
  // Refs & motion values
  const containerRef = useRef<HTMLDivElement>(null);
  const rawY = useMotionValue(0);
  const y = useSpring(rawY, { stiffness: 400, damping: 45, mass: 0.8 });

  const [{ isDragging }, setDrag] = useState({ isDragging: false });
  
  // Track if value change came from internal picker interaction
  const isInternalUpdate = useRef(false);
  const lastExternalValue = useRef(value);
  
  // Lock out snapping until first render completes + touch begins
  const hasMounted = useRef(false);

  // Create infinite options array if infinite mode is enabled
  // Filter out any blank/empty entries for clean Apple-style behavior
  const infiniteOptions = useMemo(() => {
    if (!infinite) return options;
    
    const repetitions = 5;
    const filtered = options.filter((opt) => opt !== '' && opt != null); // drop blanks
    return Array(repetitions).fill(filtered).flat();
  }, [options, infinite]);

  // Calculate the center repetition index for infinite mode
  const centerRepetitionStart = useMemo(() => {
    if (!infinite) return 0;
    return Math.floor(infiniteOptions.length / options.length / 2) * options.length;
  }, [infinite, infiniteOptions.length, options.length]);

  /* --------------------------------------------------------------------- */
  // Smooth preload position - fires only once, avoids motion snap
  useLayoutEffect(() => {
    const idx = options.indexOf(value);
    if (idx !== -1) {
      const centerTop = (height - itemHeight) / 2;
      const targetIndex = infinite
        ? centerRepetitionStart + idx
        : idx;

      const initialY = centerTop - targetIndex * itemHeight;
      rawY.set(initialY);
      y.set(initialY);
      lastExternalValue.current = value;
    }
  }, [centerRepetitionStart, height, infinite, itemHeight, options, rawY, value, y]); // Dependencies for initial positioning

  // Enable syncing after first mount
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Keep wheel in sync with external value - only when not dragging and truly external
  useEffect(() => {
    if (!hasMounted.current) return; // 🚫 don't sync yet

    // Don't sync during drag or if this is an internal update
    if (isDragging || isInternalUpdate.current) {
      isInternalUpdate.current = false; // Reset flag
      return;
    }

    // Only sync if value actually changed externally
    if (value === lastExternalValue.current) {
      return;
    }

    const idx = options.indexOf(value);
    if (idx !== -1) {
      // Calculate position so selected item aligns with center
      const centerTop = (height - itemHeight) / 2;
      let targetIndex = idx;
      
      // For infinite mode, use the center repetition
      if (infinite) {
        targetIndex = centerRepetitionStart + idx;
      }
      
      const finalY = centerTop - targetIndex * itemHeight;
      rawY.set(finalY);
      y.set(finalY);
      
      lastExternalValue.current = value;
    }
  }, [value, options, itemHeight, rawY, y, height, infinite, centerRepetitionStart, isDragging]);

  // Convert y‑offset → nearest option index (handles infinite mode)
  const nearestIndex = useCallback(
    (yPos: number) => {
      const centerTop = (height - itemHeight) / 2;
      const adjustedY = centerTop - yPos;
      const virtualIndex = clamp(Math.round(adjustedY / itemHeight), 0, infiniteOptions.length - 1);
      
      // For infinite mode, map virtual index back to actual option index
      if (infinite) {
        return virtualIndex % options.length;
      }
      
      return virtualIndex;
    },
    [itemHeight, infiniteOptions.length, height, infinite, options.length]
  );

  // Snap helper (springs & fires onChange)
  const snapTo = useCallback(
    (target: number, velocity = 0) => {
      const centerTop = (height - itemHeight) / 2;
      let targetY = target;
      
      if (infinite) {
        // Calculate which virtual index we're closest to
        const adjustedY = centerTop - target;
        let virtualIndex = Math.round(adjustedY / itemHeight);
        
        // Handle boundary wrapping for infinite scroll
        if (virtualIndex < centerRepetitionStart - options.length) {
          // Wrap to end of center repetition
          virtualIndex = centerRepetitionStart + options.length - 1;
        } else if (virtualIndex >= centerRepetitionStart + options.length * 2) {
          // Wrap to start of center repetition
          virtualIndex = centerRepetitionStart;
        }
        
        // Clamp to valid range
        virtualIndex = clamp(virtualIndex, 0, infiniteOptions.length - 1);
        targetY = centerTop - virtualIndex * itemHeight;
      } else {
        // Original finite scrolling logic
        const idx = nearestIndex(target);
        targetY = centerTop - idx * itemHeight;
      }

      const controls = animate(rawY, targetY, {
        type: 'spring',
        stiffness: 420,
        damping: 55, // slightly higher to reduce bounce
        velocity,
      });

      controls.then(() => {
        const actualIndex = nearestIndex(targetY);
        if (options[actualIndex] !== value) {
          // Mark this as internal update to prevent sync conflicts
          isInternalUpdate.current = true;
          lastExternalValue.current = options[actualIndex];
          onChange(options[actualIndex]);
        }
      });
    },
    [nearestIndex, rawY, options, onChange, value, height, itemHeight, infinite, centerRepetitionStart, infiniteOptions.length]
  );

  /* --------------------------------------------------------------------- */
  // Drag handlers
  const onDragStart = () => setDrag({ isDragging: true });
  
  const onDrag = (_: PointerEvent, info: PanInfo) => {
    const currentY = rawY.get() + info.delta.y;
    rawY.set(currentY);
  };

  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    setDrag({ isDragging: false });

    if (infinite) {
      // Reduce momentum multiplier for Apple-like feel
      const projected = rawY.get() + info.velocity.y * 0.12;
      snapTo(projected, info.velocity.y);
    } else {
      // Original finite scrolling with rubber band
      const centerTop = (height - itemHeight) / 2;
      const minY = centerTop - (options.length - 1) * itemHeight;
      const maxY = centerTop;
      const rubber = 0.4 * itemHeight;
      const clamped = clamp(rawY.get(), minY - rubber, maxY + rubber);

      // Reduce momentum multiplier for Apple-like feel
      const projected = clamped + info.velocity.y * 0.12;
      snapTo(projected, info.velocity.y);
    }
  };

  /* --------------------------------------------------------------------- */
  // Wheel / trackpad scroll for desktop
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      rawY.set(rawY.get() - e.deltaY);
      snapTo(rawY.get(), -e.deltaY);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [rawY, snapTo]);

  /* --------------------------------------------------------------------- */
  // Styling helpers
  const centerTop = (height - itemHeight) / 2;
  const gradientH = itemHeight * 2; // fade height

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Picker wheel"
      className={`relative overflow-hidden select-none touch-pan-y ${className}`}
      style={{ height }}
    >
      {/* top fade */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-white via-white/70 to-transparent dark:from-neutral-900 dark:via-neutral-900/70"
        style={{ height: gradientH }}
      />

      {/* bottom fade */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-white via-white/70 to-transparent dark:from-neutral-900 dark:via-neutral-900/70"
        style={{ height: gradientH }}
      />

      {/* Highlight background for selected item */}
      <div
        className="pointer-events-none absolute inset-x-0 z-0"
        style={{
          top: centerTop,
          height: itemHeight,
          backgroundColor: 'rgba(0,0,0,0.03)',
          borderRadius: 6,
        }}
      />

      {/* selection lane – clean iOS style with just thin borders */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-t border-b border-neutral-300 dark:border-neutral-600"
        style={{ top: centerTop, height: itemHeight }}
        aria-hidden="true"
      />

      {/* scrollable list */}
      <motion.div
        drag="y"
        dragElastic={infinite ? 0 : 0.2}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        style={{ y }}
      >
        {infiniteOptions.map((opt, i) => (
          <PickerItem 
            key={`${String(opt)}-${i}`} 
            index={i} 
            itemHeight={itemHeight} 
            y={y} 
            value={opt} 
            centerTop={centerTop} 
          />
        ))}
      </motion.div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
// Individual row - enhanced for Apple-style visibility
interface ItemProps {
  value: string | number;
  index: number;
  itemHeight: number;
  y: ReturnType<typeof useSpring>;
  centerTop: number;
}

const PickerItem = React.memo<ItemProps>(({ value, index, itemHeight, y, centerTop }) => {
  // Distance from centre (0 = centred) - adjusted for new positioning
  const d = useTransform(y, (latest) => Math.abs((centerTop - latest) / itemHeight - index));

  // Apple-style subtle dimming - not full fade out
  const opacity = useTransform(d, [0, 1, 2], [1, 0.75, 0.5]);
  const scale = useTransform(d, [0, 1], [1, 0.85]);
  const weight = useTransform(d, (dist) => (dist < 0.5 ? 700 : 400));
  // Better off-center visibility with neutral-600 instead of neutral-400
  const color = useTransform(d, (dist) =>
    dist < 0.5 ? '#111827' : '#6B7280' // neutral-900 center, neutral-600 off-center
  );

  return (
    <motion.div
      role="option"
      aria-selected={d.get() < 0.5}
      className="flex items-center justify-center h-full"
      style={{
        height: itemHeight,
        opacity,
        scale,
        color,
        fontWeight: weight,
      }}
    >
      <motion.span className="text-lg">{value}</motion.span>
    </motion.div>
  );
});
PickerItem.displayName = 'PickerItem';

export default PickerWheel;
