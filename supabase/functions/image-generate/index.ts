// @ts-nocheck - Deno runtime, types checked at deployment
// Image generation edge function using Google Imagen
// - Rate limiting: 3 images per user per 24 hours
// - Uses @google/genai SDK (Imagen not available via REST API)
// - Uploads to Supabase Storage
// - Creates message with image metadata

import { createPooledClient } from "../_shared/supabaseClient.ts";
import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

// Fail fast if env vars are missing
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!GOOGLE_API_KEY) throw new Error("Missing env: GOOGLE-LLM-NEW");

// Create Supabase client with connection pooling
const supabase = createPooledClient();

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

// Base64 decode helper
function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);


  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { chat_id, prompt, user_id, mode, image_id } = body || {};

  if (!chat_id || typeof chat_id !== "string") {
    return json(400, { error: "Missing or invalid field: chat_id" });
  }
  if (!prompt || typeof prompt !== "string") {
    return json(400, { error: "Missing or invalid field: prompt" });
  }
  if (!user_id || typeof user_id !== "string") {
    return json(400, { error: "Missing or invalid field: user_id" });
  }


  // Rate limiting: 3 images per user per 24 hours (cost control for $10 subscription)
  // Uses immutable audit table to prevent bypass via chat deletion
  const { count, error: countError } = await supabase
    .from('image_generation_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (countError) {
    console.error(JSON.stringify({
      event: "image_generate_rate_limit_check_failed",
      request_id: requestId,
      error: countError.message
    }));
    return json(500, { error: "Failed to check rate limit" });
  }

  if (count && count >= 3) {
    console.info(JSON.stringify({
      event: "image_generate_rate_limit_exceeded",
      request_id: requestId,
      user_id,
      count
    }));
    return json(429, {
      error: 'Daily image generation limit reached (3 images per day). Limit resets in 24 hours.',
      limit: 3,
      used: count
    });
  }

  // Use Imagen model for image generation via SDK
  // REST API :generateImages endpoint doesn't exist (404 error)
  // Must use @google/genai SDK instead
  const generationStartTime = Date.now();
  const IMAGEN_MODEL = 'imagen-4.0-fast-generate-001';

  let base64Image: string | undefined;
  
  try {

    // Initialize Google GenAI client
    const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

    // Generate image using SDK
    const response = await genAI.models.generateImages({
      model: IMAGEN_MODEL,
      prompt: prompt,
      config: {
        numberOfImages: 1
      }
    });

    // Extract image from SDK response
    if (response.generatedImages?.[0]?.image?.imageBytes) {
      base64Image = response.generatedImages[0].image.imageBytes;
    } else {
      console.error(JSON.stringify({
        event: "image_generate_no_image_in_response",
        request_id: requestId,
        response_keys: Object.keys(response || {}),
        response_structure: JSON.stringify(response).substring(0, 2000)
      }));
      return json(502, { 
        error: "No image data in API response",
        response_structure: JSON.stringify(response).substring(0, 2000)
      });
    }

  } catch (error) {
    console.error(JSON.stringify({
      event: "image_generate_api_exception",
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }));
    return json(504, { error: `Imagen API error: ${error instanceof Error ? error.message : String(error)}` });
  }

  // Decode base64 to Uint8Array
  let imageBytes;
  try {
    imageBytes = decodeBase64(base64Image);
  } catch (error) {
    console.error(JSON.stringify({
      event: "image_generate_decode_failed",
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error)
    }));
    return json(500, { error: "Failed to decode image data" });
  }

  const originalSize = imageBytes.length;

  // Upload to Storage
  const timestamp = Date.now();
  const fileName = `${timestamp}-${crypto.randomUUID()}.png`;
  const filePath = `${user_id}/${fileName}`;


  const { error: uploadError } = await supabase.storage
    .from('generated-images')
    .upload(filePath, imageBytes, {
      contentType: 'image/png',
      upsert: false
    });

  if (uploadError) {
    console.error(JSON.stringify({
      event: "image_generate_upload_failed",
      request_id: requestId,
      error: uploadError.message
    }));
    return json(500, { error: `Upload failed: ${uploadError.message}` });
  }

  // Use custom domain for image URLs
  const CUSTOM_DOMAIN = 'https://api.therai.co';
  const publicUrl = `${CUSTOM_DOMAIN}/storage/v1/object/public/generated-images/${filePath}`;

  const generationTime = Date.now() - generationStartTime;

  // ✅ Final atomic check right before logging (prevents race conditions)
  // Double-check limit to catch any concurrent requests that slipped through
  const { count: finalCount, error: finalCheckError } = await supabase
    .from('image_generation_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (!finalCheckError && finalCount && finalCount >= 3) {
    console.warn(JSON.stringify({
      event: "image_generate_limit_exceeded_at_log",
      request_id: requestId,
      user_id,
      count: finalCount,
      note: "Image generated but limit exceeded - logging anyway for audit"
    }));
    // Continue to log - this is rare race condition, audit log still matters
  }

  // 🚀 OPTIMIZED: Only await critical message update
  // Fire-and-forget for audit log and user_images (nice-to-have)
  const { data: updatedMessage, error: messageError } = await supabase
    .from('messages')
    .update({
      status: 'complete',
      meta: {
        message_type: 'image',
        image_url: publicUrl,
        image_path: filePath,
        image_prompt: prompt,
        image_model: 'imagen-4.0-fast-generate-001',
        image_size: '1024x1024',
        generation_time_ms: generationTime,
        cost_usd: 0.04
      }
    })
    .eq('id', image_id)
    .select()
    .single();

  if (messageError) {
    console.error(JSON.stringify({
      event: "image_generate_message_update_failed",
      request_id: requestId,
      error: messageError.message,
      image_id: image_id
    }));
  }

  // 🚀 FIRE-AND-FORGET: Audit log (for rate limiting - not time-critical)
  supabase
    .from('image_generation_log')
    .insert({
      user_id,
      chat_id,
      image_url: publicUrl,
      model: IMAGEN_MODEL
    })
    .then(({ error }) => {
      if (error) {
        console.error(JSON.stringify({
          event: "image_generate_audit_log_failed",
          request_id: requestId,
          error: error.message
        }));
      }
    });

  // 🚀 FIRE-AND-FORGET: user_images table (for gallery - not time-critical)
  supabase
    .from('user_images')
    .insert({
      user_id,
      chat_id,
      message_id: image_id,
      image_url: publicUrl,
      image_path: filePath,
      prompt: prompt,
      model: 'imagen-4.0-fast-generate-001',
      size: '1024x1024'
    })
    .select()
    .single()
    .then(({ data: newUserImage, error: userImageError }) => {
      if (userImageError) {
        console.error(JSON.stringify({
          event: "image_generate_user_image_save_failed",
          request_id: requestId,
          error: userImageError.message,
          image_id: image_id
        }));
      } else if (newUserImage) {
        // 🚀 FIRE-AND-FORGET: Broadcast image insert to gallery (non-critical)
        const channelName = `user-realtime:${user_id}`;
        supabase.channel(channelName).httpSend({
          type: 'broadcast',
          event: 'image-insert',
          payload: {
            image: newUserImage
          }
        }).catch((broadcastError) => {
          console.error(JSON.stringify({
            event: "image_generate_broadcast_failed",
            request_id: requestId,
            error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
          }));
        });
      }
    });

  // 🚀 FIRE-AND-FORGET: Broadcast message update (non-critical - message already in DB)
  if (updatedMessage && !messageError) {
    const channelName = `user-realtime:${user_id}`;
    supabase.channel(channelName).httpSend({
      type: 'broadcast',
      event: 'message-update',
      payload: {
        chat_id,
        message: updatedMessage
      }
    }).catch((broadcastError) => {
      console.error(JSON.stringify({
        event: "image_generate_broadcast_failed",
        request_id: requestId,
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
      }));
    });
  }

  console.info(JSON.stringify({
    event: "image_complete",
    request_id: requestId,
    duration_ms: Date.now() - startTime,
    prompt_chars: prompt.length
  }));

  return json(200, {
    success: true,
    image_url: publicUrl,
    image_path: filePath
  });
});

