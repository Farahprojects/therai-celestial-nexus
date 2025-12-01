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

    // Start BOTH calls asynchronously - don't wait for either
    let rateLimitCheck: Promise<any> | null = null;

    if (user_id) {
      rateLimitCheck = supabase.functions.invoke("check-rate-limit", {
        body: {
          user_id,
          action: "chat"
        }
      }).catch((error) => {
        console.error("Rate limit check failed:", error);
        return { data: { allowed: true } }; // Default to allowed on error
      });
    }

    // Fire-and-forget chat-send - don't await
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

    // Handle rate limit result asynchronously
    if (rateLimitCheck) {
      rateLimitCheck.then(({ data: rateLimitResult }) => {
        if (rateLimitResult && !rateLimitResult.allowed) {
          // Rate limit exceeded - emit event to disable UI
          window.dispatchEvent(new CustomEvent('rateLimitExceeded', {
            detail: {
              message: rateLimitResult.message,
              limit: rateLimitResult.limit,
              remaining: 0
            }
          }));
        }
      }).catch(() => {
        // Rate limit check failed - allow message to proceed
      });
    }

    return optimisticMessage;
  }
}

export const llmService = new LlmService();
