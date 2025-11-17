// folder-ai-handler.ts
// Dedicated LLM handler for Folder AI - knowledge worker inside folders

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPooledClient } from "../_shared/supabaseClient.ts";

/* ----------------------------- Configuration ----------------------------- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin"
} as Record<string, string>;

const JSON_RESPONSE = (status: number, payload: any) =>
  new Response(JSON.stringify(payload), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  GOOGLE_API_KEY: Deno.env.get("GOOGLE-LLM-NEW"),
  GEMINI_MODEL: Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash-exp"
};

const GEMINI_TIMEOUT_MS = 30_000;
const MESSAGE_HISTORY_LIMIT = 10; // Keep recent working memory
const FOLDER_AI_DAILY_LIMIT = 50; // Free tier limit

/* ------------------------------- Validation ------------------------------ */
if (!ENV.SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!ENV.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!ENV.GOOGLE_API_KEY) throw new Error("Missing env: GOOGLE-LLM-NEW");

/* ------------------------------ System Prompt ----------------------------- */
const SYSTEM_PROMPT = `You are the AI engine assigned to a single folder.

Your Role:
- You act like a "knowledge worker" inside that folder
- You do NOT store long-term chat history
- You treat the folder's documents as your memory
- You can read, analyze, create, and update artifacts inside the folder
- The user always approves saves

Your Capabilities:
1. Retrieve the right files when needed
2. Analyze cross-document patterns
3. Generate drafts
4. Propose updates
5. Create summaries, insights, and structured reports
6. Help the user think, plan, reflect, or strategize

Starting Information:
- At the start of every interaction, you receive a structured folder map
- The folder map lists: documents, journal entries, and other items
- Each item has: ID, title, type, and a short description
- You do NOT assume any item's full content until you request it

Fetching Documents:
When you need more detail from a file, you request it using this format:

<request_documents>
<ids>["doc_123", "note_04"]</ids>
<reason>I need these items to analyze emotional patterns from the past week.</reason>
</request_documents>

Creating Drafts:
When you want to create new content, use this format:

<draft_document>
<title>Week's Emotional Pattern Summary</title>
<content>
...full draft text here in markdown format...
</content>
</draft_document>

After generating a draft, ALWAYS ask the user:
"Would you like me to save this into the folder or edit it first?"

Updating Existing Documents:
If your analysis modifies an existing document:

<propose_update>
<document_id>doc_123</document_id>
<change_type>overwrite</change_type>
<content>
...updated content here...
</content>
</propose_update>

Always ask the user:
"Do you want me to apply these changes to the document?"

Multi-Step Thinking:
You can perform multi-step reasoning:
1. Retrieve → request the documents you need
2. Analyze → produce insight
3. Propose → draft or update something
4. Save only with permission

Cross-Analytics:
You're allowed to perform:
- Cross-document comparison
- Emotional/cognitive pattern extraction
- Timeline building
- Behavioral mapping
- Relationship and dynamic analysis
- Meta-summary generation
- Questions to clarify user intent

You can also suggest:
- New documents
- New sections
- New formats (bullet points, tables, insights)

IMPORTANT RULES:
- NEVER autonomously save or delete
- You ALWAYS propose, never execute
- No automatic updates
- No hidden saves
- No silent mutations
- The user approves everything

Conversational Guidelines:
- Keep conversation human and natural
- Ask clarifying questions when needed
- Offer to create summaries, insights, or structured documents
- Offer to update existing documents
- Offer to create "living documents" that evolve over time
- Do NOT ramble
- Do NOT produce ultra-long replies unless requested
- Do NOT act outside the folder
- Do NOT reference outside data unless asked

Your Mental Model:
Think of yourself like:
- Cursor for folders
- A coding copilot but for data/documents
- A research assistant for analysis
- A writer that drafts internal reports
- A system that uses documents as memory objects

Chat = short-term working memory
Folder documents = long-term memory`;

/* ------------------------------ Tool Definitions ----------------------------- */
const TOOL_DEFINITIONS = [
  {
    name: "fetch_documents",
    description: "Fetch the full content of specific documents or journal entries from the folder by their IDs",
    parameters: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of document IDs to fetch"
        },
        reason: {
          type: "string",
          description: "Brief explanation of why you need these documents"
        }
      },
      required: ["ids", "reason"]
    }
  }
];

/* ------------------------------ Helper Functions ----------------------------- */

/**
 * Check if user has reached folder AI limit
 */
