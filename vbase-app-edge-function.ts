// Edge function for YOUR vbase app
// supabase/functions/send-email/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Forward to therai project email handler
    const response = await fetch(
      `${Deno.env.get('THERAI_EMAIL_FUNCTION_URL')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('THERAI_ANON_KEY')}`,
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();
    
    return new Response(
      JSON.stringify(result),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

