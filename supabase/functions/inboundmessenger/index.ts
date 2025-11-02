
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Supabase Setup ──
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "", 
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// ── Security Utilities ──
const sanitizeString = (input: string, maxLength = 10000): string => {
  if (typeof input !== 'string') return '';
  return input.slice(0, maxLength).trim();
};

// Extract email from formatted address (e.g., "Name <email@domain.com>" -> "email@domain.com")
const extractEmail = (formattedEmail: string): string => {
  // Remove any leading/trailing whitespace
  const trimmed = formattedEmail.trim();
  
  // Look for email in angle brackets: "Name <email@domain.com>"
  const angleBracketMatch = trimmed.match(/<([^>]+)>/);
  if (angleBracketMatch) {
    return angleBracketMatch[1].trim();
  }
  
  // If no angle brackets, return as-is (should be plain email)
  return trimmed;
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const sanitizeHeaders = (headers: any): string => {
  try {
    // Convert to string and limit length to prevent huge payloads
    const headerString = typeof headers === 'string' ? headers : JSON.stringify(headers);
    return sanitizeString(headerString, 50000);
  } catch {
    return 'Invalid headers format';
  }
};

// ── Domain Slug Validation Function ──
const isValidDomainSlug = async (domain: string, slug: string): Promise<boolean> => {
  console.log(`[inboundMessenger] 🔍 DOMAIN/SLUG LOOKUP: domain=${domain}, slug=${slug}`);
  
  const { data, error } = await supabase
    .from("domain_slugs")
    .select(slug)
    .eq("domain", domain)
    .single();

  console.log(`[inboundMessenger] 📋 DOMAIN/SLUG LOOKUP RESULT:`, { 
    domain, 
    slug, 
    data, 
    error: error ? {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    } : null
  });

  if (error || !data) {
    console.log(`[inboundMessenger] ❌ DOMAIN/SLUG LOOKUP FAILED:`, { domain, slug, error, data });
    return false;
  }

  const isValid = (data as any)[slug] === true;
  console.log(`[inboundMessenger] ✅ DOMAIN/SLUG VALIDATION:`, { domain, slug, isValid, slugValue: (data as any)[slug] });
  return isValid;
};

// ── Logging Function ──
const logMessage = (message: string, data: any = {}) => {
  const logObject = {
    timestamp: new Date().toISOString(),
    function: 'inboundMessenger',
    message,
    data
  };
  console.log(JSON.stringify(logObject));
};

// ── Main ──
Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  logMessage("🚀 INBOUND MESSENGER REQUEST STARTED", { 
    requestId, 
    method: req.method,
    userAgent: req.headers.get('user-agent') || 'unknown'
  });

  if (req.method !== "POST") {
    logMessage("❌ METHOD NOT ALLOWED", { 
      requestId, 
      method: req.method, 
      allowedMethods: ['POST'] 
    });
    return new Response("Method not allowed", {
      status: 405
    });
  }

  let payload;
  try {
    payload = await req.json();
    logMessage("📥 PAYLOAD RECEIVED", { 
      requestId, 
      payloadKeys: Object.keys(payload),
      payloadSize: JSON.stringify(payload).length
    });
  } catch (error) {
    logMessage("❌ INVALID JSON PAYLOAD", { 
      requestId, 
      error: error instanceof Error ? error.message : String(error)
    });
    return new Response("Invalid JSON payload", {
      status: 400
    });
  }

  const { from_email, to_email, subject, body, raw_headers, direction, attachments, attachment_count, has_attachments } = payload;

  // Input validation and sanitization
  logMessage("🔍 STARTING INPUT VALIDATION", { 
    requestId, 
    from_email: from_email ? 'present' : 'missing',
    to_email: to_email ? 'present' : 'missing',
    subject: subject ? 'present' : 'missing',
    body: body ? 'present' : 'missing',
    direction: direction ? 'present' : 'missing',
    raw_headers: raw_headers ? 'present' : 'missing',
    attachments: attachments ? 'present' : 'missing',
    attachment_count: attachment_count || 0,
    has_attachments: has_attachments || false
  });

  if (!from_email || !to_email || !body || !direction) {
    logMessage("❌ MISSING REQUIRED FIELDS", { 
      requestId, 
      missingFields: {
        from_email: !from_email,
        to_email: !to_email,
        body: !body,
        direction: !direction
      }
    });
    return new Response("Missing required fields", {
      status: 400
    });
  }

  // Extract clean email addresses from formatted strings
  const cleanFromEmail = extractEmail(from_email);
  const cleanToEmail = extractEmail(to_email);
  
  // Validate email formats
  const fromEmailValid = isValidEmail(cleanFromEmail);
  const toEmailValid = isValidEmail(cleanToEmail);
  
  logMessage("📧 EMAIL FORMAT VALIDATION", { 
    requestId, 
    original_from: from_email.substring(0, 50) + '...',
    original_to: to_email.substring(0, 50) + '...',
    clean_from: cleanFromEmail,
    clean_to: cleanToEmail,
    fromEmailValid,
    toEmailValid
  });

  if (!fromEmailValid || !toEmailValid) {
    logMessage("❌ INVALID EMAIL FORMAT", { 
      requestId, 
      fromEmailValid,
      toEmailValid,
      original_from: from_email.substring(0, 100),
      original_to: to_email.substring(0, 100),
      clean_from: cleanFromEmail,
      clean_to: cleanToEmail
    });
    return new Response("Invalid email format", {
      status: 400
    });
  }

  // Validate direction
  logMessage("🧭 DIRECTION VALIDATION", { 
    requestId, 
    direction,
    validDirections: ['inbound', 'outgoing']
  });

  if (!['inbound', 'outgoing'].includes(direction)) {
    logMessage("❌ INVALID DIRECTION", { 
      requestId, 
      direction,
      expectedDirections: ['inbound', 'outgoing']
    });
    return new Response("Invalid direction", {
      status: 400
    });
  }

  // Sanitize all inputs
  logMessage("🧹 STARTING INPUT SANITIZATION", { 
    requestId,
    originalSizes: {
      from_email: from_email.length,
      to_email: to_email.length,
      clean_from: cleanFromEmail.length,
      clean_to: cleanToEmail.length,
      subject: (subject || '').length,
      body: body.length,
      raw_headers: typeof raw_headers === 'string' ? raw_headers.length : JSON.stringify(raw_headers).length
    }
  });

  const sanitizedFromEmail = sanitizeString(cleanFromEmail, 254);
  const sanitizedToEmail = sanitizeString(cleanToEmail, 254);
  const sanitizedSubject = sanitizeString(subject || '', 998); // RFC 5322 limit
  const sanitizedBody = sanitizeString(body, 1000000); // 1MB limit
  const sanitizedHeaders = sanitizeHeaders(raw_headers);
  
  // Sanitize and validate attachments
  let sanitizedAttachments: any[] = [];
  let sanitizedAttachmentCount = 0;
  let sanitizedHasAttachments = false;
  
  if (attachments && Array.isArray(attachments)) {
    sanitizedAttachments = attachments
      .filter(att => att && typeof att === 'object' && att.filename && att.content)
      .map(att => ({
        filename: sanitizeString(att.filename, 255),
        content: sanitizeString(att.content, 15000000), // 15MB base64 limit
        mime_type: sanitizeString(att.mime_type || 'application/octet-stream', 100),
        size: typeof att.size === 'number' ? Math.min(att.size, 10000000) : 0, // 10MB limit
        encoding: sanitizeString(att.encoding || 'base64', 20)
      }))
      .slice(0, 10); // Max 10 attachments
    
    sanitizedAttachmentCount = sanitizedAttachments.length;
    sanitizedHasAttachments = sanitizedAttachmentCount > 0;
  }

  logMessage("✅ INPUT SANITIZATION COMPLETE", { 
    requestId,
    sanitizedSizes: {
      from_email: sanitizedFromEmail.length,
      to_email: sanitizedToEmail.length,
      subject: sanitizedSubject.length,
      body: sanitizedBody.length,
      raw_headers: sanitizedHeaders.length,
      attachments: sanitizedAttachments.length,
      attachment_count: sanitizedAttachmentCount,
      has_attachments: sanitizedHasAttachments
    }
  });

  // Parse slug and domain from recipient
  const [slug, domain] = sanitizedToEmail.toLowerCase().split("@");
  
  logMessage("🔍 PARSING EMAIL ADDRESS", { 
    requestId,
    to_email: sanitizedToEmail,
    parsedSlug: slug,
    parsedDomain: domain,
    slugLength: slug?.length || 0,
    domainLength: domain?.length || 0
  });
  
  // Additional validation for slug and domain
  if (!slug || !domain || slug.length > 64 || domain.length > 253) {
    logMessage("❌ INVALID SLUG/DOMAIN FORMAT", { 
      requestId,
      slug,
      domain,
      slugLength: slug?.length || 0,
      domainLength: domain?.length || 0,
      maxSlugLength: 64,
      maxDomainLength: 253
    });
    return new Response("Invalid email format", {
      status: 400
    });
  }
  
  // Validate domain and slug combination
  logMessage("🔍 VALIDATING DOMAIN/SLUG COMBINATION", { 
    requestId,
    domain,
    slug,
    checkingTable: 'domain_slugs'
  });

  const isValid = await isValidDomainSlug(domain, slug);
  
  logMessage("📋 DOMAIN/SLUG VALIDATION RESULT", { 
    requestId,
    domain,
    slug,
    isValid,
    validationMethod: 'domain_slugs table lookup'
  });
  
  if (!isValid) {
    logMessage("❌ INVALID DOMAIN/SLUG COMBINATION", { 
      requestId,
      domain,
      slug,
      reason: 'Not found in domain_slugs table or slug column is false'
    });
    return new Response("Invalid domain/slug combination", {
      status: 400
    });
  }

  // Log message (admin-only table now)
  logMessage("💾 ATTEMPTING DATABASE SAVE", { 
    requestId,
    table: 'email_messages',
    recordData: {
      from_address: sanitizedFromEmail.substring(0, 50) + '...',
      to_address: sanitizedToEmail.substring(0, 50) + '...',
      subject: sanitizedSubject.substring(0, 100) + '...',
      bodyLength: sanitizedBody.length,
      direction,
      headersLength: sanitizedHeaders.length,
      attachmentCount: sanitizedAttachmentCount,
      hasAttachments: sanitizedHasAttachments
    }
  });

  const { data: insertData, error: insertError } = await supabase
    .from("email_messages")
    .insert([
      {
        from_address: sanitizedFromEmail,
        to_address: sanitizedToEmail,
        subject: sanitizedSubject,
        body: sanitizedBody,
        direction,
        raw_headers: sanitizedHeaders,
        attachments: sanitizedAttachments,
        attachment_count: sanitizedAttachmentCount,
        has_attachments: sanitizedHasAttachments
      }
    ])
    .select();

  if (insertError) {
    logMessage("❌ DATABASE SAVE FAILED", { 
      requestId,
      error: insertError,
      errorCode: insertError.code,
      errorMessage: insertError.message,
      errorDetails: insertError.details,
      errorHint: insertError.hint
    });
    return new Response("Database error", {
      status: 500
    });
  }

  logMessage("✅ EMAIL MESSAGE SAVED SUCCESSFULLY", { 
    requestId,
    insertData,
    recordId: insertData?.[0]?.id,
    from_address: sanitizedFromEmail,
    to_address: sanitizedToEmail,
    direction,
    subject: sanitizedSubject.substring(0, 100),
    attachmentCount: sanitizedAttachmentCount,
    hasAttachments: sanitizedHasAttachments
  });

  logMessage("🎉 INBOUND MESSENGER REQUEST COMPLETED", { 
    requestId,
    status: 'success',
    totalProcessingTime: 'completed',
    finalDecision: 'ACCEPTED - Email saved to database'
  });

  return new Response("Message logged", {
    status: 200
  });
});