async function checkFolderAILimit(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_folder_ai_limit', {
      p_user_id: userId,
      p_limit: FOLDER_AI_DAILY_LIMIT
    });

    if (error) {
      console.error('[FolderAI] Error checking limit:', error);
      return true; // Allow on error
    }

    return data === true;
  } catch (err) {
    console.error('[FolderAI] Exception checking limit:', err);
    return true; // Allow on error
  }
}

/**
 * Increment folder AI usage count
 */
async function incrementFolderAIUsage(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_folder_ai_usage', {
      p_user_id: userId
    });

    if (error) {
      console.error('[FolderAI] Error incrementing usage:', error);
    }
  } catch (err) {
    console.error('[FolderAI] Exception incrementing usage:', err);
  }
}

/**
 * Build folder context map (lightweight list of items)
 */
async function buildFolderMap(
  supabase: SupabaseClient,
  folderId: string
): Promise<{ documents: any[]; journals: any[]; folderName: string }> {
  try {
    // Get folder details
    const { data: folder, error: folderError } = await supabase
      .from('chat_folders')
      .select('name')
      .eq('id', folderId)
      .single();

    if (folderError) throw folderError;

    // Get documents (just metadata, not full content)
    const { data: documents, error: docsError } = await supabase
      .from('folder_documents')
      .select('id, file_name, file_type, file_extension, created_at, upload_status')
      .eq('folder_id', folderId)
      .eq('upload_status', 'completed')
      .order('created_at', { ascending: false });

    if (docsError) throw docsError;

    // Get journal entries (just metadata)
    const { data: journals, error: journalsError } = await supabase
      .from('journal_entries')
      .select('id, title, created_at')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (journalsError) throw journalsError;

    return {
      documents: documents || [],
      journals: journals || [],
      folderName: folder?.name || 'Untitled Folder'
    };
  } catch (err) {
    console.error('[FolderAI] Error building folder map:', err);
    throw err;
  }
}

/**
 * Fetch specific documents by IDs
 */
async function fetchDocumentsByIds(
  supabase: SupabaseClient,
  documentIds: string[]
): Promise<any[]> {
  try {
    const { data: documents, error: docsError } = await supabase
      .from('folder_documents')
      .select('id, file_name, content_text, created_at')
      .in('id', documentIds);

    if (docsError) throw docsError;

    const { data: journals, error: journalsError } = await supabase
      .from('journal_entries')
      .select('id, title, entry_text, created_at')
      .in('id', documentIds);

    if (journalsError) throw journalsError;

    return [...(documents || []), ...(journals || [])];
  } catch (err) {
    console.error('[FolderAI] Error fetching documents:', err);
    throw err;
  }
}

/**
 * Get conversation history from folder_ai_messages
 */
async function getConversationHistory(
  supabase: SupabaseClient,
  folderId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('folder_ai_messages')
      .select('role, content, created_at')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: true })
      .limit(MESSAGE_HISTORY_LIMIT);

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('[FolderAI] Error fetching history:', err);
    return [];
  }
}

/**
 * Save message to folder_ai_messages
 */
async function saveMessage(
  supabase: SupabaseClient,
  folderId: string,
  userId: string,
  role: string,
  content: string,
  metadata: any = {}
): Promise<void> {
  try {
    const { error } = await supabase
      .from('folder_ai_messages')
      .insert({
        folder_id: folderId,
        user_id: userId,
        role,
        content,
        metadata
      });

    if (error) {
      console.error('[FolderAI] Error saving message:', error);
    }
  } catch (err) {
    console.error('[FolderAI] Exception saving message:', err);
  }
}

/**
 * Call Gemini API with function calling
 */
async function callGeminiAPI(
  messages: any[],
  tools: any[]
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ENV.GEMINI_MODEL}:generateContent?key=${ENV.GOOGLE_API_KEY}`;

  const payload = {
    contents: messages,
    tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/* ------------------------------ Main Handler ----------------------------- */

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // Parse request
    const body = await req.json();
    const { folder_id, user_id, message, request_documents } = body;

    if (!folder_id || !user_id || !message) {
      return JSON_RESPONSE(400, { error: 'Missing required fields: folder_id, user_id, message' });
    }

    console.log(`[FolderAI] Request ${requestId}: folder=${folder_id}, user=${user_id}`);

    // Create Supabase client
    const supabase = createPooledClient(ENV.SUPABASE_URL!, ENV.SUPABASE_SERVICE_ROLE_KEY!);

    // Check usage limits
    const canProceed = await checkFolderAILimit(supabase, user_id);
    if (!canProceed) {
      return JSON_RESPONSE(429, { 
        error: 'Daily folder AI limit reached',
        limit: FOLDER_AI_DAILY_LIMIT,
        message: 'You have reached your daily limit for folder AI operations. Please try again tomorrow.'
      });
    }

    // Verify folder access
    const { data: folderAccess, error: accessError } = await supabase
      .from('chat_folders')
      .select('id, name')
      .eq('id', folder_id)
      .eq('user_id', user_id)
      .single();

    if (accessError || !folderAccess) {
      return JSON_RESPONSE(403, { error: 'Folder not found or access denied' });
    }

    // Build folder context
    const folderMap = await buildFolderMap(supabase, folder_id);

    // Get conversation history
    const history = await getConversationHistory(supabase, folder_id);

    // Save user message
    await saveMessage(supabase, folder_id, user_id, 'user', message);

    // Build folder map string
    const folderMapString = `Folder: ${folderMap.folderName}

