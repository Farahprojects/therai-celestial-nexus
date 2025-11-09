// @ts-nocheck
// Dynamically routes to correct LLM handler based on system config

import { getLLMHandler } from "../_shared/llmConfig.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle warmup request
    const warmupHeader = req.headers.get('X-Warmup');
    if (warmupHeader === '1') {
      console.log('[openai-whisper] 🔥 Warmup request received');
      return new Response(JSON.stringify({ status: 'warmed up' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Expect multipart/form-data with: file, chat_id, chattype, mode, language, voice
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const chat_id = (form.get('chat_id') as string) || undefined;
    const chattype = (form.get('chattype') as string) || undefined;
    const mode = form.get('mode') as string | null;
    const language = (form.get('language') as string) || 'en';
    const voice = (form.get('voice') as string) || undefined;

    if (!file) {
      throw new Error('Missing file in form-data');
    }

    if (!mode) {
      throw new Error('Missing mode in form-data');
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = new Uint8Array(arrayBuffer);
    const mimeType = file.type || 'audio/webm';

    console.log('[openai-whisper] 📥 RECEIVED:', {
      audioSize: audioBuffer.length,
      mode,
      chat_id,
      mimeType,
      voice
    });
    
    // Validate audio data
    if (!audioBuffer || audioBuffer.length === 0) {
      console.error('[openai-whisper] Empty audio buffer');
      throw new Error('Empty audio data - please try recording again');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create FormData for OpenAI Whisper API
    const formData = new FormData();
    
    // Create a Blob from the audio buffer with appropriate MIME type
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    
    // Determine appropriate file extension based on MIME type
    let filename = 'audio.webm';
    if (mimeType.includes('mp4')) {
      filename = 'audio.mp4';
    } else if (mimeType.includes('ogg')) {
      filename = 'audio.ogg';
    } else if (mimeType.includes('wav')) {
      filename = 'audio.wav';
    }
    
    // Log detailed audio info for debugging
    console.log('[openai-whisper] 🔍 AUDIO DETAILS:', {
      mimeType,
      filename,
      audioSize: audioBuffer.length,
      firstBytes: Array.from(audioBuffer.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    
    // Add file to FormData with correct filename
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('language', language || 'en');
    formData.append('response_format', 'json');

    // Call OpenAI Whisper API
    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[openai-whisper] OpenAI API error:', errorText);
      throw new Error(`OpenAI Whisper API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const transcript = result.text || '';

    console.log('[openai-whisper] 📤 OPENAI API RESPONSE:', {
      transcriptLength: transcript.length,
      transcript: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
      mode
    });

    // Handle empty transcription results
    if (!transcript || transcript.trim().length === 0) {
      console.log('[openai-whisper] ⚠️ Empty transcript - returning empty result');
      return new Response(
        JSON.stringify({ transcript: '' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For voice mode: Save user message and call LLM separately
    if (chattype === 'voice' && chat_id) {
      console.log('[openai-whisper] 🔄 VOICE MODE: Saving user message and calling LLM');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
      
      // Fire and forget: Save user message to chat-send
      fetch(`${supabaseUrl}/functions/v1/chat-send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id,
          text: transcript,
          client_msg_id: crypto.randomUUID(),
          chattype: 'voice',
          mode: mode
        })
      }).catch((error) => {
        console.error('[openai-whisper] ❌ User message save failed:', error);
      });

      // Check conversation mode - skip LLM handler for together mode (peer-to-peer chat)
      const supabaseClient = createClient(supabaseUrl!, supabaseKey!, {
        auth: { persistSession: false }
      });
      
      const { data: conv } = await supabaseClient
        .from('conversations')
        .select('mode')
        .eq('id', chat_id)
        .single();
      
      const conversationMode = conv?.mode || 'chat';
      
      if (conversationMode === 'together') {
        console.log('[openai-whisper] Together mode - skipping LLM handler for peer-to-peer chat');
        // Skip LLM handler call - transcript already saved
      } else {
        // Normal flow: call LLM handler
        getLLMHandler(supabaseUrl, supabaseKey).then((llmHandler) => {
          console.log(`[openai-whisper] Using ${llmHandler} for voice mode`);
          
          return fetch(`${supabaseUrl}/functions/v1/${llmHandler}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id,
              text: transcript,
              chattype: 'voice',
              mode: mode,
              voice
            })
          });
        }).catch((error) => {
          console.error('[openai-whisper] ❌ LLM call failed:', error);
        });
      }

      // Broadcast thinking-mode to WebSocket
      fetch(`${supabaseUrl}/functions/v1/broadcast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: `conversation:${chat_id}`,
          event: 'thinking-mode',
          payload: { transcript }
        })
      }).then(() => {
        console.log('[openai-whisper] ✅ thinking-mode broadcast sent');
      }).catch((error) => {
        console.error('[openai-whisper] ❌ thinking-mode broadcast failed:', error);
      });

      // For voice mode, return minimal response - client doesn't need transcript
      // Server-side flow (STT->LLM->TTS) handles everything via WebSocket
      console.log('[openai-whisper] ✅ SUCCESS: Voice mode - returning minimal response');
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For non-voice modes (transcription-only), return the transcript
    console.log('[openai-whisper] ✅ SUCCESS: Transcript received');
    return new Response(
      JSON.stringify({ transcript }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in openai-whisper function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
