import { CalendarSession } from "@/types/calendar";

type Props = {
  date: Date;
  sessions: CalendarSession[];
  onSessionClick: (session: CalendarSession) => void;
  onDayClick?: (date: Date) => void;
};

// Generate a 5x7 grid for the month, showing prev/next month days as needed
const getMonthGrid = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstDayIdx = firstOfMonth.getDay(); // 0 is Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Previous month details
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

  const grid: Date[][] = [];
  let dayCounter = 1;
  let nextMonthDay = 1;
  for (let row = 0; row < 5; row++) {
    const week: Date[] = [];
    for (let col = 0; col < 7; col++) {
      const idx = row * 7 + col;
      let d: Date;
      if (idx < firstDayIdx) {
        // Previous month dates
        const day = daysInPrevMonth - (firstDayIdx - 1) + idx;
        d = new Date(prevMonthYear, prevMonth, day);
      } else if (dayCounter <= daysInMonth) {
        // This month
        d = new Date(year, month, dayCounter);
        dayCounter++;
      } else {
        // Next month
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

const MobileMonthView = ({ date, sessions, onDayClick }: Props) => {
  const grid = getMonthGrid(date);
  const viewMonth = date.getMonth();

  return (
    <div className="w-full overflow-x-auto">
      <div className="grid grid-cols-7 gap-[1px] border rounded-lg overflow-hidden bg-gray-100">
        {["S", "M", "T", "W", "T", "F", "S"].map(day => (
          <div
            className="py-1 bg-white text-center text-sm font-bold"
            key={day}
          >
            {day}
          </div>
        ))}
        {grid.flat().map((d, i) => {
          const inThisMonth = d.getMonth() === viewMonth;
          const isTodayCell = isToday(d);
          // All events for this day
          const dayEvents = sessions.filter(event =>
            event.start_time.toDateString() === d.toDateString()
          );
          const cellBg = isTodayCell ? "bg-primary/10" : "bg-white";
          const borderClass = isTodayCell ? "border-primary" : "border-transparent";
          const textColor = inThisMonth
            ? isTodayCell
              ? "text-primary font-bold"
              : "text-gray-900"
            : "text-muted-foreground";
          return (
            <button
              key={i}
              type="button"
              className={`relative flex flex-col items-center justify-start min-h-[58px] h-[58px] sm:min-h-[50px] sm:h-[50px] px-1 pb-1 border ${borderClass} ${cellBg} focus:z-10 focus:ring-2 outline-none`}
              style={{
                touchAction: "manipulation",
                borderWidth: isTodayCell ? 2 : 1,
                borderRadius: isTodayCell ? 8 : 0,
                cursor: inThisMonth ? "pointer" : "default",
                opacity: inThisMonth ? 1 : 0.6,
              }}
              disabled={!inThisMonth}
              tabIndex={inThisMonth ? 0 : -1}
              onClick={inThisMonth ? () => { onDayClick?.(d); } : undefined}
              aria-label={inThisMonth ? `View/add sessions on ${d.toDateString()}` : undefined}
            >
              <span
                className={`text-base mt-2 ${textColor}`}
                style={{ lineHeight: 1, fontSize: "16px" }}
              >
                {d.getDate()}
              </span>
              {dayEvents.length > 0 && (
                <span
                  className="mt-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5"
                  style={{
                    minWidth: 22,
                    minHeight: 22,
                  }}
                >
                  {dayEvents.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileMonthView;
