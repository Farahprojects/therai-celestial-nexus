import React from "react";
import { CalendarSession } from "@/types/calendar";
import MonthView from "./views/MonthView";
import WeekView from "./views/WeekView";
import DayView from "./views/DayView";
import SessionCardsMobile from "./SessionCardsMobile";
import { MobileDaySelector } from "./MobileDaySelector";
import MobileMonthView from "./views/MobileMonthView";

type Props = {
  view: "month" | "week" | "day";
  date: Date;
  selectedDay?: Date;
  sessions: CalendarSession[];
  onSessionClick: (session: CalendarSession) => void;
  onMoveSession: (id: string, newStart: Date, newEnd: Date) => void;
  isMobile: boolean;
  setSelectedDay?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
};

export const CalendarView = ({
  view,
  date,
  selectedDay,
  sessions,
  onSessionClick,
  onMoveSession,
  isMobile,
  setSelectedDay,
  onDayClick,
}: Props) => {
  if (isMobile && view === "month") {
    // Mobile month view
    return (
      <MobileMonthView
        date={date}
        sessions={sessions}
        onSessionClick={onSessionClick}
        onDayClick={onDayClick}
      />
    );
  }
  if (isMobile && selectedDay && setSelectedDay) {
    // Mobile week view (existing)
    return (
      <div>
        <MobileDaySelector
          weekDate={date}
          selectedDay={selectedDay}
          onSelect={setSelectedDay}
          sessions={sessions}
        />
        <SessionCardsMobile
          sessions={sessions}
          onSessionClick={onSessionClick}
          selectedDay={selectedDay}
        />
      </div>
    );
  }
  if (view === "month")
    return <MonthView date={date} sessions={sessions} onSessionClick={onSessionClick} onDayClick={onDayClick} />;
  if (view === "week")
    return (
      <WeekView
        date={date}
        sessions={sessions}
        onSessionClick={onSessionClick}
        onMoveSession={onMoveSession}
      />
    );
  return (
    <DayView
      date={date}
      sessions={sessions}
      onSessionClick={onSessionClick}
      onMoveSession={onMoveSession}
    />
  );
};
export default CalendarView;
