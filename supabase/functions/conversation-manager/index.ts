// @ts-nocheck - Deno runtime, types checked at deployment
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkLimit } from '../_shared/limitChecker.ts';

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

type Body = {
user_id?: string; // optional; will be validated against auth user if provided
conversation_id?: string;
title?: string;
mode?: string;
report_data?: Record<string, unknown>;
email?: string;
name?: string;
profile_mode?: boolean;
folder_id?: string;
profile_id?: string;
};

type HandlerCtx = {
req: Request;
params: URLSearchParams;
admin: SupabaseClient; // service role for DB
userId: string;
body: Body;
};

const DEBUG = Deno.env.get('DEBUG') === 'true';

const SUPABASE_URL = mustGetEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = mustGetEnv('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = mustGetEnv('SUPABASE_ANON_KEY');

// Initialize admin client at top level (reused across requests)
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function mustGetEnv(key: string): string {
const v = Deno.env.get(key);
if (!v) {
throw new Error(`Missing required environment variable: ${key}`);
}
return v;
}

function json(data: Json, init: ResponseInit = {}) {
return new Response(JSON.stringify(data), {
...init,
headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) },
});
}

function errorJson(message: string, status = 400) {
return json({ error: message }, { status });
}

// Return success/error in JSON payload with 200 status (better for Edge Functions)
function jsonResponse(payload: { success: boolean; error?: string; data?: any }) {
return json(payload, { status: 200 });
}

async function getAuthUserId(req: Request): Promise<string> {
const auth = req.headers.get('Authorization');
if (!auth) throw new Error('Missing Authorization header');

// Use anon client with user's JWT token to validate auth
const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  global: { headers: { Authorization: auth } },
  auth: { persistSession: false, autoRefreshToken: false }
});
const { data, error } = await supabase.auth.getUser();
if (error || !data?.user) throw new Error('Invalid or expired token');
return data.user.id;
}

// Handlers
const handlers: Record<string, (ctx: HandlerCtx) => Promise<Response>> = {
// Update conversation profile (link primary profile for memory tracking)
async update_conversation_profile({ admin, body, userId }: HandlerCtx) {
  const { conversation_id, profile_id } = body;
  if (!conversation_id) return errorJson('conversation_id is required');
  if (!profile_id) return errorJson('profile_id is required');

  // Verify profile belongs to user and is primary
  const { data: profile, error: profileError } = await admin
    .from('user_profile_list')
    .select('user_id, is_primary')
    .eq('id', profile_id)
    .single();

  if (profileError || !profile) {
    return errorJson('Profile not found', 404);
  }

  if (profile.user_id !== userId) {
    return errorJson('Profile does not belong to user', 403);
  }

  if (!profile.is_primary) {
    return errorJson('Only primary profile can be linked for memory tracking', 400);
  }

  // Update conversation
  const { error: updateError } = await admin
    .from('conversations')
    .update({ profile_id })
    .eq('id', conversation_id)
    .eq('user_id', userId);

  if (updateError) {
    console.error('[update_conversation_profile] Update failed:', updateError);
    return errorJson('Failed to update conversation', 500);
  }

  return json({ success: true, profile_id });
},

// Create a new conversation
async create_conversation({ req, admin, body, userId }: HandlerCtx) {
const { title, mode, report_data, email, name, profile_mode, profile_id, folder_id } = body;
if (!mode) return errorJson('mode is required for conversation creation');

// Check if profile_mode flag is present
const isProfileMode = profile_mode === true;

// ✅ sync_score can only be created from UI left panel (meme button) - NOT from folders
if (mode === 'sync_score' && folder_id) {
  return jsonResponse({
    success: false,
    error: 'sync_score conversations cannot be created in folders. Please use the meme button from the left panel.'
  });
}

// ✅ Check image generation limit for sync_score mode (6 images per day)
if (mode === 'sync_score') {
  const limitCheck = await checkLimit(admin, userId, 'image_generation', 1);
  
  if (!limitCheck.allowed || (limitCheck.current_usage !== undefined && limitCheck.current_usage >= 6)) {
    return jsonResponse({
      success: false,
      error: 'Daily limit exceeded. You\'ve used 6 images today. Try again tomorrow or upgrade for unlimited access.'
    });
  }
}

// ✅ NEW: Free users can create conversations - limits enforced at message level
// No subscription check needed here - feature gating happens in llm-handler-gemini

const id = crypto.randomUUID();

const meta: Record<string, unknown> = {};
if (report_data) {
  meta.report_payload = {
    report_data,
    email: email || '',
    name: name || '',
    submitted_at: new Date().toISOString(),
  };
}
if (isProfileMode) {
  meta.profile_mode = true;
}

const { data, error } = await admin
  .from('conversations')
  .insert({
    id,
    user_id: userId,
    owner_user_id: userId,
    title: isProfileMode ? 'Profile' : (title || 'Chat'),
    mode: isProfileMode ? 'profile' : mode,
    profile_id: profile_id || null,
    folder_id: folder_id || null,
    meta,
  })
  .select()
  .single();

if (error) {
  console.error('[conversation-manager] Insert error:', error);
  return errorJson(`Failed to create conversation: ${error.message || JSON.stringify(error)}`, 500);
}

// Profile mode: Skip messages table insertion, but call translator-edge for chart generation
if (isProfileMode) {
  console.log('[conversation-manager] Profile mode: conversation created, skipping messages table interaction');
  
  // Call initiate-auth-report (which will call translator-edge)
  if (report_data) {
    const authHeader = req.headers.get('Authorization') || '';
    const payload = {
      chat_id: id,
      report_data,
      email: email || '',
      name: name || '',
      mode: 'profile', // Set mode to 'profile' so translator-edge knows to skip messages
    };
    fetch(`${SUPABASE_URL}/functions/v1/initiate-auth-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(payload),
    }).catch((e) => console.error('[conversation-manager] initiate-auth-report error', e));
  }
  
  return jsonResponse({
    success: true,
    data: {
      ...data,
      is_generating_report: false,
      reportType: (report_data as any)?.reportType ?? null,
    }
  });
}

// Fire-and-forget report generation if report_data provided
let is_generating_report = false;
if (report_data) {
  const authHeader = req.headers.get('Authorization') || '';
  const payload = {
    chat_id: id,
    report_data,
    email: email || '',
    name: name || '',
    mode,
  };
  // Do not await; log only in DEBUG
  fetch(`${SUPABASE_URL}/functions/v1/initiate-auth-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify(payload),
  }).catch((e) => DEBUG && console.error('initiate-auth-report error', e));

  is_generating_report = true;
}

// Auto-inject profile astro data for chat/together modes (fully fire-and-forget)
if (mode === 'chat' || mode === 'together') {
  console.log('[conversation-manager] Chat mode detected, queueing profile injection');
  
  // 🚀 FIRE-AND-FORGET: Entire profile lookup + injection (don't block response)
  (async () => {
    try {
      const { data: profileConversation } = await admin
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('mode', 'profile')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profileConversation) {
        console.log('[conversation-manager] Found profile conversation:', profileConversation.id);
        
        await fetch(`${SUPABASE_URL}/functions/v1/context-injector`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || ''
          },
          body: JSON.stringify({
            chat_id: id,
            profile_chat_id: profileConversation.id,
            mode
          })
        });
      } else {
        console.log('[conversation-manager] No profile conversation found, skipping auto-injection');
      }
    } catch (e) {
      console.error('[conversation-manager] Profile injection error:', e);
    }
  })();
}

