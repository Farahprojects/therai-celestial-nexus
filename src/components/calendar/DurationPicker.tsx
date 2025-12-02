
import React from "react";
import { cn } from "@/lib/utils";

type Duration = { hours: number; minutes: number };
type DurationPickerProps = {
  value: Duration;
  onChange: (duration: Duration) => void;
  className?: string;
  disabled?: boolean;
};

export const DurationPicker: React.FC<DurationPickerProps> = ({
  value,
  onChange,
  className,
  disabled,
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        className
      )}
    >
      <span className="font-medium text-sm">Duration</span>
      <span className="mx-1 text-muted-foreground text-xs">H</span>
      <select
        value={value.hours}
        onChange={e =>
          onChange({ ...value, hours: Number(e.target.value) })
        }
        disabled={disabled}
        className="rounded px-2 py-1 border text-sm"
        aria-label="Duration hours"
      >
        {Array.from({ length: 9 }, (_, i) => i).map(h => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="mx-1 text-muted-foreground text-xs">M</span>
      <select
        value={value.minutes}
        onChange={e =>
          onChange({ ...value, minutes: Number(e.target.value) })
        }
        disabled={disabled}
        className="rounded px-2 py-1 border text-sm"
        aria-label="Duration minutes"
      >
        {[0, 15, 30, 45].map(m => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
};
