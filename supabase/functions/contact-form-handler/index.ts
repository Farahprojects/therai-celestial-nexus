
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// Rate limiting using a simple in-memory store
const ipLimiter = new Map<string, { count: number, resetTime: number }>();
const MAX_REQUESTS_PER_HOUR = 3; // 3 emails per hour per IP
const ONE_HOUR_MS = 60 * 60 * 1000;

interface ContactFormPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  honeypot?: string; // Honeypot field to catch bots
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function logMessage(message: string, level: 'debug' | 'info' | 'warn' | 'error', data?: any): void {
  const logObject = {
    level,
    message,
    page: 'contact-form-handler',
    data: { ...data, timestamp: new Date().toISOString() }
  };

  // Log in a format that will be easy to parse
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(logObject));
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logMessage("Contact form handler request received", "info", { method: req.method });
    
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";
    
    // Check rate limit
    const now = Date.now();
    const clientData = ipLimiter.get(clientIP);
    
    if (clientData) {
      // Reset counter if the time window has passed
      if (now > clientData.resetTime) {
        ipLimiter.set(clientIP, { count: 1, resetTime: now + ONE_HOUR_MS });
      } 
      // Otherwise increment and check limit
      else {
        clientData.count += 1;
        if (clientData.count > MAX_REQUESTS_PER_HOUR) {
          logMessage("Rate limit exceeded", "warn", { clientIP, count: clientData.count });
          return new Response(JSON.stringify({ 
            error: "Too many requests. Please try again later." 
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
    } else {
      // First request from this IP
      ipLimiter.set(clientIP, { count: 1, resetTime: now + ONE_HOUR_MS });
    }
    
    // Parse the form data
    const payload = await req.json() as ContactFormPayload;
    
    // Check for honeypot field (if it's filled, it's likely a bot)
    if (payload.honeypot && payload.honeypot.length > 0) {
      logMessage("Honeypot triggered", "warn", { clientIP });
      // Return success but don't process (to confuse bots)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Validate required fields
    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      logMessage("Missing required fields", "warn", { 
        clientIP,
        hasName: !!payload.name,
        hasEmail: !!payload.email,
        hasSubject: !!payload.subject,
        hasMessage: !!payload.message
      });
      
      return new Response(JSON.stringify({ 
        error: "All fields are required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Validate email format
    if (!validateEmail(payload.email)) {
      logMessage("Invalid email format", "warn", { clientIP, email: payload.email });
      return new Response(JSON.stringify({ 
        error: "Invalid email address" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Get the Supabase URL and anon key from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing required Supabase environment variables");
    }
    
    // Start both operations in parallel for better performance
    
    // 1. Create Supabase client and start fetching the template in parallel with other operations
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Fetch support_email template - we'll need this later
    const templatePromise = supabase
      .from('email_notification_templates')
      .select('subject, body_html, body_text')
      .eq('template_type', 'support_email')
      .single();
    
    // 2. Prepare data for the support email
    const emailPayload = {
      to: "support@therai.co",
      from: "Therai Contact <no-reply@therai.co>",
      subject: `Contact Form: ${escapeHtml(payload.subject)}`,
      html: `
        <h2>New Contact Message</h2>
        <p><strong>From:</strong> ${escapeHtml(payload.name)} (${escapeHtml(payload.email)})</p>
        <p><strong>Subject:</strong> ${escapeHtml(payload.subject)}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(payload.message).replace(/\n/g, '<br>')}</p>
      `,
      text: `
        New Contact Message

        From: ${payload.name} (${payload.email})
        Subject: ${payload.subject}

        Message:
        ${payload.message}
      `
    };
    
    logMessage("Forwarding to outbound-messenger function", "info", { 
      to: emailPayload.to,
      from: emailPayload.from,
      subject: emailPayload.subject
    });
    
    // 3. Send the support email via outbound-messenger - this is our primary task
    const supportEmailPromise = Promise.race([
      fetch(
        `${supabaseUrl}/functions/v1/outbound-messenger`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
            "apikey": supabaseAnonKey
          },
          body: JSON.stringify(emailPayload),
        }
      ),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('Support email timeout')), 10000)
      )
    ]);

    // 4. Wait for the support email to be sent
    const response = await supportEmailPromise;
    
    if (!response.ok) {
      const errorData = await response.text();
      logMessage("Error from outbound-messenger function", "error", { 
        status: response.status,
        errorData
      });
      
      throw new Error(`Email service error: ${response.status}`);
    }
    
    logMessage("Support email sent successfully", "info");

    // 5. Create a background task for sending the auto-reply email
    // This allows us to return a response to the user immediately
    const sendAutoReplyAsync = async () => {
      try {
        logMessage("Starting auto-reply email sending process", "info");
        
        // Send the auto-reply email using the email-verification function
        // which will properly handle template fetching from the database
        const autoReplyResponse = await fetch(
          `${supabaseUrl}/functions/v1/email-verification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "apikey": supabaseAnonKey
            },
            body: JSON.stringify({
              email: payload.email,
              url: "https://therai.co", // Generic URL for support auto-reply
              template_type: "support_email"
            }),
          }
        );

        if (!autoReplyResponse.ok) {
          const errorData = await autoReplyResponse.text();
          logMessage("Error sending auto-reply via email-verification", "error", { 
            status: autoReplyResponse.status,
            errorData,
            recipientEmail: payload.email
          });
        } else {
          logMessage("Auto-reply email sent successfully via email-verification", "info", {
            recipientEmail: payload.email
          });
        }
      } catch (error) {
        logMessage("Error in sending auto-reply", "error", { 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
    
    // Use Deno's waitUntil to handle the background task
    // @ts-ignore - EdgeRuntime check for Deno Deploy compatibility
    if (typeof globalThis.EdgeRuntime !== 'undefined') {
      // @ts-ignore - EdgeRuntime is available in Deno Deploy
      EdgeRuntime.waitUntil(sendAutoReplyAsync());
      logMessage("Auto-reply email queued as background task", "info");
    } else {
      // For local development, just execute in the background
      sendAutoReplyAsync().catch(err => {
        logMessage("Background auto-reply task error", "error", { 
          error: err instanceof Error ? err.message : String(err)
        });
      });
    }
    
    // Return success response immediately after the support email is sent
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    logMessage("Unexpected error", "error", { 
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    
    return new Response(JSON.stringify({ 
      error: "Something went wrong. Please try again later."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
