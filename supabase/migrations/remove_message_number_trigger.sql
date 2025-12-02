-- Remove the assign_message_number trigger and related functions
DROP TRIGGER IF EXISTS trigger_assign_message_number ON public.messages;
DROP FUNCTION IF EXISTS public.assign_message_number();
DROP FUNCTION IF EXISTS public.get_next_message_number(uuid);

-- Also remove the unique constraint on message_number since we're not using it for UI
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS unique_chat_message_number;
