

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.text();
    const { to, subject, html, text = "", from } = JSON.parse(body) as EmailPayload;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing to / subject / html" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const endpoint = Deno.env.get("OUTBOUND_SMTP_ENDPOINT");

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "SMTP endpoint not set" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Build payload in the same format as outbound-messenger
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    const payload = {
      slug: "noreply",
      domain: "therai.co",
      to_email: to,
      subject: subject,
      body: html || text, // Use HTML version first, fallback to text
      request_id: requestId,
      timestamp: timestamp
    };

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "therai-verification-emailer/1.0"
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      return new Response(
        JSON.stringify({ error: "SMTP send failed", details: err }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const responseText = await r.text();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
