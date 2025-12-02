// @ts-nocheck - Deno runtime, types checked at deployment
// Image generation edge function using Google Imagen
// - Rate limiting: 3 images per user per 24 hours
// - Uses @google/genai SDK (Imagen not available via REST API)
// - Uploads to Supabase Storage
// - Creates message with image metadata

import { createPooledClient } from "../_shared/supabaseClient.ts";
import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.0.0";
// Rate limiting now handled by centralized check-rate-limit edge function

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

// Initialize Google GenAI client once at top level (reused across requests)
const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

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

// Image compression helper - simplified approach for Deno
async function compressImage(imageBytes: Uint8Array, quality: number = 0.8, targetWidth?: number): Promise<Uint8Array> {
  try {
    // For now, let's use a simpler approach that just returns the original
    // In production, you'd want to integrate with a proper image processing service
    // like Cloudinary, Imgix, or a dedicated image processing API

    console.log(`[ImageCompression] Processing image: ${imageBytes.length} bytes, quality: ${quality}, resize: ${targetWidth || 'none'}`);

    // For immediate fix, let's just return the original image
    // TODO: Implement proper image compression with a reliable library
    return imageBytes;

    // Future implementation with proper library:
    /*
    const { decode, encode } = await import("https://deno.land/x/imagescript@1.2.17/mod.ts");
    const image = await decode(imageBytes);
    let processedImage = image;

    if (targetWidth && targetWidth < image.width) {
      const aspectRatio = image.height / image.width;
      const targetHeight = Math.round(targetWidth * aspectRatio);
      processedImage = image.resize(targetWidth, targetHeight);
    }

    return await encode(processedImage, "webp", { quality: Math.round(quality * 100) });
    */

  } catch (error) {
    console.warn("[ImageCompression] Failed:", error);
    return imageBytes; // Always return original on error
  }
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


  // ✅ CENTRALIZED RATE LIMITING: Use the dedicated rate limit service
  const { data: limitResult, error: limitError } = await supabase.functions.invoke("check-rate-limit", {
    body: {
      user_id,
      action: "image_generation",
      increment: true  // This will check AND increment usage atomically
    }
  });

  if (limitError || !limitResult) {
    console.error(JSON.stringify({
      event: "image_generate_rate_limit_error",
      request_id: requestId,
      user_id,
      error: limitError?.message || "Rate limit check failed"
    }));

    // Default to allowing on error (fail-open for better UX)
    console.warn("Rate limit check failed, proceeding with image generation");
  } else if (!limitResult.allowed) {
    console.warn(JSON.stringify({
      event: "image_generate_rate_limit_exceeded",
      request_id: requestId,
      user_id,
      limit: limitResult.limit,
      remaining: limitResult.remaining,
      error_code: limitResult.error_code
    }));

    const errorMessage = limitResult.error_code === 'TRIAL_EXPIRED'
      ? limitResult.message || "Your free trial has ended. Upgrade to Growth ($10/month) for unlimited AI conversations! 🚀"
      : limitResult.remaining !== null
        ? `You've used your daily image limit. ${limitResult.remaining} images remaining. Upgrade for unlimited!`
        : `Daily image generation limit reached. Limit resets in 24 hours.`;

    return json(429, {
      error: errorMessage,
      limit: limitResult.limit,
      remaining: limitResult.remaining,
      error_code: limitResult.error_code
    });
  } else {
    console.info(JSON.stringify({
      event: "image_generate_rate_limit_allowed",
      request_id: requestId,
      user_id,
      remaining: limitResult.remaining,
      limit: limitResult.limit
    }));
  }

  // Use Imagen model for image generation via SDK
  // REST API :generateImages endpoint doesn't exist (404 error)
  // Must use @google/genai SDK instead
  const generationStartTime = Date.now();
  
  // Always use Imagen 4 Fast to maintain 2¢ cost per image
  const IMAGEN_MODEL = 'imagen-4.0-fast-generate-001';

  let base64Image: string | undefined;
  
  try {
    // Generate image using SDK (genAI initialized at top level)
    // For sync mode, add aspect ratio and quality settings
    const config = mode === 'sync' 
      ? {
          numberOfImages: 1,
          aspectRatio: '9:16',  // Portrait for social sharing
        }
      : {
          numberOfImages: 1
        };
    
    const response = await genAI.models.generateImages({
      model: IMAGEN_MODEL,
      prompt: prompt,
      config: config
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

  // 🚀 BASIC OPTIMIZATION: Use original PNG for now (compression disabled temporarily)
  const imageVariants: { [key: string]: { bytes: Uint8Array; width: number; height: number; format: string } } = {};

  // Temporarily use PNG until compression is properly implemented
  imageVariants.png = {
    bytes: imageBytes,
    width: 1024,
    height: mode === 'sync' ? 1820 : 1024,
    format: 'png'
  };

  console.log(JSON.stringify({
    event: "image_generate_basic",
    request_id: requestId,
    size_kb: Math.round(imageBytes.length / 1024),
    format: 'png'
  }));

  // Upload single PNG image (simplified approach)
  const timestamp = Date.now();
  const imageId = crypto.randomUUID();
  const uploadResults: { [key: string]: string } = {};

  const variant = 'png';
  const data = imageVariants.png;
  const fileName = `${timestamp}-${imageId}.${data.format}`;
  const filePath = `${user_id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('generated-images')
    .upload(filePath, data.bytes, {
      contentType: `image/${data.format}`,
      upsert: false,
      // Add caching headers for better performance
      cacheControl: 'public, max-age=31536000, immutable', // 1 year cache for generated images
    });

  if (uploadError) {
    console.error(JSON.stringify({
      event: "image_generate_upload_failed",
      request_id: requestId,
      error: uploadError.message
    }));
    return json(500, { error: `Upload failed: ${uploadError.message}` });
  }

  uploadResults[variant] = filePath;

  // Use custom domain for image URLs
  const CUSTOM_DOMAIN = 'https://api.therai.co';
  const publicUrl = `${CUSTOM_DOMAIN}/storage/v1/object/public/generated-images/${uploadResults.png}`;

  const generationTime = Date.now() - generationStartTime;

  // Store image metadata (simplified)
  const imageVariantsMeta: { [key: string]: any } = {};
  for (const [variant, data] of Object.entries(imageVariants)) {
    imageVariantsMeta[variant] = {
      url: `${CUSTOM_DOMAIN}/storage/v1/object/public/generated-images/${uploadResults[variant]}`,
      path: uploadResults[variant],
      width: data.width,
      height: data.height,
      format: data.format,
      size_kb: Math.round(data.bytes.length / 1024)
    };
  }

  // Update message with image metadata
  const { data: updatedMessage, error: messageError } = await supabase
    .from('messages')
    .update({
      status: 'complete',
      meta: {
        message_type: 'image',
        image_url: publicUrl,
        image_path: uploadResults.png,
        image_prompt: prompt,
        image_model: IMAGEN_MODEL,
        image_size: mode === 'sync' ? '1024x1820' : '1024x1024',
        image_format: 'png',
        image_variants: imageVariantsMeta,
        original_size_kb: Math.round(originalSize / 1024),
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

  // ✅ USAGE TRACKING: Already handled by centralized rate limit check above

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
      model: IMAGEN_MODEL,
      size: mode === 'sync' ? '1024x1820' : '1024x1024'
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
        supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'image-insert',
          payload: {
            image: newUserImage
          }
        }, { httpSend: true }).catch((broadcastError) => {
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
    supabase.channel(channelName).send({
      type: 'broadcast',
      event: 'message-update',
      payload: {
        chat_id,
        message: updatedMessage
      }
    }, { httpSend: true }).catch((broadcastError) => {
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