return jsonResponse({
  success: true,
  data: {
    ...data,
    is_generating_report,
    reportType: (report_data as any)?.reportType ?? null,
  }
});
},

// Return existing or create a new conversation
async get_or_create_conversation({ admin, body, userId }: HandlerCtx) {
const { conversation_id, title, mode, report_data, email, name } = body;

if (conversation_id) {
  const { data, error } = await admin
    .from('conversations')
    .select('*')
    .eq('id', conversation_id)
    .eq('user_id', userId)
    .single();
  if (error || !data) return errorJson('Conversation not found or access denied', 404);
  return json(data);
}

if (!mode) return errorJson('mode is required for conversation creation');

// ✅ NEW: Free users can create conversations - limits enforced at message level
// No subscription check needed here - feature gating happens in llm-handler-gemini

const id = crypto.randomUUID();

const meta: Record<string, unknown> = {};
if (report_data) {
  meta.report_payload = {
    report_data,
    email: email || '',
    name: name || '',
    submitted_at: new Date().toISOString(),
  };
}

const { data, error } = await admin
  .from('conversations')
  .insert({
    id,
    user_id: userId,
    owner_user_id: userId,
    title: title || 'Chat',
    mode,
    meta,
  })
  .select()
  .single();

if (error) return errorJson('Failed to create conversation', 500);

return json(data);
},

// Update updated_at and optional title
async update_conversation_activity({ admin, body, userId }: HandlerCtx) {
const { conversation_id, title } = body;
if (!conversation_id) return errorJson('conversation_id is required');
const { error } = await admin
.from('conversations')
.update({
updated_at: new Date().toISOString(),
...(title ? { title } : {}),
})
.eq('id', conversation_id)
.eq('user_id', userId);
if (error) return errorJson('Failed to update conversation activity', 500);
return json({ success: true, conversation_id });
},

