
import React from "react";
import { CalendarSession } from "@/types/calendar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EventCard } from "./EventCard";

// Props
type Props = {
  open: boolean;
  onClose: () => void;
  date: Date;
  sessions: CalendarSession[];
  clients: { id: string; name: string }[];
  isMobile: boolean;
  onEditSession: (session: CalendarSession) => void;
  onAddSession: () => void;
};

export const DaySessionsModal: React.FC<Props> = ({
  open,
  onClose,
  date,
  sessions,
  clients,
  isMobile,
  onEditSession,
  onAddSession,
}: Props) => {
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Get client name for each session
  const clientMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c: { id: string; name: string }) => (map[c.id] = c.name));
    return map;
  }, [clients]);

  const modalContent = (
    <div className="flex flex-col gap-4 p-4 pb-2 h-full max-h-[85dvh] w-full">
      <h2 className="text-lg font-semibold mb-1">{dateStr}</h2>
      {sessions.length ? (
        <div className="flex flex-col gap-3">
          {sessions.map((session: CalendarSession) => (
            <div key={session.id}>
              <EventCard
                session={session}
                clientName={session.client_id ? clientMap[session.client_id] : undefined}
                compact
                isDetailed={false}
                onClick={() => onEditSession(session)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No sessions scheduled for this day.
        </div>
      )}
      <Button
        type="button"
        className="mt-4"
        onClick={onAddSession}
      >
        Add Session
      </Button>
    </div>
  );

  // Mobile: sheet, Desktop: dialog
  if (isMobile) {
    return (
        <Sheet open={open} onOpenChange={(v: boolean) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="!max-w-full !w-screen h-[80dvh] p-0 flex flex-col"
        >
          {modalContent}
        </SheetContent>
      </Sheet>
    );
  }
  // Desktop
  return (
      <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-md">{modalContent}</DialogContent>
    </Dialog>
  );
};
