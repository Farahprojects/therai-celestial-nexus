import React from "react";
import { CalendarSession } from "@/types/calendar";


type Props = {
  date: Date;
  sessions: CalendarSession[];
  onSessionClick: (session: CalendarSession) => void;
  onDayClick?: (date: Date) => void;
};

// Helper: Generate a 5x7 grid, all real dates for prev/this/next month
const getMonthGrid = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstDayIdx = firstOfMonth.getDay(); // 0 is Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Previous month info
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

  // Only generate 5 rows × 7 days = 35 date objects (removes last row)
  const grid: Date[][] = [];
  let dayCounter = 1;
  let nextMonthDay = 1;
  for (let row = 0; row < 5; row++) {
    const week: Date[] = [];
    for (let col = 0; col < 7; col++) {
      const idx = row * 7 + col;
      let d: Date;
      if (idx < firstDayIdx) {
        // Days from previous month
        const day = daysInPrevMonth - (firstDayIdx - 1) + idx;
        d = new Date(prevMonthYear, prevMonth, day);
      } else if (dayCounter <= daysInMonth) {
        // Days of this month
        d = new Date(year, month, dayCounter);
        dayCounter++;
      } else {
        // Days from next month
        d = new Date(year, month + 1, nextMonthDay);
        nextMonthDay++;
      }
      week.push(d);
    }
    grid.push(week);
  }
  return grid;
};

const isToday = (d: Date) => {
  const now = new Date();
  return d?.toDateString() === now.toDateString();
};

const MonthView = ({
  date,
  sessions,
  onSessionClick,
  onDayClick,
}: Props) => {
  const grid = getMonthGrid(date);
  const viewMonth = date.getMonth();
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white hover:shadow-md transition-all duration-200">
      <div className="grid grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
          <div
            className={`py-2 px-2 text-xs font-bold text-center bg-white select-none
              ${index < 6 ? 'border-r border-gray-100' : ''}
            `}
            key={day}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-t border-gray-100">
        {grid.flat().map((d, i) => {
          const inThisMonth = d.getMonth() === viewMonth;
          const isTodayCell = isToday(d);
          const isMonthStart = d.getDate() === 1;
          const showMonthAbbr = isMonthStart && d.getMonth() !== viewMonth;
          const cellBg = isTodayCell ? "bg-primary/5" : "bg-white";
          const textColor = inThisMonth
            ? isTodayCell
              ? "text-primary"
              : ""
            : "text-muted-foreground";
          // Find all events on this day
          const dayEvents = sessions.filter(event =>
            event.start_time.toDateString() === d.toDateString()
          );

          const isLastInRow = (i + 1) % 7 === 0;
          const isLastRow = i >= 28; // Last row (5th row)

          return (
            <button
              key={i}
              className={`min-h-[60px] ${cellBg} p-1 flex flex-col gap-1 relative transition group focus:z-10 focus:ring-2 outline-none
                ${!isLastInRow ? 'border-r border-gray-100' : ''}
                ${!isLastRow ? 'border-b border-gray-100' : ''}
              `}
              style={{
                cursor: inThisMonth ? "pointer" : "default",
                opacity: inThisMonth ? 1 : 0.6,
              }}
              type="button"
              disabled={!inThisMonth}
              tabIndex={inThisMonth ? 0 : -1}
              onClick={
                inThisMonth
                  ? () => {
                      // If events on day, open modal with list, else default add
                      onDayClick?.(d);
                    }
                  : undefined
              }
              aria-label={inThisMonth ? `View/add sessions on ${d.toDateString()}` : undefined}
            >
              <span
                className={`text-xs font-semibold absolute left-2 top-1 z-10 ${textColor} flex items-baseline gap-0.5`}
              >
                {showMonthAbbr && (
                  <span className="text-[10px] font-medium mr-0.5 uppercase tracking-wide">
                    {d.toLocaleString(undefined, { month: "short" })}
                  </span>
                )}
                {d.getDate()}
              </span>
              <div className="flex flex-row flex-wrap gap-[4px] mt-5 ml-1">
                {dayEvents.map(event => (
                  <button
                    key={event.id}
                    onClick={e => {
                      e.stopPropagation();
                      onSessionClick(event);
                    }}
                    className="rounded-full border-2 border-white shadow focus:outline-none focus:ring-2 focus:ring-primary/60"
                    style={{
                      width: 14,
                      height: 14,
                      background: event.color_tag || "#a5b4fc",
                    }}
                    title={event.title}
                    aria-label={event.title}
                    tabIndex={0}
                    type="button"
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default MonthView;
