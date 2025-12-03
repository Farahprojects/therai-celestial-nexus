// src/services/voice/stt.ts
import { supabase } from '@/integrations/supabase/client';
import { useChatStore } from '@/core/store';
import { STTLimitExceededError } from './stt-errors';
import { safeConsoleError } from '@/utils/safe-logging';
class SttService {
  async transcribe(audioBlob: Blob, chat_id?: string, meta?: Record<string, unknown>, chattype?: string, mode?: string, user_id?: string, user_name?: string): Promise<{ transcript: string }> {
    
    // Validate audio blob before processing
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('[STT] Empty or missing audio blob, skipping transcription');
      throw new Error('Empty audio recording - please try speaking again');
    }
    
    if (audioBlob.size < 500) { // Reduced from 1KB to 500 bytes for testing
      console.warn('[STT] Audio blob too small:', audioBlob.size, 'bytes');
      throw new Error('Recording too short - please speak for longer');
    }
    
    // Google STT V2: Simplified validation - just check size
    if (audioBlob.size < 100) {
      console.error(`[STT] Audio blob too small (${audioBlob.size} bytes) - likely empty`);
      throw new Error(`Audio blob too small (${audioBlob.size} bytes). Expected at least 100 bytes.`);
    }
    
    // OpenAI Whisper: Log simplified payload

    // OpenAI Whisper: Send multipart/form-data with minimal fields
    const form = new FormData();
    const selectedVoice = useChatStore.getState().ttsVoice || 'Puck';
    // Pass selected voice from store to backend for voice mode
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

    // Handle network/HTTP errors (actual failures)
    if (error) {
      safeConsoleError('[STT] Google Whisper HTTP error:', error);
      throw new Error(`Error invoking google-whisper: ${error.message}`);
    }

    if (!data) {
      console.error('[STT] No data in response');
      throw new Error('No data received from Google Whisper');
    }

    // Check structured response for success flag
    if (data.success === false) {
      // Handle limit exceeded error
      if (data.code === 'STT_LIMIT_EXCEEDED') {
        throw new STTLimitExceededError(
          data.message || 'STT usage limit exceeded',
          data.code,
          data.current_usage || 0,
          data.limit || 120,
          data.remaining || 0
        );
      }
      
      // Handle other error codes
      throw new Error(data.message || `STT error: ${data.code || 'UNKNOWN'}`);
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
