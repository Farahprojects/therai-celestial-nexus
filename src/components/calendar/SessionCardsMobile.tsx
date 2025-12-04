
import { CalendarSession } from "@/types/calendar";
import { EventCard } from "./EventCard";
import { isSameDay, sortByTime } from "@/utils/calendarHelpers";

type Props = {
  sessions: CalendarSession[];
  onSessionClick: (session: CalendarSession) => void;
  selectedDay: Date;
};

const SessionCardsMobile = ({
  sessions,
  onSessionClick,
  selectedDay,
}: Props) => {
  const filtered = sessions.filter(s => isSameDay(s.start_time, selectedDay));
  return (
    <div className="flex flex-col gap-2">
      {filtered.sort(sortByTime).map(session => (
        <EventCard
          key={session.id}
          session={session}
          isDetailed
          onClick={() => onSessionClick(session)}
        />
      ))}
      {filtered.length === 0 && (
        <p className="text-center py-8">No sessions for this day.</p>
      )}
    </div>
  );
};

export default SessionCardsMobile;
