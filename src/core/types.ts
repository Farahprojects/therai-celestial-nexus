import { Database, Json } from '@/integrations/supabase/types';

export type ProviderName = 'openai' | 'google' | 'deepgram' | 'elevenlabs' | 'local';

export type MessageRole = 'user' | 'assistant' | 'system';

// Database message type - 100% aligned with Supabase schema
export type DbMessage = Database['public']['Tables']['messages']['Row'];

// Extended message type with UI-only fields
export interface Message {
  // Required DB fields
  id: string;
  chat_id: string;
  role: string;
  text: string;
  status: string;
  createdAt: string; // maps to created_at
  
  // Optional DB fields
  client_msg_id?: string;
  context_injected?: boolean;
  message_number?: number;
  mode?: string;
  user_id?: string;
  user_name?: string;
  meta?: Json | null; // typed from Json
  
  // UI-only fields (not in DB)
  pending?: boolean; // Optimistic message flag
  tempId?: string; // Temporary ID for reconciliation
  source?: 'websocket' | 'fetch'; // Message source for animation logic
}

// Database conversation type - 100% aligned with Supabase schema
export type DbConversation = Database['public']['Tables']['conversations']['Row'];

// Extended conversation type with UI-only fields
export interface Conversation {
  // Required DB fields
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  
  // Optional DB fields
  title?: string | null;
  mode?: string | null;
  folder_id?: string | null;
  is_public?: boolean | null;
  owner_user_id?: string | null;
  meta?: Json | null; // typed from Json
  
  // UI-only fields (not in DB)
  messages?: Message[]; // Loaded separately, not a DB column
}
