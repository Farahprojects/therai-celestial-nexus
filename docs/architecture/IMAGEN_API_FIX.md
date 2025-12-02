# Imagen API Fix - November 5, 2025

## Problem

The image generation feature was failing with a 404 error:
```
Imagen API failed: 404 - 
url: https://generativelanguage.googleapis.com/v1beta/models/imagen-3:generateImages
```

## Root Cause

The implementation had **two critical issues**:

1. **Wrong Model Name**: Using `imagen-3` which doesn't exist in the Generative Language API
2. **Wrong Endpoint**: Using `:generateImages` which is not the correct endpoint

## What Google Actually Supports

According to Google's official documentation (as of June 2025):

### Available Models via Generative Language API
- `imagen-4.0-generate-001` (standard quality)
- `imagen-4.0-ultra-generate-001` (high quality)
- `imagen-4.0-fast-generate-001` (faster generation)

### Correct Endpoint
- **Correct**: `:generateContent`
- **Incorrect**: `:generateImages` ❌

### Correct URL Format
```
https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateContent
```

## Changes Made

### 1. Updated Model Name (line 127)
```typescript
// OLD
const IMAGEN_MODEL = 'imagen-3';

// NEW
const IMAGEN_MODEL = 'imagen-4.0-generate-001';
```

### 2. Updated Endpoint (line 128)
```typescript
// OLD
const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateImages`;

// NEW
const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateContent`;
```

### 3. Updated Request Payload (lines 144-161)
The `generateContent` endpoint uses a different payload structure than `generateImages`:

```typescript
// OLD - generateImages format
body: JSON.stringify({
  prompt: prompt,
  config: {
    numberOfImages: 1
  }
})

// NEW - generateContent format
body: JSON.stringify({
  contents: [
    {
      parts: [
        {
          text: prompt
        }
      ]
    }
  ],
  generationConfig: {
    temperature: 1.0,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "image/png"
  }
})
```

### 4. Updated Response Parsing (lines 204-215)
Simplified to only handle the `generateContent` response format:

```typescript
// Response format: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "..." } }] } }] }

if (imageData?.candidates?.[0]?.content?.parts) {
  const imagePart = imageData.candidates[0].content.parts.find(
    (part: any) => part.inlineData?.mimeType?.startsWith('image/')
  );
  base64Image = imagePart?.inlineData?.data;
}
```

### 5. Updated Metadata (line 292)
```typescript
image_model: 'imagen-4.0-generate-001' // Updated from 'imagen-3'
```

## Update: Second Fix (responseMimeType)

After the first fix, we encountered a 400 error:
```
response_mime_type: allowed mimetypes are `text/plain`, `application/json`, `application/xml`, `application/yaml` and `text/x.enum`
```

**Issue**: The `generateContent` endpoint doesn't support `image/png` as a response MIME type - it's designed for text content. Imagen models return images as **inline data** in the response naturally, without needing `responseMimeType`.

**Fix**: Removed the `generationConfig` parameter entirely. The simplified request:
```typescript
body: JSON.stringify({
  contents: [
    {
      parts: [{ text: prompt }]
    }
  ]
})
```

## Testing

To test the fix:
1. Deploy the updated edge function
2. Ask the AI to generate an image
3. Verify the image is created successfully
4. Check that errors no longer occur

## Notes

- The Imagen 3 models (`imagen-3.0-generate-002`, etc.) may require special access permissions
- Imagen 4 models are readily available via the Generative Language API
- Cost remains at $0.04 per image (may vary based on model used)
- Rate limiting: 3 images per user per 24 hours

## References

- [Google AI Imagen Documentation](https://ai.google.dev/gemini-api/docs/imagen)
- [Google Generative Language API Reference](https://ai.google.dev/api)

