// src/services/llm/chat.ts
// Fail-fast, single-call, no fallbacks. Always passes a client_msg_id for idempotency.

import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/core/types";

type SendMessageParams = {
chat_id: string;
text: string;
mode: string; // required by backend
chattype?: string; // e.g., "voice" or "text"
client_msg_id?: string;
user_id?: string;
user_name?: string;
};

class LlmService {
  async sendMessage(params: SendMessageParams): Promise<Message> {
    const { chat_id, text, mode, chattype, user_id, user_name } = params;

    if (!chat_id || typeof chat_id !== "string") {
      throw new Error("sendMessage: missing or invalid chat_id");
    }
    if (!text || typeof text !== "string") {
      throw new Error("sendMessage: missing or invalid text");
    }
    if (!mode || typeof mode !== "string") {
      throw new Error("sendMessage: missing or invalid mode");
    }

    const client_msg_id = params.client_msg_id ?? crypto.randomUUID();

    // Fire-and-forget chat-send - rate limiting handled by backend
    supabase.functions.invoke("chat-send", {
      body: {
        chat_id,
        text,
        mode,
        chattype,
        client_msg_id,
        user_id,
        user_name
      }
    }).catch((error) => {
      console.error(`sendMessage: chat-send failed - ${error.message || "unknown error"}`);
    });

    // Return optimistic message immediately - UI updates right away
    const optimisticMessage = {
      id: client_msg_id,
      chat_id,
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      status: "thinking",
      client_msg_id,
      mode,
      user_id,
      user_name
    } as unknown as Message;

    return optimisticMessage;
  }
}

export const llmService = new LlmService();
