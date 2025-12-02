//
import { EventType } from "@/types/calendar";

// Limited to 5 official color hex codes for dot selector
export const COLOR_OPTIONS = [
  "#2563eb", // blue (blue-600)
  "#eab308", // yellow (yellow-500)
  "#22c55e", // green (green-500)
  "#ef4444", // red (red-500)
  "#6951f3", // purple (theme primary)
];

// Allowed event types
export const EVENT_TYPES: { label: string, value: EventType }[] = [
  { label: "Session", value: "session" },
  { label: "Check-in", value: "check-in" },
  { label: "Task", value: "task" },
  { label: "Other", value: "other" },
];

