import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const log = (...args: any[]) => console.log(`[SEND-PAYMENT-NOTIFICATION:${requestId}]`, ...args);
  
  const respond = (status: number, body: any) => 
    new Response(JSON.stringify(body), { 
      status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId = "";
  let templateType = "";
  let variables: Record<string, string> = {};
  
  try {
    const body = await req.json();
    userId = body.user_id ?? "";
    templateType = body.template_type ?? "";
    variables = body.variables ?? {};
    log("✓ Request received:", { userId, templateType, variableCount: Object.keys(variables).length });
  } catch (e) {
    log("✗ JSON parsing failed:", e);
    return respond(400, { error: "Invalid JSON" });
  }

  if (!userId) {
    log("✗ Missing user_id parameter");
    return respond(400, { error: "user_id is required" });
  }

  if (!templateType) {
    log("✗ Missing template_type parameter");
    return respond(400, { error: "template_type is required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const smtpEndpoint = Deno.env.get("OUTBOUND_SMTP_ENDPOINT");

  if (!supabaseUrl || !key || !smtpEndpoint) {
    log("✗ Missing environment variables:", { hasUrl: !!supabaseUrl, hasKey: !!key, hasSmtp: !!smtpEndpoint });
    return respond(500, { error: "Missing environment variables" });
  }

  const supabase = createClient(supabaseUrl, key);

  // Resolve user email from profiles or auth.users
  let userEmail = "";
  try {
    log("→ Fetching user email from profiles");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (!profileError && profile?.email) {
      userEmail = profile.email;
      log("✓ Email found in profiles:", userEmail);
    } else {
      // Fallback to auth.users
      log("→ Email not in profiles, checking auth.users");
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
      
      if (!authError && authUser?.user?.email) {
        userEmail = authUser.user.email;
        log("✓ Email found in auth.users:", userEmail);
      } else {
        log("✗ User email not found:", { profileError: profileError?.message, authError: authError?.message });
        
        // Log to admin_logs
        await supabase.from("admin_logs").insert({
          page: "EmailSystem",
          event_type: "send_payment_notification_error",
          logs: `Failed to resolve email for user ${userId}`,
          meta: {
            user_id: userId,
            template_type: templateType,
            error: "User email not found in profiles or auth.users"
          }
        });

        return respond(404, { error: "User email not found" });
      }
    }
  } catch (err: any) {
    log("✗ Exception during email resolution:", err.message);
    
    await supabase.from("admin_logs").insert({
      page: "EmailSystem",
      event_type: "send_payment_notification_error",
      logs: `Exception resolving email for user ${userId}`,
      meta: {
        user_id: userId,
        template_type: templateType,
        error: err.message
      }
    });

    return respond(500, { error: "Failed to resolve user email", details: err.message });
  }

  // Fetch template
  let templateData;
  try {
    log(`→ Fetching email template for: ${templateType}`);
    const { data, error: templateErr } = await supabase
      .from("email_notification_templates")
      .select("subject, body_html, body_text")
      .eq("template_type", templateType)
      .single();

    if (templateErr || !data) {
      log("✗ Template fetch failed:", {
        error: templateErr?.message,
        hasData: !!data,
      });
      
      await supabase.from("admin_logs").insert({
        page: "EmailSystem",
        event_type: "send_payment_notification_error",
        logs: `Template not found: ${templateType}`,
        meta: {
          user_id: userId,
          template_type: templateType,
          error: templateErr?.message
        }
      });

      return respond(404, { error: "Template not found", details: templateErr?.message });
    }

    templateData = data;
    log("✓ Template fetched successfully:", { subject: templateData.subject });
  } catch (err: any) {
    log("✗ Exception during template fetch:", err.message);
    
    await supabase.from("admin_logs").insert({
      page: "EmailSystem",
      event_type: "send_payment_notification_error",
      logs: `Exception fetching template ${templateType}`,
      meta: {
        user_id: userId,
        template_type: templateType,
        error: err.message
      }
    });

    return respond(500, { error: "Template processing failed", details: err.message });
  }

  // Replace all template variables
  log("→ Processing template variables:", Object.keys(variables));
  let html = templateData.body_html;
  let text = templateData.body_text;
  let subject = templateData.subject;

  // Replace variables in HTML, text, and subject
  const replaceVariables = (content: string): string => {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
      // Leave unmatched variables as-is (fail-safe)
      return match;
    });
  };

  html = replaceVariables(html);
  text = replaceVariables(text);
  subject = replaceVariables(subject);

  log("✓ Template processing complete");

  // Build VPS-compatible payload
  const payload = {
    slug: "noreply",
    domain: "therai.co",
    to_email: userEmail,
    subject: subject,
    body: html,
    request_id: `${userId}-${requestId}`,
    timestamp: new Date().toISOString()
  };

  log("📧 FINAL PAYLOAD TO VPS:");
  log("============================================");
  log(JSON.stringify({ ...payload, body: `[HTML body: ${html.length} chars]` }, null, 2));
  log("============================================");

  try {
    const send = await fetch(smtpEndpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "therai-send-payment-notification/1.0"
      },
      body: JSON.stringify(payload),
    });

    if (!send.ok) {
      const errorText = await send.text();
      log("✗ SMTP send failed:", { status: send.status, error: errorText });
      
      await supabase.from("admin_logs").insert({
        page: "EmailSystem",
        event_type: "send_payment_notification_error",
        logs: `SMTP send failed for template ${templateType}`,
        meta: {
          user_id: userId,
          template_type: templateType,
          email: userEmail,
          smtp_status: send.status,
          error: errorText
        }
      });

      return respond(500, { error: "Email delivery failed", details: errorText });
    }

    log("✓ Email sent successfully via VPS");
    
    // Log success to admin_logs
    await supabase.from("admin_logs").insert({
      page: "EmailSystem",
      event_type: "send_payment_notification_success",
      logs: `Payment notification sent: ${templateType}`,
      meta: {
        user_id: userId,
        template_type: templateType,
        email: userEmail,
        variables: variables
      }
    });

  } catch (err: any) {
    log("✗ Exception during email send:", err.message);
    
    await supabase.from("admin_logs").insert({
      page: "EmailSystem",
      event_type: "send_payment_notification_error",
      logs: `Exception during email send for template ${templateType}`,
      meta: {
        user_id: userId,
        template_type: templateType,
        email: userEmail,
        error: err.message
      }
    });

    return respond(500, { error: "Email delivery failed", details: err.message });
  }

  log(`✅ PAYMENT NOTIFICATION COMPLETE: ${userEmail} - ${templateType}`);
  return respond(200, { status: "sent", template_type: templateType, email: userEmail });
});

