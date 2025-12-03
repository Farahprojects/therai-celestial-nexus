import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface FileValidationRequest {
  bucket: string
  fileName: string
  fileType: string
  fileSize: number
}

const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',

  // Text files
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/xml',
  'application/json',
  'application/javascript',
  'text/javascript',
  'application/typescript',
  'text/typescript',

  // Archives (for storage, not execution)
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',

  // Images (for reference documents)
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB limit

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
          error: 'Unauthorized',
          message: 'Please log in to upload files'
        }),
        {
          status: 401,
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
          error: 'Invalid bucket',
          message: 'Files can only be uploaded to the folder-documents bucket'
        }),
        {
          status: 400,
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
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Security violation',
          message: `SECURITY VIOLATION: Files with .${fileExtension} extension are not allowed`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check for double extensions
    const extensionCount = (fileNameLower.match(/\./g) || []).length
    if (extensionCount > 1) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Invalid filename',
          message: 'SECURITY VIOLATION: Files with multiple extensions are not allowed'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'File too large',
          message: `File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds maximum allowed size of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Invalid file type',
          message: `MIME type '${fileType}' is not allowed. Only safe document types are permitted.`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // All validations passed
    return new Response(
      JSON.stringify({
        valid: true,
        message: 'File validation successful',
        metadata: {
          mimetype: fileType,
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
        error: 'Validation failed',
        message: 'Unable to validate file. Please try again.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
