// src/services/voice/stt.ts
import { supabase } from '@/integrations/supabase/client';
import { useChatStore } from '@/core/store';

class SttService {
  async transcribe(audioBlob: Blob, chat_id?: string, meta?: Record<string, any>, chattype?: string, mode?: string, user_id?: string, user_name?: string): Promise<{ transcript: string }> {
    
    // Validate audio blob before processing
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('[STT] Empty or missing audio blob, skipping transcription');
      throw new Error('Empty audio recording - please try speaking again');
    }
    
    if (audioBlob.size < 500) {
      console.warn('[STT] Audio blob too small:', audioBlob.size, 'bytes');
      throw new Error('Recording too short - please speak for longer');
    }
    
    if (audioBlob.size < 100) {
      console.error(`[STT] Audio blob too small (${audioBlob.size} bytes) - likely empty`);
      throw new Error(`Audio blob too small (${audioBlob.size} bytes). Expected at least 100 bytes.`);
    }

    // Send multipart/form-data with minimal fields
    const form = new FormData();
    const selectedVoice = useChatStore.getState().ttsVoice || 'Puck';
    form.append('file', audioBlob, 'audio');
    if (chat_id) form.append('chat_id', chat_id);
    if (chattype) form.append('chattype', chattype);
    if (selectedVoice) form.append('voice', selectedVoice);
    if (mode) form.append('mode', mode);
    if (user_id) form.append('user_id', user_id);
    if (user_name) form.append('user_name', user_name);
    form.append('language', 'en');

    const { data, error } = await supabase.functions.invoke('google-whisper', {
      body: form
    });

    // Handle HTTP errors - including 403 for limit exceeded
    if (error) {
      console.error('[STT] Google Whisper HTTP error:', error);
      console.log('[STT] Error data:', data); // Debug log
      
      // FunctionsHttpError has a context property with status
      const status = (error as any)?.context?.status;
      
      if (status === 403) {
        // Limit exceeded - extract message from data or error
        const errorMsg = data?.error || error.message || 'Voice limit reached. Upgrade to Premium for unlimited voice features.';
        console.log('[STT] 403 error message:', errorMsg);
        throw new Error(errorMsg);
      }
      
      throw new Error(`Error invoking google-whisper: ${error.message}`);
    }

    if (!data) {
      console.error('[STT] No data in response');
      throw new Error('No data received from Google Whisper');
    }

    // Success - return transcript
    return {
      transcript: data.transcript || '',
    };
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const sttService = new SttService();
