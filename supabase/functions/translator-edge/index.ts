import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/*──────────────── ENV ------------------------------------------------------*/
const SWISS_API = Deno.env.get("SWISS_EPHEMERIS_URL")!;
const SB_URL    = Deno.env.get("SUPABASE_URL")!;
const SB_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEO_KEY   = Deno.env.get("GOOGLE_API_KEY")!;
const GEO_TTL_MIN = +(Deno.env.get("GEOCODE_TTL_MIN") ?? "1440");
const GEO_TABLE   = Deno.env.get("GEOCODE_CACHE_TABLE") ?? "geo_cache";
const VERSION = "translator-edge v3.4 (2025‑01‑15)"; // Updated with efficient audio pipeline

const sb = createClient(SB_URL, SB_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

/*──────────────── schema & utils ------------------------------------------*/
// Updated schema now allows top‑level `utc` and keeps legacy field names for compatibility
const baseSchema = z.object({
  request:        z.string(),
  reportType:     z.string().nullable().optional(),
  utc:           z.string().optional(),
  local:         z.string().optional(),
  date:          z.string().optional(),
  time:          z.string().optional(),
  birth_date:    z.string().optional(),
  birth_time:    z.string().optional(),
  tz:            z.string().optional(),
  location:      z.string().optional(),
  house_system:  z.string().optional(),
  chat_id:       z.string().optional(),

  // Flexible payload support
  name:          z.string().optional(),
  person_a:      z.any().optional(),
  person_b:      z.any().optional(),
  year:          z.number().optional(),
  return_date:   z.string().optional(),
}).refine((v) => {
  // If utc or local supplied we can proceed
  if (v.utc || v.local) return true;
  // If person_a exists we defer validation further down
  if (v.person_a) return true;
  // Otherwise need date+time pair for chart routes
  const hasDate = v.date || v.birth_date;
  const hasTime = v.time || v.birth_time;
  if (hasDate && hasTime) return true;
  // For endpoints that don't require birth data
  if (["moonphases", "positions"].includes(v.request?.toLowerCase() || "")) return true;
  return false;
}, { message: "Provide 'utc' or 'local', or a birth_date + birth_time pair." });

/** Parse YYYY-MM-DD date string explicitly */
function parseISODate(dateStr: string): { year: number; month: number; day: number } {
  // Validate format: YYYY-MM-DD
  const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateStr.match(isoDatePattern);
  
  if (!match) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD (e.g., 1990-12-25)`);
  }
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  
  // Validate ranges
  if (year < 1800 || year > 2100) {
    throw new Error(`Invalid year: ${year}. Must be between 1800-2100`);
  }
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be between 01-12 in date: ${dateStr}`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}. Must be between 01-31 in date: ${dateStr}`);
  }
  
  // Validate it's a real date (e.g., not Feb 30)
  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (testDate.getUTCFullYear() !== year || 
      testDate.getUTCMonth() !== month - 1 || 
      testDate.getUTCDate() !== day) {
    throw new Error(`Invalid date: ${dateStr}. This date does not exist (e.g., Feb 30)`);
  }
  
  return { year, month, day };
}

/** Parse various timestamp combos into an ISO‑UTC string. */
export function toUtcISO(parts: { date?: string; time?: string; tz?: string; local?: string; birth_date?: string; birth_time?: string; location?: string }): string {
  if (parts.local) {
    const d = new Date(parts.local);
    if (isNaN(d.getTime())) {
      console.error('[translator-edge] Invalid local timestamp:', parts.local);
      throw new Error(`Invalid 'local' timestamp: ${parts.local}. Expected ISO format (YYYY-MM-DD)`);
    }
    return d.toISOString();
  }
  
  const actualDate = parts.birth_date || parts.date;
  const actualTime = parts.birth_time || parts.time;

  if (actualDate) {
    if (actualTime) {
      // Parse date explicitly
      const { year, month, day } = parseISODate(actualDate);
      
      const [H, M] = actualTime.split(":" as const).map(Number);
      if (isNaN(H) || isNaN(M) || H < 0 || H > 23 || M < 0 || M > 59) {
        throw new Error(`Invalid time: ${actualTime}. Expected HH:MM format (00:00 to 23:59)`);
      }
      
      const tz = parts.tz || "UTC";
      
      // Use month - 1 because JS Date months are 0-indexed
      const provisional = new Date(Date.UTC(year, month - 1, day, H, M));
      
      try {
        const fmt = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          timeZoneName: "shortOffset",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        });
        const off = fmt.formatToParts(provisional).find(p => p.type === "timeZoneName")?.value ?? "GMT+0";
        
        const m = off.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
        if (!m) throw new Error("bad offset");
        const sign = m[1] === "-" ? -1 : 1;
        const hOff = +m[2], minOff = +(m[3]||0);
        const total = sign * (hOff * 60 + minOff);
        
        const finalUtc = new Date(provisional.getTime() - total * 60000);
        return finalUtc.toISOString();
      } catch(e) {
        return provisional.toISOString();
      }
    }
    // Parse date explicitly even without time
    const { year, month, day } = parseISODate(actualDate);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toISOString();
  }

  throw new Error("Both date and time are required");
}

/** Map user house aliases → Swiss codes. */
const HOUSE_ALIASES: Record<string,string> = { placidus:"P", koch:"K", "whole-sign":"W", equal:"A" };
function normalise(obj: any) {
  const out = { ...obj };
  if (out.house && !out.settings?.house_system) {
    const letter = HOUSE_ALIASES[out.house.toLowerCase()];
    if (letter) out.settings = { ...(out.settings||{}), house_system: letter };
  }
  if (out.date && !out.birth_date) { out.birth_date = out.date; delete out.date; }
  if (out.time && !out.birth_time){ out.birth_time = out.time; delete out.time; }
  return out;
}

/*──────────────── geo helpers --------------------------------------------*/
async function ensureLatLon(obj:any){
  if ((obj.latitude!==undefined&&obj.longitude!==undefined)||!obj.location){
    return { data: obj, googleGeoUsed:false };
  }
  const place = String(obj.location).trim();
  const { data } = await sb.from(GEO_TABLE).select("lat,lon,updated_at").eq("place", place).maybeSingle();
  if (data){
    const min = (Date.now()-Date.parse(data.updated_at))/60000;
    if (min < GEO_TTL_MIN) return { data:{...obj,latitude:data.lat,longitude:data.lon}, googleGeoUsed:false };
  }
  const g = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(place)}&key=${GEO_KEY}`).then(r=>r.json());
  if (g.status!=="OK") throw new Error(`Geocode failed: ${g.status}`);
  const { lat,lng } = g.results[0].geometry.location;
  await sb.from(GEO_TABLE).upsert({ place, lat, lon: lng });
  return { data:{...obj,latitude:lat,longitude:lng}, googleGeoUsed:true };
}
async function inferTimezone(obj:any){
  if (obj.tz) {
    return obj.tz;
  }
  if (obj.latitude!==undefined&&obj.longitude!==undefined){
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${obj.latitude},${obj.longitude}&timestamp=0&key=${GEO_KEY}`;
    const tf = await fetch(url).then(r=>r.json());
    if (tf.status==="OK"&&tf.timeZoneId) {
      return tf.timeZoneId;
    }
  }
  return null;
}



/*──────────────── logging --------------------------------------------------*/
async function logTranslator(run:{request_type:string;request_payload:any;swiss_data:any;swiss_status:number;processing_ms:number;error?:string;google_geo:boolean;translator_payload:any;chat_id?:string;mode?:string}){
  const { error } = await sb.from("translator_logs").insert({
    request_type: run.request_type,
    request_payload: run.request_payload,
    translator_payload: run.translator_payload,
    response_status: run.swiss_status,
    swiss_data: run.swiss_data,
    processing_time_ms: run.processing_ms,
    error_message: run.error,
    google_geo: run.google_geo,
    chat_id: run.chat_id ?? null,
    swiss_error: run.swiss_status !== 200, // Set swiss_error based on status
  });
  if(error) console.error("[translator] log fail", error.message);
}

/*──────────────── Canon ----------------------------------------------------*/
const CANON:Record<string,string>={ natal:"natal",transits:"transits",progressions:"progressions",return:"return",synastry:"synastry",compatibility:"synastry",positions:"positions",moonphases:"moonphases",body:"body_matrix",body_matrix:"body_matrix",sync:"sync",essence:"essence",flow:"flow",mindset:"mindset",monthly:"monthly",focus:"focus" };

/*──────────────── Edge Function -------------------------------------------*/
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  const t0=Date.now();
  const reqId = crypto.randomUUID().slice(0,8);
  let requestType="unknown", googleGeo=false, chatId:string|undefined;
  let body: any;
  let mode: string | undefined;
  
  try{
    // Extract chat_id before validation for proper error logging
    const rawBodyText = await req.text();
    let rawBody: any;
    try {
      rawBody = JSON.parse(rawBodyText);
      
      // Warm-up check
      if (rawBody?.warm === true) {
        return new Response("Warm-up", { status: 200, headers: corsHeaders });
      }
      
      chatId = rawBody.chat_id;
      mode = rawBody.mode;
    } catch (parseErr) {
      console.error(`[translator-edge-${reqId}] JSON parse failed:`, parseErr);
      throw new Error("Invalid JSON in request body");
    }
    function normalisePerson(src:any={}):any{
      return {
        birth_date: src.birth_date||src.date||null,
        birth_time: src.birth_time||src.time||null,
        location:   src.location||src.city||"",
        latitude:   src.latitude??src.lat??null,
        longitude:  src.longitude??src.lon??null,
        tz:         src.tz||src.timezone||"",
        name:       src.name||"",
        house_system: src.house_system||src.hsys||"",
      };
    }
    function normaliseBody(input:any){
      if(input.person_a||input.person_b){
        input.person_a = normalisePerson(input.person_a||{});
        if(input.person_b) input.person_b = normalisePerson(input.person_b);
      }else{
        input.person_a = normalisePerson(input);
      }
      return input;
    }
    const body = normaliseBody(rawBody);
    const parsed = baseSchema.parse(body);
    requestType = parsed.request.trim().toLowerCase();
    const canon = CANON[requestType];
    if(!canon) throw new Error(`Unknown request '${parsed.request}'`);

    let payload:any;
    if(canon==="sync" && parsed.person_a && parsed.person_b){
      const {data:pa,googleGeoUsed:g1}=await ensureLatLon(parsed.person_a);
      const tzA=await inferTimezone(pa);
      // Assign timezone back to the person object
      pa.tz = tzA || pa.tz || "UTC";
      const utcA=toUtcISO({...pa,tz:pa.tz,location:pa.location||""});
      const normA={...normalise(pa),utc:utcA,tz:pa.tz, name: parsed.person_a.name || ''};

      const {data:pb,googleGeoUsed:g2}=await ensureLatLon(parsed.person_b);
      const tzB=await inferTimezone(pb);
      // Assign timezone back to the person object
      pb.tz = tzB || pb.tz || "UTC";
      const utcB=toUtcISO({...pb,tz:pb.tz,location:pb.location||""});
      const normB={...normalise(pb),utc:utcB,tz:pb.tz, name: parsed.person_b.name || ''};

      googleGeo = g1||g2;
      payload = { person_a: normA, person_b: normB, ...parsed };
    }else{
      const {data:withLatLon,googleGeoUsed} = await ensureLatLon(parsed);
      googleGeo = googleGeoUsed;
      if(["natal","essence","sync","flow","mindset","monthly","focus","progressions","return","transits"].includes(canon)){
        try{
          const tzGuess = await inferTimezone(withLatLon);

          // 🔒 Pull from person_a if exists
          const source = parsed.person_a ?? parsed;

          const date = source.birth_date ?? source.date;
          const time = source.birth_time ?? source.time;

          if (!date) throw new Error("Missing birth_date");
          if (!time) throw new Error("Missing birth_time");

          withLatLon.birth_date = date;
          withLatLon.birth_time = time;
          withLatLon.tz = parsed.tz || tzGuess || source.tz || "UTC";

          const utcISO = toUtcISO({
            birth_date: date,
            birth_time: time,
            tz: withLatLon.tz,
            location: source.location ?? parsed.location ?? ""
          });

          withLatLon.utc = parsed.utc || utcISO;
        }catch(e){ console.warn(`[translator-edge-${reqId}] UTC gen fail`, e); }
      }
      // Flatten payload if it's just person_a
      payload = {
        ...(parsed.person_a ?? withLatLon),
        utc: withLatLon.utc,
        tz: withLatLon.tz,
        name: parsed.name || parsed.person_a?.name || '',
        reportType: parsed.reportType,  // Changed from 'report' to 'reportType'
        request: parsed.request,
        user_id: (parsed as any).user_id,
        house_system: parsed.person_a?.house_system ?? withLatLon.house_system ?? "P",
      };
    }
    const url = `${SWISS_API}/${canon}`;
    const swiss = await fetch(url,{ method:["moonphases","positions"].includes(canon)?"GET":"POST", headers:{"Content-Type":"application/json"}, body:["moonphases","positions"].includes(canon)?undefined:JSON.stringify(payload) });
    const txt = await swiss.text();
    const swissData = (()=>{ try{return JSON.parse(txt);}catch{return { raw:txt }; }})();


    await logTranslator({ request_type:canon, request_payload:body, swiss_data:swissData, swiss_status:swiss.status, processing_ms:Date.now()-t0, error: swiss.ok?undefined:`Swiss ${swiss.status}`, google_geo:googleGeo, translator_payload:payload, chat_id:body.chat_id, mode:body.mode });
    
    // Call context-injector for all successful astro data reports (skip for swiss mode)
    if (body.chat_id && swiss.ok && body.mode !== 'swiss') {
      console.log(`[translator-edge-${reqId}] Calling context-injector for chat_id: ${body.chat_id}`);
      try {
        const { error: injectorError } = await sb.functions.invoke('context-injector', {
          body: { chat_id: body.chat_id, mode: body.mode }
        });
        
        if (injectorError) {
          console.error(`[translator-edge-${reqId}] Context-injector failed:`, injectorError);
        } else {
          console.log(`[translator-edge-${reqId}] Context-injector completed successfully`);
        }
      } catch (injectorErr) {
        console.error(`[translator-edge-${reqId}] Context-injector error:`, injectorErr);
      }
    } else if (body.mode === 'swiss') {
      console.log(`[translator-edge-${reqId}] Skipping context-injector for swiss mode`);
    }

    // Call report-orchestrator for all insight reports (fire-and-forget)
    if (body.chat_id && swiss.ok && parsed.reportType) {
      console.log(`[translator-edge-${reqId}] Calling report-orchestrator for ${parsed.reportType} report with chat_id: ${body.chat_id}`);
      try {
        const orchestratorPayload = {
          endpoint: 'profile',
          report_type: parsed.reportType,
          chat_id: body.chat_id,  // Use chat_id instead of user_id
          chartData: swissData,
          is_guest: false,
          mode: body.mode  // Pass mode for context-injector
        };
        
        const { error: orchestratorError } = await sb.functions.invoke('report-orchestrator', {
          body: orchestratorPayload
        });
        
        if (orchestratorError) {
          console.error(`[translator-edge-${reqId}] Report-orchestrator failed:`, orchestratorError);
        } else {
          console.log(`[translator-edge-${reqId}] Report-orchestrator called successfully`);
        }
      } catch (orchestratorErr) {
        console.error(`[translator-edge-${reqId}] Report-orchestrator error:`, orchestratorErr);
      }
    }
    
    return new Response(txt,{status:swiss.status,headers:corsHeaders});
  }catch(err){
    const msg = (err as Error).message;
    console.error(`[translator-edge-${reqId}]`, msg);
    await logTranslator({ request_type:requestType, request_payload:"n/a", swiss_data:{error:msg}, swiss_status:500, processing_ms:Date.now()-t0, error:msg, google_geo:googleGeo, translator_payload:null, chat_id:chatId, mode:mode });
    return new Response(JSON.stringify({ error:msg }),{status:500,headers:corsHeaders});
  }
});
