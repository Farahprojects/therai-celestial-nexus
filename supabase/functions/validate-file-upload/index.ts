import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSecureCorsHeaders } from '../_shared/secureCors.ts'

interface FileValidationRequest {
  bucket: string
  fileName: string
  fileType: string
  fileSize: number
}

// PROFESSIONAL DOCUMENT TYPES ONLY - Whitelist approach for security
const ALLOWED_MIME_TYPES = [
  // PDF Documents
  'application/pdf',

  // Microsoft Office Documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint', // .ppt

  // Plain Text Documents (professional use only)
  'text/plain', // .txt
  'text/markdown', // .md

  // Data Files (limited to CSV for data analysis)
  'text/csv', // .csv

  // Professional Images (reference materials only)
  'image/jpeg', // .jpg, .jpeg
  'image/png', // .png
  'image/gif', // .gif (limited animations ok)
  'image/webp', // .webp
  'image/svg+xml' // .svg (vector graphics for diagrams)
]

// PROFESSIONAL DOCUMENT EXTENSIONS ONLY - Whitelist for security
const EXTENSION_TO_MIME: Record<string, string> = {
  // Document formats
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Professional text formats
  'txt': 'text/plain',
  'md': 'text/markdown',
  'csv': 'text/csv',

  // Professional image formats
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml'
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Add validation function
function inferMimeType(fileName: string, providedMime: string): string {
  const ext = fileName.toLowerCase().split('.').pop()
  const inferredMime = ext ? EXTENSION_TO_MIME[ext] : null

  // Trust inferred MIME from extension if provided MIME is unreliable
  if (!providedMime || providedMime === 'application/octet-stream') {
    return inferredMime || 'application/octet-stream'
  }

  // Validate provided MIME matches extension (prevent spoofing)
  if (inferredMime && inferredMime !== providedMime) {
    throw new Error(`MIME type mismatch: extension suggests ${inferredMime}, but ${providedMime} provided`)
  }

  return providedMime
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    const corsHeaders = getSecureCorsHeaders(req);
    return new Response('ok', { headers: corsHeaders })
  }

  const corsHeaders = getSecureCorsHeaders(req);

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'unauthorized',
          message: 'Please log in to upload files'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const body: FileValidationRequest = await req.json()
    const { bucket, fileName, fileType, fileSize } = body

    // Validate bucket
    if (bucket !== 'folder-documents') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'invalid_bucket',
          message: 'Files can only be uploaded to the folder-documents bucket'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // IMMEDIATE SECURITY CHECK: Block dangerous extensions first
    const fileNameLower = fileName.toLowerCase()
    const dangerousExtensions = [
      'exe', 'bat', 'cmd', 'scr', 'pif', 'com', 'jar', 'msi', 'dll', 'sys',
      'vbs', 'ps1', 'sh', 'bin', 'app', 'dmg', 'pkg', 'deb', 'rpm'
    ]

    const fileExtension = fileNameLower.split('.').pop()
    if (fileExtension && dangerousExtensions.includes(fileExtension)) {
      console.warn(`[SECURITY] Blocked dangerous extension: ${fileName} (.${fileExtension})`)
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'dangerous_extension',
          message: `File type not supported: .${fileExtension} files are not allowed`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check for double extensions
    const extensionCount = (fileNameLower.match(/\./g) || []).length
    if (extensionCount > 1) {
      console.warn(`[SECURITY] Blocked double extension: ${fileName}`)
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'invalid_filename',
          message: 'File type not supported: files with multiple extensions are not allowed'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'file_too_large',
          message: `File too large: ${Math.round(fileSize / 1024 / 1024)}MB exceeds the ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Infer and validate MIME type with anti-spoofing
    let validatedMimeType: string
    try {
      validatedMimeType = inferMimeType(fileName, fileType)
      console.log(`[VALIDATE] File: ${fileName}, Provided MIME: ${fileType}, Validated MIME: ${validatedMimeType}`)
    } catch (mimeError) {
      const errorMessage = mimeError instanceof Error ? mimeError.message : 'Unknown MIME validation error'
      console.warn(`[VALIDATE] MIME spoofing detected: ${fileName} - ${errorMessage}`)
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'mime_mismatch',
          message: 'File type not supported: file extension does not match content type'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate MIME type against allowlist
    if (!ALLOWED_MIME_TYPES.includes(validatedMimeType)) {
      const ext = fileExtension ? `.${fileExtension}` : 'this'
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'unsupported_type',
          message: `File type not supported: ${ext} files are not allowed. Supported: PDF, Word, Excel, PowerPoint, TXT, MD, CSV, and images.`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // All validations passed
    console.log(`[VALIDATE] File approved: ${fileName} (${validatedMimeType}, ${Math.round(fileSize/1024)}KB)`)
    return new Response(
      JSON.stringify({
        valid: true,
        message: 'File validation successful',
        metadata: {
          mimetype: validatedMimeType,
          size: fileSize,
          extension: fileExtension
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Validation error:', error)
    return new Response(
      JSON.stringify({
        valid: false,
        error: 'server_error',
        message: 'Unable to validate file. Please try again.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
