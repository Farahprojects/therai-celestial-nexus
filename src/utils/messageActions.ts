import { supabase } from "@/integrations/supabase/client";
import type { EmailMessage } from "@/types/email";
import type { ToastOptions } from "@/utils/notifications";
import { showToast } from "@/utils/notifications";

/**
 * Star/unstar a message in Supabase.
 */
export async function toggleStarMessage(
  message: EmailMessage,
  toast?: (message: ToastOptions) => void
): Promise<void> {
  const { error } = await supabase
    .from("email_messages")
    .update({ is_starred: !message.is_starred })
    .eq("id", message.id);

  if (error) {
    const errorToast = { title: "Error", description: "Could not update star.", variant: "destructive" as const };
    if (toast) toast(errorToast);
    else showToast(errorToast);
    throw error;
  }
  const successToast = { title: message.is_starred ? "Unstarred" : "Starred", description: "Star status updated.", variant: "default" as const };
  if (toast) toast(successToast);
  else showToast(successToast);
}

/**
 * Archive messages by setting is_archived true in Supabase.
 */
export async function archiveMessages(
  messageIds: string[],
  toast?: (message: ToastOptions) => void
): Promise<void> {
  const { error } = await supabase.from("email_messages")
    .update({ is_archived: true })
    .in("id", messageIds);

  if (error) {
    const errorToast = { title: "Error", description: "Could not archive messages.", variant: "destructive" as const };
    if (toast) toast(errorToast);
    else showToast(errorToast);
    throw error;
  }
  const successToast = { title: "Archive", description: "Message archived." };
  if (toast) toast(successToast);
  else showToast(successToast);
}

/**
 * Delete messages from Supabase.
 */
export async function deleteMessages(
  messageIds: string[],
  toast?: (message: ToastOptions) => void
): Promise<void> {
  const { error } = await supabase.from("email_messages").delete().in("id", messageIds);

  if (error) {
    const errorToast = { title: "Error", description: "Could not delete messages.", variant: "destructive" as const };
    if (toast) toast(errorToast);
    else showToast(errorToast);
    throw error;
  }
  const successToast = { title: "Deleted", description: "Message(s) deleted.", variant: "success" as const };
  if (toast) toast(successToast);
  else showToast(successToast);
}

/**
 * Mark a message as read (single message).
 */
export async function markMessageRead(
  messageId: string
): Promise<void> {
  await supabase.from("email_messages")
    .update({ is_read: true })
    .eq("id", messageId);
}
