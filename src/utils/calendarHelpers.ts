
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
  const row = s as Record<string, unknown>;
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    start_time: new Date(row.start_time as string),
    end_time: new Date(row.end_time as string),
    client_id: (row.client_id as string) ?? undefined,
    event_type: (row.event_type as string ?? "session") as EventType,
    color_tag: (row.color_tag as string) ?? undefined,
  };
}
