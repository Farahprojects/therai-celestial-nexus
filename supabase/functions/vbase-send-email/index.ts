const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: "noreply" | "support";  // Which email address to send from
}

interface VPSPayload {
  slug: string;
  domain: string;
  to_email: string;
  subject: string;
  body: string;
  request_id: string;
  timestamp: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text, from = "noreply" } = await req.json() as EmailPayload;

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      console.error("[vbase-send-email] Missing required fields:", { 
        hasTo: !!to, 
        hasSubject: !!subject, 
        hasHtml: !!html, 
        hasText: !!text 
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields", 
          required: ["to", "subject", "html or text"] 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.error("[vbase-send-email] Invalid email format:", to);
      
      return new Response(
        JSON.stringify({ 
          error: "Invalid email format",
          details: "Please provide a valid email address"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate 'from' slug
    if (from !== "noreply" && from !== "support") {
      console.error("[vbase-send-email] Invalid 'from' slug:", from);
      
      return new Response(
        JSON.stringify({ 
          error: "Invalid 'from' value",
          details: "Must be either 'noreply' or 'support'"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Get VPS SMTP endpoint from environment
    const smtpEndpoint = Deno.env.get("OUTBOUND_SMTP_ENDPOINT");
    if (!smtpEndpoint) {
      console.error("[vbase-send-email] OUTBOUND_SMTP_ENDPOINT not configured");
      
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Generate request tracking ID
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Build VPS-compatible payload
    const vpsPayload: VPSPayload = {
      slug: from,                    // "noreply" or "support"
      domain: "vbase.co",           // Your domain
      to_email: to,                 // Recipient
      subject: subject,             // Email subject
      body: html || text || "",     // Email content (HTML preferred)
      request_id: requestId,        // Tracking ID
      timestamp: timestamp          // Request timestamp
    };

    console.log(`[vbase-send-email] Sending email to ${to} from ${from}@vbase.co`);
    console.log(`[vbase-send-email] Subject: ${subject}`);
    console.log(`[vbase-send-email] Request ID: ${requestId}`);
    console.log(`[vbase-send-email] Payload:`, {
      slug: vpsPayload.slug,
      domain: vpsPayload.domain,
      to_email: vpsPayload.to_email,
      subject: vpsPayload.subject,
      bodyLength: vpsPayload.body.length,
      request_id: vpsPayload.request_id
    });

    // Send to VPS SMTP endpoint
    const response = await fetch(smtpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "vbase-emailer/1.0"
      },
      body: JSON.stringify(vpsPayload)
    });

    // Log response status
    console.log(`[vbase-send-email] VPS response status: ${response.status}`);

    // Handle VPS response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[vbase-send-email] SMTP failed: ${response.status} - ${errorText}`);
      
      return new Response(
        JSON.stringify({ 
          error: "Email delivery failed", 
          details: errorText,
          request_id: requestId,
          status: response.status
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const result = await response.text();
    console.log(`[vbase-send-email] Email sent successfully: ${result}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        request_id: requestId,
        timestamp: timestamp
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[vbase-send-email] Unexpected error:", errorMessage);
    console.error("[vbase-send-email] Error stack:", error instanceof Error ? error.stack : "N/A");
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

