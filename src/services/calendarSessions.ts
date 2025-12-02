
import { supabase } from "@/integrations/supabase/client";
import { CalendarSession } from "@/types/calendar";
import { mapRowToCalendarSession } from "@/utils/calendarHelpers";

// Helper to get current user ID
const getCurrentUserId = () => supabase.auth.getUser().then(res => res.data.user?.id || null);

// Service for CRUD calendar sessions
export const calendarSessionsService = {
  async getSessions(): Promise<CalendarSession[]> {
    const { data, error } = await supabase
      .from("calendar_sessions")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    // Convert ISO date strings to JS Date objects, handle nullables/types
    return (data || []).map(mapRowToCalendarSession);
  },

  async createSession(session: Omit<CalendarSession, "id">) {
    // Get coach_id before insert (auth required!)
    const coach_id = await getCurrentUserId();
    if (!coach_id) {
      throw new Error("User not authenticated (coach_id missing)");
    }
    // Convert Date to ISO strings for insert
    const payload: Record<string, unknown> = {
      ...session,
      start_time: session.start_time.toISOString(),
      end_time: session.end_time.toISOString(),
      client_id: session.client_id || null,
      color_tag: session.color_tag || null,
      event_type: session.event_type ?? "session",
      coach_id, // Required for DB insert and RLS
    };
    delete payload.id;

    const { data, error } = await supabase
      .from("calendar_sessions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Supabase error: ", error);
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Failed to create calendar session (no data returned)');
    }
    return mapRowToCalendarSession(data);
  },

  async updateSession(id: string, updates: Partial<CalendarSession>) {
    // Convert any Dates to ISO for start_time/end_time
    const payload: Record<string, unknown> = { ...updates };
    if (payload.start_time instanceof Date)
      payload.start_time = payload.start_time.toISOString();
    if (payload.end_time instanceof Date)
      payload.end_time = payload.end_time.toISOString();

    // Remove id, coach_id from the payload (for RLS)
    delete payload.id;
    delete payload.coach_id;

    const { data, error } = await supabase
      .from("calendar_sessions")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToCalendarSession(data);
  },

  async deleteSession(id: string) {
    const { error } = await supabase
      .from("calendar_sessions")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
};
