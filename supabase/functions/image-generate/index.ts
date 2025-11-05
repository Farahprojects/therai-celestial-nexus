// @ts-nocheck - Deno runtime, types checked at deployment
// Image generation edge function using Google Imagen 4 Standard
// - Rate limiting: 3 images per user per 24 hours
// - Calls Google Imagen 4 API via Gemini endpoint
// - Uploads to Supabase Storage
// - Creates message with image metadata

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Use Imagen model for image generation (as recommended)
  // Try imagen-3 first (cost-effective), fallback to imagen-4.0-generate-001 if needed
  const generationStartTime = Date.now();
  const IMAGEN_MODEL = 'imagen-3'; // Cost-effective option, or use 'imagen-4.0-generate-001' for latest
  // Use generateImages endpoint (not generateContent) for Imagen models
  const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateImages`;

  let imageData;
  try {
    console.info(JSON.stringify({
      event: "image_generate_api_call_start",
      request_id: requestId
    }));

    const response = await fetch(imagenUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GOOGLE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        config: {
          numberOfImages: 1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(JSON.stringify({
        event: "image_generate_api_failed",
        request_id: requestId,
        status: response.status,
        statusText: response.statusText,
        url: imagenUrl,
        headers: Object.fromEntries(response.headers.entries()),
        error: errorText,
        full_error: errorText.substring(0, 2000) // Log first 2000 chars
      }));
      return json(502, { 
        error: `Imagen API failed: ${response.status} - ${errorText}`,
        details: {
          status: response.status,
          statusText: response.statusText,
          url: imagenUrl,
          error: errorText.substring(0, 500)
        }
      });
    }

    imageData = await response.json();
    console.info(JSON.stringify({
      event: "image_generate_api_success",
      request_id: requestId,
      duration_ms: Date.now() - generationStartTime,
      response_keys: Object.keys(imageData),
      response_structure: JSON.stringify(imageData).substring(0, 1000) // Log first 1000 chars of response
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "image_generate_api_exception",
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error)
    }));
    return json(504, { error: `Imagen API error: ${error instanceof Error ? error.message : String(error)}` });
  }

  // Extract base64 image from Imagen API response
  // Imagen API can return in different formats:
  // 1. Imagen format: { generatedImages: [{ image: { imageBytes: "..." } }] }
  // 2. Gemini-style: { candidates: [{ content: { parts: [{ inlineData: { data: "..." } }] } }] }
  // 3. Vertex AI format: { predictions: [{ bytesBase64Encoded: "..." }] }
  
  let base64Image: string | undefined;
  
  // Try Imagen format first (generatedImages) - this is the primary format for Imagen API
  if (imageData?.generatedImages?.[0]?.image?.imageBytes) {
    base64Image = imageData.generatedImages[0].image.imageBytes;
  }
  // Try Gemini/candidates format
  else if (imageData?.candidates?.[0]?.content?.parts) {
    const imagePart = imageData.candidates[0].content.parts.find(
      (part: any) => part.inlineData?.mimeType?.startsWith('image/')
    );
    base64Image = imagePart?.inlineData?.data;
  }
  // Try predictions format (Vertex AI)
  else if (imageData?.predictions?.[0]?.bytesBase64Encoded) {
    base64Image = imageData.predictions[0].bytesBase64Encoded;
  }
  
  if (!base64Image) {
    console.error(JSON.stringify({
      event: "image_generate_no_image_in_response",
      request_id: requestId,
      full_response: JSON.stringify(imageData),
      response_keys: Object.keys(imageData || {}),
      candidates_structure: imageData?.candidates ? JSON.stringify(imageData.candidates) : 'no candidates',
      predictions_structure: imageData?.predictions ? JSON.stringify(imageData.predictions) : 'no predictions',
      generatedImages_structure: imageData?.generatedImages ? JSON.stringify(imageData.generatedImages) : 'no generatedImages'
    }));
    return json(502, { 
      error: "No image data in API response",
      response_structure: JSON.stringify(imageData).substring(0, 2000),
      note: "Please check the actual response format from Imagen API"
    });
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

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('generated-images')
    .getPublicUrl(filePath);

  const generationTime = Date.now() - generationStartTime;

  // Create message with image meta
  const messageData = {
    chat_id,
    role: 'assistant',
    text: '', // Empty text, image is in meta
    mode: mode || 'chat',
    user_id,
    client_msg_id: crypto.randomUUID(),
    meta: {
      message_type: 'image',
      image_url: publicUrl,
      image_path: filePath,
      image_prompt: prompt,
      image_model: 'imagen-3',
      image_size: '1024x1024',
      generation_time_ms: generationTime,
      cost_usd: 0.04
    }
  };

  const { error: messageError } = await supabase
    .from('messages')
    .insert([messageData]);

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
    file_path: filePath
  }));

  return json(200, {
    success: true,
    image_url: publicUrl,
    image_path: filePath
  });
});

