
import React from "react";
import { CalendarSession } from "@/types/calendar";

// Returns array like ["M", "T", "W", "T", "F", "S", "S"]
const dayLetters = ["S", "M", "T", "W", "T", "F", "S"]; // Sun-Sat

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

// Returns the start of the week (Sunday) for a given date
function getStartOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

type Props = {
  weekDate: Date; // any date in week
  selectedDay: Date;
  onSelect: (date: Date) => void;
  sessions: CalendarSession[]; // for showing dots
};

export const MobileDaySelector: React.FC<Props> = ({
  weekDate,
  selectedDay,
  onSelect,
  sessions,
}: Props) => {
  const weekStart = getStartOfWeek(weekDate);
  const today = new Date();

  // Get events per day map for dot badges
  const sessionMap: Record<string, number> = {};
  for (const s of sessions) {
    const key = s.start_time.toISOString().slice(0, 10);
    sessionMap[key] = (sessionMap[key] || 0) + 1;
  }

  // Get dates for week (Sun-Sat)
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  return (
    <div className="flex justify-between mb-2 px-1">
      {days.map((date) => {
        const key = date.toISOString().slice(0, 10);
        const selected = isSameDay(date, selectedDay);
        const isToday = isSameDay(date, today);

        return (
          <button
            key={key}
            className={`flex flex-col items-center p-0.5 mx-1 rounded-full transition-all
              ${selected ? "bg-primary text-primary-foreground shadow" : ""}
              ${isToday && !selected ? "border border-primary font-bold" : ""}
              `}
            style={{
              width: 34,
              height: 44,
            }}
            onClick={() => onSelect(date)}
            aria-label={date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          >
            <span className="text-base pointer-events-none">
              {dayLetters[date.getDay()]}
            </span>
            <span className="text-xs opacity-60 pointer-events-none">
              {date.getDate()}
            </span>
            {sessionMap[key] && (
              <span
                className={`mt-0.5 h-2 w-2 rounded-full ${
                  selected ? "bg-white" : "bg-primary"
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