// List owned + shared (deduped)
// Exclude folder-owned conversations from history (they're shown under folders)
async list_conversations({ admin, userId }: HandlerCtx) {
const [{ data: owned, error: ownedErr }, { data: shared, error: sharedErr }] = await Promise.all([
admin
.from('conversations')
.select('id, title, created_at, updated_at, meta, is_public, mode, folder_id')
.eq('user_id', userId)
.is('folder_id', null) // Exclude folder-owned conversations from history
.order('updated_at', { ascending: false }),
admin
.from('conversations')
.select('id, title, created_at, updated_at, meta, is_public, mode, folder_id, conversations_participants!inner(role)')
.eq('conversations_participants.user_id', userId)
.is('folder_id', null) // Exclude folder-owned conversations from history
.order('updated_at', { ascending: false }),
]);

if (ownedErr || sharedErr) return errorJson('Failed to list conversations', 500);

// Merge and dedupe by id (shared takes precedence)
const map = new Map<string, any>();
for (const c of shared || []) map.set(c.id, c);
for (const c of owned || []) if (!map.has(c.id)) map.set(c.id, c);

const conversations = Array.from(map.values()).sort(
  (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
);

return json(conversations);
},

// Delete conversation and messages
async delete_conversation({ admin, body, userId }: HandlerCtx) {
const { conversation_id } = body;
if (!conversation_id) return errorJson('conversation_id is required');

// Ensure ownership
const { data: conv, error: convErr } = await admin
  .from('conversations')
  .select('id, owner_user_id')
  .eq('id', conversation_id)
  .single();
if (convErr || !conv) return errorJson('Conversation not found', 404);
if (conv.owner_user_id !== userId) return errorJson('Only the owner can delete the conversation', 403);

const [{ error: msgErr }, { error: convErr2 }] = await Promise.all([
  admin.from('messages').delete().eq('chat_id', conversation_id),
  admin.from('conversations').delete().eq('id', conversation_id).eq('owner_user_id', userId),
]);

if (msgErr || convErr2) return errorJson('Failed to delete conversation', 500);
return json({ success: true, conversation_id });
},

// Update title
async update_conversation_title({ admin, body, userId }: HandlerCtx) {
const { conversation_id, title } = body;
if (!conversation_id) return errorJson('conversation_id is required');
if (!title) return errorJson('title is required');

const { error } = await admin
  .from('conversations')
  .update({ title, updated_at: new Date().toISOString() })
  .eq('id', conversation_id)
  .eq('user_id', userId);
if (error) return errorJson('Failed to update title', 500);
return json({ success: true, conversation_id });
},

// Make public (owner only) and ensure owner appears in participants
async share_conversation({ admin, body, userId }: HandlerCtx) {
const { conversation_id } = body;
if (!conversation_id) return errorJson('conversation_id is required');

const { error } = await admin
  .from('conversations')
  .update({ is_public: true, updated_at: new Date().toISOString() })
  .eq('id', conversation_id)
  .eq('owner_user_id', userId);
if (error) return errorJson('Failed to share conversation', 500);

await admin
  .from('conversations_participants')
  .upsert(
    { conversation_id, user_id: userId, role: 'owner' },
    { onConflict: 'conversation_id,user_id' },
  );

return json({ success: true, conversation_id, is_public: true });
},

// Make private (owner only)
async unshare_conversation({ admin, body, userId }: HandlerCtx) {
const { conversation_id } = body;
if (!conversation_id) return errorJson('conversation_id is required');

const { error } = await admin
  .from('conversations')
  .update({ is_public: false, updated_at: new Date().toISOString() })
  .eq('id', conversation_id)
  .eq('owner_user_id', userId);
if (error) return errorJson('Failed to unshare conversation', 500);

return json({ success: true, conversation_id, is_public: false });
},

// Join public conversation
async join_conversation({ admin, body, userId }: HandlerCtx) {
const { conversation_id } = body;
if (!conversation_id) return errorJson('conversation_id is required');

const { data: conv, error } = await admin
  .from('conversations')
  .select('id, is_public')
  .eq('id', conversation_id)
  .eq('is_public', true)
  .single();

if (error || !conv) return errorJson('Conversation not found or not public', 404);

await admin
  .from('conversations_participants')
  .upsert(
    { conversation_id, user_id: userId, role: 'member' },
    { onConflict: 'conversation_id,user_id' },
  );

return json({ success: true, conversation_id });
},
};

Deno.serve(async (req) => {
if (req.method === 'OPTIONS') {
return new Response(null, { headers: corsHeaders });
}

if (req.method !== 'POST') {
return errorJson('Method not allowed', 405);
}

const params = new URL(req.url).searchParams;
const action = params.get('action') || '';

try {
const body = (await safeJson(req)) as Body;
const userId = await getAuthUserId(req);

// If client passes user_id, ensure it matches authenticated user
if (body?.user_id && body.user_id !== userId) {
  return errorJson('user_id mismatch', 403);
}

const handler = handlers[action];
if (!handler) return errorJson('Invalid action');

// Use top-level admin client (no per-request overhead)
const res = await handler({ req, params, admin: adminClient, userId, body: body || {} });
return res;
} catch (err: any) {
if (DEBUG) {
console.error('Unhandled error:', { message: err?.message, stack: err?.stack });
}
const message = err?.message || 'Internal server error';
const status = message.includes('Authorization') || message.includes('token') ? 401 : 500;
return errorJson(message, status);
}
});

async function safeJson(req: Request): Promise<unknown> {
const contentType = req.headers.get('content-type') || '';
if (!contentType.toLowerCase().includes('application/json')) return {};
try {
return await req.json();
} catch (error) {
console.error('[conversation-manager] Failed to parse JSON body:', error);
return {};
}
}

