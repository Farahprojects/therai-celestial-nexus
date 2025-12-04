
import { CalendarSession } from "@/types/calendar";
import { EventCard } from "../EventCard";

const TIMEBLOCKS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8:00–20:00

type Props = {
  date: Date;
  sessions: CalendarSession[];
  onSessionClick: (session: CalendarSession) => void;
  onMoveSession: (id: string, newStart: Date, newEnd: Date) => void;
};


const DayView = ({ date, sessions, onSessionClick }: Props) => {
  const slotHeight = 40;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white hover:shadow-md transition-all duration-200">
      <div className="flex flex-col min-h-[400px] relative">
        {TIMEBLOCKS.map((hr, index) => {
          const events = sessions.filter(
            (sess) =>
              sess.start_time.getHours() === hr &&
              sess.start_time.toDateString() === date.toDateString()
          );

          return (
            <div
              key={hr}
              className={`flex items-stretch gap-1 px-4 py-2 bg-white relative ${
                index < TIMEBLOCKS.length - 1 ? 'border-b border-gray-100' : ''
              }`}
              style={{ minHeight: slotHeight }}
            >
              <div className="w-16 flex items-center text-xs text-muted-foreground font-bold h-full">
                {`${hr}:00`}
              </div>

              <div className="flex-1 flex flex-row gap-2 overflow-x-auto items-stretch min-h-0">
                {events.length > 0
                  ? events.map((sess) => (
                      <div
                        className="flex-1 min-w-[240px] max-w-full"
                        key={sess.id}
                        style={{ display: "flex", alignItems: "stretch" }}
                      >
                        <EventCard
                          session={sess}
                          onClick={() => onSessionClick(sess)}
                          isDetailed={true}
                          compact={true}
                        />
                      </div>
                    ))
                  : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayView;
