
import React from "react";

type EmptySlotProps = {
  timeLabel?: string;
  onCreate?: () => void;
  interactive?: boolean;
  height?: number; // NEW: controls height/thickness in px
};

const EmptySlot: React.FC<EmptySlotProps> = ({
  timeLabel,
  onCreate,
  interactive = true,
  height = 40, // Default to 40px to match slotHeight in DayView
}: EmptySlotProps) => {
  return (
    <div
      className={`
        relative flex flex-col items-center justify-center
        px-1
        rounded-lg transition
        ${interactive ? "cursor-pointer hover:bg-accent/70 hover:shadow-lg" : ""}
        group
        bg-gradient-to-b from-accent/50 via-white to-accent/40
        `}
      onClick={onCreate}
      style={{
        minHeight: `${height}px`,
        border: "1px dashed #e5e7eb",
        zIndex: 0,
      }}
      tabIndex={interactive ? 0 : undefined}
      aria-label={timeLabel ? `Empty slot at ${timeLabel}` : "Empty slot"}
    >
      {timeLabel && (
        <span className="absolute left-1 top-1 text-xs text-muted-foreground opacity-50">
          {timeLabel}
        </span>
      )}
      <span className="opacity-0 group-hover:opacity-90 text-sm text-primary font-semibold pointer-events-none transition select-none">
        + Add Event
      </span>
    </div>
  );
};

export default EmptySlot;
