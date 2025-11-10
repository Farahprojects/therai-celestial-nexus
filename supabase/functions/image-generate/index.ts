// @ts-nocheck - Deno runtime, types checked at deployment
// Image generation edge function using Google Imagen
// - Rate limiting: 3 images per user per 24 hours
// - Uses @google/genai SDK (Imagen not available via REST API)
// - Uploads to Supabase Storage
// - Creates message with image metadata
// - Text overlay using Sharp for clean, crisp text rendering

import { createPooledClient } from "../_shared/supabaseClient.ts";
import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.0.0";
import { checkLimit, incrementUsage } from "../_shared/limitChecker.ts";
import sharp from "npm:sharp@0.33.5";

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

// XML escape helper for SVG text
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Simple text wrapping for multiline captions
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  // Rough estimate: each char is ~0.6 * fontSize in width
  const avgCharWidth = fontSize * 0.6;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  
  return lines.length > 0 ? lines : [text];
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

  const { chat_id, prompt, user_id, mode, image_id, text_overlay } = body || {};

  if (!chat_id || typeof chat_id !== "string") {
    return json(400, { error: "Missing or invalid field: chat_id" });
  }
  if (!prompt || typeof prompt !== "string") {
    return json(400, { error: "Missing or invalid field: prompt" });
  }
  if (!user_id || typeof user_id !== "string") {
    return json(400, { error: "Missing or invalid field: user_id" });
  }


  // ✅ PRO WAY: Check image generation limit (database-driven)
  const limitCheck = await checkLimit(supabase, user_id, 'image_generation', 1);

  console.info(JSON.stringify({
    event: "image_limit_check",
    request_id: requestId,
    user_id,
    allowed: limitCheck.allowed,
    current_usage: limitCheck.current_usage,
    limit: limitCheck.limit,
    is_unlimited: limitCheck.is_unlimited
  }));

  if (!limitCheck.allowed) {
    console.warn(JSON.stringify({
      event: "image_generate_rate_limit_exceeded",
      request_id: requestId,
      user_id,
      limit: limitCheck.limit,
      current_usage: limitCheck.current_usage
    }));
    
    return json(429, {
      error: limitCheck.is_unlimited 
        ? 'Image generation unavailable'
        : `Daily image generation limit reached (${limitCheck.limit} images per day). Limit resets in 24 hours.`,
      limit: limitCheck.limit,
      used: limitCheck.current_usage,
      remaining: limitCheck.remaining
    });
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

  // Apply text overlay if provided (for sync memes)
  if (text_overlay && mode === 'sync') {
    try {
      console.info(JSON.stringify({
        event: "text_overlay_start",
        request_id: requestId,
        text_top: text_overlay.top,
        text_center: text_overlay.center?.substring(0, 50),
        text_bottom: text_overlay.bottom
      }));

      // Get image dimensions
      const metadata = await sharp(imageBytes).metadata();
      const width = metadata.width || 1024;
      const height = metadata.height || 1820;

      // Create SVG overlay with text
      // Using simple, clean layout with shadow for readability
      const svgOverlay = `
        <svg width="${width}" height="${height}">
          <defs>
            <style type="text/css">
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&amp;display=swap');
            </style>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
            </filter>
          </defs>
          
          <!-- Top text: Names -->
          <text 
            x="${width / 2}" 
            y="120" 
            font-family="Inter, -apple-system, sans-serif" 
            font-size="48" 
            font-weight="600" 
            fill="white" 
            text-anchor="middle"
            filter="url(#shadow)"
          >${escapeXml(text_overlay.top || '')}</text>
          
          <!-- Center text: Caption (multiline support) -->
          <text 
            x="${width / 2}" 
            y="${height / 2}" 
            font-family="Inter, -apple-system, sans-serif" 
            font-size="56" 
            font-weight="700" 
            fill="white" 
            text-anchor="middle"
            filter="url(#shadow)"
          >
            ${wrapText(escapeXml(text_overlay.center || ''), width - 120, 56).map((line, i) => 
              `<tspan x="${width / 2}" dy="${i === 0 ? 0 : 70}">${line}</tspan>`
            ).join('')}
          </text>
          
          <!-- Bottom text: Brand -->
          <text 
            x="${width / 2}" 
            y="${height - 80}" 
            font-family="Inter, -apple-system, sans-serif" 
            font-size="36" 
            font-weight="400" 
            fill="white" 
            text-anchor="middle"
            filter="url(#shadow)"
          >${escapeXml(text_overlay.bottom || '')}</text>
        </svg>
      `;

      // Composite text overlay onto image
      imageBytes = await sharp(imageBytes)
        .composite([{
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0
        }])
        .png()
        .toBuffer();

      console.info(JSON.stringify({
        event: "text_overlay_complete",
        request_id: requestId,
        final_size: imageBytes.length
      }));

    } catch (overlayError) {
      console.error(JSON.stringify({
        event: "text_overlay_failed",
        request_id: requestId,
        error: overlayError instanceof Error ? overlayError.message : String(overlayError),
        stack: overlayError instanceof Error ? overlayError.stack : undefined
      }));
      // Continue without overlay rather than failing entirely
    }
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

  // 🚀 OPTIMIZED: Only await critical message update
  const { data: updatedMessage, error: messageError } = await supabase
    .from('messages')
    .update({
      status: 'complete',
      meta: {
        message_type: 'image',
        image_url: publicUrl,
        image_path: filePath,
        image_prompt: prompt,
        image_model: IMAGEN_MODEL,
        image_size: mode === 'sync' ? '1024x1820' : '1024x1024',
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

  // 🚀 FIRE-AND-FORGET: Increment usage counter in feature_usage table
  incrementUsage(supabase, user_id, 'image_generation', 1).then(({ success, reason }) => {
    if (!success) {
      console.error(JSON.stringify({
        event: "image_generate_increment_failed",
        request_id: requestId,
        error: reason
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

