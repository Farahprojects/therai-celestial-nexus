
/**
 * Shared calendar/session helpers.
 */

import { CalendarSession, EventType } from "@/types/calendar";

/**
 * Determines if two dates are on the same calendar day.
 */
export function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/**
 * Sorts CalendarSessions by their start_time ascending.
 */
export function sortByTime(a: CalendarSession, b: CalendarSession) {
  return a.start_time.getTime() - b.start_time.getTime();
}

/**
 * Safely map a DB row to a CalendarSession object.
 */
export function mapRowToCalendarSession(s: unknown): CalendarSession {
  return {
    id: s.id,
    title: s.title,
    description: s.description ?? "",
    start_time: new Date(s.start_time),
    end_time: new Date(s.end_time),
    client_id: s.client_id ?? undefined,
    event_type: (s.event_type ?? "session") as EventType,
    color_tag: s.color_tag ?? undefined,
  };
}
