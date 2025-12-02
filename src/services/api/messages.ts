// src/services/api/messages.ts
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/core/types';

export const appendMessage = async (message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> => {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: message.chat_id,
      role: message.role,
      text: message.text,
      // audio_url removed
      // timings removed
      meta: message.meta,
      client_msg_id: message.client_msg_id,
      status: message.status
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  // Map back to client interface
  return {
    id: data.id,
    chat_id: data.chat_id,
    role: data.role as Message['role'],
    text: data.text,
    // audioUrl removed
    // timings removed
    createdAt: data.created_at,
    meta: (data.meta as Record<string, unknown>) || {},
    client_msg_id: data.client_msg_id,
    status: (data.status as Message['status']) || 'complete'
  } as Message;
};

export const updateMessage = async (id: string, updates: Partial<Message>): Promise<Message> => {
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  return {
    id: data.id,
    chat_id: data.chat_id,
    role: data.role as Message['role'],
    text: data.text,
    createdAt: data.created_at,
    meta: (data.meta as Record<string, unknown>) || {},
    client_msg_id: data.client_msg_id,
    status: (data.status as Message['status']) || 'complete'
  } as Message;
};
