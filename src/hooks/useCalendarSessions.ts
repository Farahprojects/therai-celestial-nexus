
import { useState, useEffect } from "react";
import { CalendarSession } from "@/types/calendar";
import { calendarSessionsService } from "@/services/calendarSessions";

// Hook for CRUD calendar sessions from Supabase
export function useCalendarSessions() {
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setLoading(true);
    try {
      const data = await calendarSessionsService.getSessions();
      setSessions(data);
    } catch (e) {
      console.error("Failed to load calendar sessions", e);
    } finally {
      setLoading(false);
    }
  }

  async function createSession(event: Omit<CalendarSession, "id">) {
    try {
      const newSession = await calendarSessionsService.createSession(event);
      setSessions((prev) => [...prev, newSession]);
    } catch (e) {
      console.error("Failed to create calendar session", e);
    }
  }

  async function updateSession(id: string, updates: Partial<CalendarSession>) {
    try {
      const updated = await calendarSessionsService.updateSession(id, updates);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? updated : s))
      );
    } catch (e) {
      console.error("Failed to update calendar session", e);
    }
  }

  async function deleteSession(id: string) {
    try {
      await calendarSessionsService.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error("Failed to delete calendar session", e);
    }
  }

  // For drag-and-drop, etc.
  function moveSession(id: string, newStart: Date, newEnd: Date) {
    updateSession(id, { start_time: newStart, end_time: newEnd });
  }

  return {
    sessions,
    loading,
    createSession,
    updateSession,
    deleteSession,
    moveSession,
    fetchSessions,
  };
}
