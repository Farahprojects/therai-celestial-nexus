
export type EventType = "session" | "check-in" | "task" | "other";

export interface CalendarSession {
  id: string;
  title: string;
  description: string;
  start_time: Date;
  end_time: Date;
  client_id?: string;
  event_type?: EventType;
  color_tag?: string; // hex string or tag id
}
