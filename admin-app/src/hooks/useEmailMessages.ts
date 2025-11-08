import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { EmailMessage } from '../types/email';

interface RawEmailMessage {
  id: string;
  subject: string | null;
  body: string | null;
  from_address: string;
  to_address: string;
  direction: string;
  created_at: string;
  client_id?: string;
  sent_via: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
}

async function fetchEmailMessages(): Promise<EmailMessage[]> {
  const { data, error } = await supabase.functions.invoke('admin-email-messages', {
    body: { limit: 200, order: 'desc' },
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch email messages');
  }

  const messages = (data?.data ?? []) as RawEmailMessage[];

  return messages.map((message) => ({
    id: message.id,
    subject: message.subject || '',
    body: message.body || '',
    from_address: message.from_address,
    to_address: message.to_address,
    direction: message.direction as 'incoming' | 'outgoing',
    created_at: message.created_at,
    client_id: message.client_id,
    sent_via: message.sent_via || 'email',
    is_read: message.is_read ?? false,
    is_starred: message.is_starred ?? false,
    is_archived: message.is_archived ?? false,
  } as EmailMessage));
}

export function useEmailMessages() {
  return useQuery({
    queryKey: ['admin-email-messages'],
    queryFn: fetchEmailMessages,
    staleTime: 60 * 1000,
  });
}

export function useEmailMessageStats(messages: EmailMessage[]) {
  return useMemo(() => {
    const inbound = messages.filter((message) => message.direction === 'incoming').length;
    const outbound = messages.filter((message) => message.direction === 'outgoing').length;
    const unread = messages.filter((message) => !message.is_read && message.direction === 'incoming').length;

    return {
      total: messages.length,
      inbound,
      outbound,
      unread,
    };
  }, [messages]);
}
