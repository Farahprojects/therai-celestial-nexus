
import React from "react";
import { CalendarSession } from "@/types/calendar";
import { EventCard } from "../EventCard";

type Props = {
  date: Date;
  sessions: CalendarSession[];
  onSessionClick: (session: CalendarSession) => void;
  onMoveSession: (id: string, newStart: Date, newEnd: Date) => void;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
};

const isToday = (d: Date) => {
  const now = new Date();
  return now.toDateString() === d.toDateString();
};

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export default function WeekView({ date, sessions, onSessionClick }: Props) {
  const startOfWeek = getStartOfWeek(date);
  const days = [...Array(7)].map((_, i) => new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i));

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white hover:shadow-md transition-all duration-200">
      <div className="grid grid-cols-7 bg-gray-50/50">
        {days.map((day, index) => (
          <div
            key={day.toISOString()}
            className={`py-2 px-2 text-xs font-bold text-center select-none
              ${isToday(day) ? "text-primary" : ""}
              ${isWeekend(day) ? "bg-accent/20" : ""}
              ${index < days.length - 1 ? 'border-r border-gray-100' : ''}
            `}
          >
            {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 min-h-[200px] relative border-t border-gray-100">
        {days.map((day, index) => {
          const dayBg = "bg-white";
          const daySessions = sessions.filter(sess => sess.start_time.toDateString() === day.toDateString());
          return (
            <div
              key={day.toISOString()}
              className={`p-2 min-h-[120px] flex flex-col gap-1 transition ${dayBg} group relative
                ${index < days.length - 1 ? 'border-r border-gray-100' : ''}
              `}
            >
              {daySessions.length === 0
                ? null
                : daySessions.map(sess => (
                    <EventCard
                      key={sess.id}
                      session={sess}
                      onClick={() => onSessionClick(sess)}
                    />
                  ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