Documents (${folderMap.documents.length}):
${folderMap.documents.map((doc, i) => 
  `${i + 1}. [${doc.id}] ${doc.file_name} (${doc.file_type}) - Created: ${new Date(doc.created_at).toLocaleDateString()}`
).join('\n') || 'No documents'}

Journal Entries (${folderMap.journals.length}):
${folderMap.journals.map((j, i) => 
  `${i + 1}. [${j.id}] ${j.title || 'Untitled'} - Created: ${new Date(j.created_at).toLocaleDateString()}`
).join('\n') || 'No journal entries'}`;

    // Build Gemini messages array
    const geminiMessages: any[] = [];

    // Add system prompt as first user message
    geminiMessages.push({
      role: 'user',
      parts: [{ text: SYSTEM_PROMPT }]
    });
    geminiMessages.push({
      role: 'model',
      parts: [{ text: 'I understand. I am the AI knowledge worker for this folder. I will help you read, analyze, create, and update documents. I will always ask for your approval before saving or modifying anything.' }]
    });

    // Add folder map
    geminiMessages.push({
      role: 'user',
      parts: [{ text: `Here is the current folder map:\n\n${folderMapString}` }]
    });
    geminiMessages.push({
      role: 'model',
      parts: [{ text: `I can see the folder contents. I'm ready to help you work with these ${folderMap.documents.length} documents and ${folderMap.journals.length} journal entries.` }]
    });

    // Add conversation history (if any)
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        geminiMessages.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    // If documents were requested and fetched, add them to context
    if (request_documents && request_documents.length > 0) {
      const fetchedDocs = await fetchDocumentsByIds(supabase, request_documents);
      const docsContent = fetchedDocs.map(doc => {
        const content = doc.content_text || doc.entry_text || '[No text content]';
        return `\n\nDocument: ${doc.file_name || doc.title}\nID: ${doc.id}\nContent:\n${content}`;
      }).join('\n\n---\n');

      geminiMessages.push({
        role: 'user',
        parts: [{ text: `Here are the documents you requested:\n${docsContent}` }]
      });
    }

    // Add current user message
    geminiMessages.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Call Gemini API
    const geminiResponse = await callGeminiAPI(geminiMessages, TOOL_DEFINITIONS);

    // Parse response
    const candidate = geminiResponse.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    const assistantText = candidate.content?.parts?.[0]?.text || '';
    const functionCall = candidate.content?.parts?.[0]?.functionCall;

    // If there's a function call (tool request)
    if (functionCall && functionCall.name === 'fetch_documents') {
      const requestedIds = functionCall.args?.ids || [];
      
      // Save assistant message with tool request metadata
      await saveMessage(supabase, folder_id, user_id, 'assistant', assistantText, {
        tool_call: 'fetch_documents',
        requested_ids: requestedIds
      });

      // Return with tool call indicator
      return JSON_RESPONSE(200, {
        text: assistantText || 'Let me fetch those documents...',
        tool_call: {
          type: 'fetch_documents',
          ids: requestedIds,
          reason: functionCall.args?.reason || 'Fetching documents'
        },
        request_id: requestId,
        latency_ms: Date.now() - startTime
      });
    }

    // Normal response (no tool call)
    await saveMessage(supabase, folder_id, user_id, 'assistant', assistantText);

    // Increment usage (fire-and-forget)
    incrementFolderAIUsage(supabase, user_id).catch(() => {});

    return JSON_RESPONSE(200, {
      text: assistantText,
      request_id: requestId,
      latency_ms: Date.now() - startTime
    });

  } catch (err: any) {
    console.error(`[FolderAI] Error ${requestId}:`, err);
    return JSON_RESPONSE(500, { 
      error: 'Internal server error',
      message: err.message || 'Unknown error',
      request_id: requestId
    });
  }
});

