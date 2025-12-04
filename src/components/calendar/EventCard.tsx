import React from "react";
import { CalendarSession } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { Circle, ChevronRight } from "lucide-react";

type Props = {
  session: CalendarSession;
  onClick?: () => void;
  onDelete?: () => void;
  isDetailed?: boolean;
  clientName?: string;
  compact?: boolean;
};

// Format time as: 4:23 - 5:23 pm 1h
function formatTimeAndDuration(start: Date, end: Date) {
  const startH = start.getHours();
  const endH = end.getHours();
  const startM = start.getMinutes();
  const endM = end.getMinutes();

  // Hour/min padding
  const pad = (x: number) => x.toString().padStart(2, "0");

  // Format: "h:mm"
  const fmt = (h: number, m: number) => {
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${pad(m)}`;
  };

  // Calculate duration, rounding minutes
  let ms = end.getTime() - start.getTime();
  if (ms < 0) ms += 24 * 60 * 60 * 1000; // handle midnight wrap
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let durationStr = "";
  if (hours > 0) durationStr += `${hours}h`;
  if (minutes > 0) durationStr += (durationStr ? " " : "") + `${minutes}m`;

  // Use AM/PM on only end time
  const ampm = endH >= 12 ? "pm" : "am";

  return `${fmt(startH, startM)} - ${fmt(endH, endM)}${ampm} ${durationStr}`;
}

export const EventCard = ({
  session,
  onClick,
  onDelete,
  isDetailed,
  clientName,
  compact = false,
}: Props) => {
  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`
          rounded-xl shadow-md border px-3 py-2 cursor-pointer flex flex-row items-center gap-2 bg-white
          hover:bg-accent/60 transition duration-200 group relative w-full min-w-0
        `}
        style={{ color: "#242424", opacity: onClick ? 0.97 : 1 }}
        tabIndex={0}
      >
        {/* Dot */}
        <Circle
          size={15}
          fill={session.color_tag || "#a5b4fc"}
          color={session.color_tag || "#a5b4fc"}
          strokeWidth={2}
          className="shrink-0"
        />
        {/* Client Name */}
        {clientName && (
          <span className="font-bold text-xs truncate max-w-[80px]">{clientName}</span>
        )}
        {/* Title */}
        <span className="font-semibold text-xs truncate max-w-[90px]">{session.title}</span>
        {/* Description (if detailed) */}
        {isDetailed && !!session.description && (
          <span className="text-xs text-muted-foreground truncate max-w-[110px]">{session.description}</span>
        )}
        {/* Time and duration display */}
        <span className="text-xs font-bold opacity-90 text-primary ml-auto whitespace-nowrap">
          {formatTimeAndDuration(session.start_time, session.end_time)}
        </span>
        {/* Visual chevron as edit indicator */}
        <ChevronRight size={18} className="ml-2 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100" aria-label="Edit" />
        {/* Delete button (optional, only if onDelete exists) */}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="ml-2"
          >
            ×
          </Button>
        )}
      </div>
    );
  }

  // Default vertical layout (original)
  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl shadow-md border px-3 py-2 cursor-pointer flex flex-col gap-1 bg-white
        hover:bg-accent/60 transition duration-200 transform hover:scale-[1.025]
        group relative
        `}
      style={{ color: "#242424", opacity: onClick ? 0.97 : 1 }}
    >
      {/* Top Row: Dot + Client Name */}
      <div className="flex items-center gap-2">
        <Circle
          size={16}
          fill={session.color_tag || "#a5b4fc"}
          color={session.color_tag || "#a5b4fc"}
          strokeWidth={2}
        />
        {clientName && (
          <span className="font-bold text-sm">{clientName}</span>
        )}
      </div>
      {/* Title & Delete Button */}
      <div className="flex justify-between items-start w-full mt-0.5">
        <span className="font-semibold text-sm ml-6">{session.title}</span>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            ×
          </Button>
        )}
      </div>
      {/* Time and duration display */}
      <div className="flex items-center gap-2 mt-1 text-xs font-bold opacity-90 text-primary">
        <span>{formatTimeAndDuration(session.start_time, session.end_time)}</span>
        <ChevronRight size={18} className="ml-auto text-muted-foreground opacity-70 group-hover:opacity-100" aria-label="Edit" />
      </div>
      {/* Description (for isDetailed) */}
      {isDetailed && <div className="text-xs mt-1 text-muted-foreground">{session.description}</div>}
    </div>
  );
};
