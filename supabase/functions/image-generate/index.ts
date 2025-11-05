// @ts-nocheck - Deno runtime, types checked at deployment
// Image generation edge function using Google Imagen
// - Rate limiting: 3 images per user per 24 hours
// - Uses @google/genai SDK (Imagen not available via REST API)
// - Uploads to Supabase Storage
// - Creates message with image metadata

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

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

  console.info(JSON.stringify({
    event: "image_generate_request_received",
    request_id: requestId,
    method: req.method
  }));

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

  const { chat_id, prompt, user_id, mode } = body || {};

  if (!chat_id || typeof chat_id !== "string") {
    return json(400, { error: "Missing or invalid field: chat_id" });
  }
  if (!prompt || typeof prompt !== "string") {
    return json(400, { error: "Missing or invalid field: prompt" });
  }
  if (!user_id || typeof user_id !== "string") {
    return json(400, { error: "Missing or invalid field: user_id" });
  }

  console.info(JSON.stringify({
    event: "image_generate_processing",
    request_id: requestId,
    chat_id,
    user_id,
    prompt_length: prompt.length
  }));

  // Rate limiting: 3 images per user per 24 hours (cost control for $10 subscription)
  const { count, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .eq('meta->>message_type', 'image');

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
    console.info(JSON.stringify({
      event: "image_generate_api_call_start",
      request_id: requestId,
      model: IMAGEN_MODEL,
      method: "SDK (@google/genai)"
    }));

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

    console.info(JSON.stringify({
      event: "image_generate_api_success",
      request_id: requestId,
      duration_ms: Date.now() - generationStartTime
    }));
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

  // Upload to Storage
  const timestamp = Date.now();
  const fileName = `${timestamp}-${crypto.randomUUID()}.png`;
  const filePath = `${user_id}/${fileName}`;

  console.info(JSON.stringify({
    event: "image_generate_upload_start",
    request_id: requestId,
    file_path: filePath
  }));

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

  // Create message with image meta
  const messageData = {
    chat_id,
    role: 'assistant',
    status: 'complete', // Required field - message is complete when image is generated
    mode: mode || 'chat',
    user_id,
    client_msg_id: crypto.randomUUID(),
    meta: {
      message_type: 'image',
      image_url: publicUrl,
      image_path: filePath,
      image_model: 'imagen-4.0-fast-generate-001',
      image_size: '1024x1024',
      generation_time_ms: generationTime,
      cost_usd: 0.04 // Cost per image (may vary based on model)
    }
  };

  const { data: insertedMessage, error: messageError } = await supabase
    .from('messages')
    .insert([messageData])
    .select()
    .single();

  if (messageError) {
    console.error(JSON.stringify({
      event: "image_generate_message_insert_failed",
      request_id: requestId,
      error: messageError.message
    }));
    // Image is uploaded but message failed - this is problematic but we'll return success
    // The image exists in storage but won't show in chat
    return json(500, { error: `Message insert failed: ${messageError.message}` });
  }

  console.info(JSON.stringify({
    event: "image_generate_complete",
    request_id: requestId,
    total_duration_ms: Date.now() - startTime,
    generation_time_ms: generationTime,
    file_path: filePath,
    message_id: insertedMessage?.id
  }));

  return json(200, {
    success: true,
    image_url: publicUrl,
    image_path: filePath
  });
});

