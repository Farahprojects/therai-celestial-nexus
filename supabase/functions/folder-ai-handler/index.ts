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
  GEMINI_MODEL: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-pro"
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
IMPORTANT: When you create ANY document, you MUST use this EXACT format with XML tags:

<draft_document>
<title>Week's Emotional Pattern Summary</title>
<content>
...full draft text here in markdown format...
</content>
</draft_document>

NEVER just write the document as plain text in your response. ALWAYS wrap it in <draft_document> tags.

After generating a draft with the XML tags above, say:
"I've created a draft document. It should now be visible in the document canvas on the left. You can review it there, make edits, and save it to the folder when ready."

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
): Promise<{ 
  documents: any[]; 
  journals: any[]; 
  conversations: any[];
  reports: any[];
  folderName: string;
}> {
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

    // Get conversations (chats) in folder
    const { data: conversations, error: convsError } = await supabase
      .from('conversations')
      .select('id, title, mode, created_at')
      .eq('folder_id', folderId)
      .neq('mode', 'profile') // Exclude internal profile conversations
      .order('created_at', { ascending: false });

    if (convsError) throw convsError;

    // Get reports (insights) associated with conversations in this folder
    const conversationIds = (conversations || []).map(c => c.id);
    let reports: any[] = [];
    
    if (conversationIds.length > 0) {
      const { data: reportsData, error: reportsError } = await supabase
        .from('report_logs')
        .select('id, chat_id, report_type, created_at, status')
        .in('chat_id', conversationIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (!reportsError && reportsData) {
        reports = reportsData;
      }
    }

    return {
      documents: documents || [],
      journals: journals || [],
      conversations: conversations || [],
      reports: reports || [],
      folderName: folder?.name || 'Untitled Folder'
    };
  } catch (err) {
    console.error('[FolderAI] Error building folder map:', err);
    throw err;
  }
}

/**
 * Fetch specific documents by IDs
 * Handles documents, journals, conversations (messages), and reports
 */
async function fetchDocumentsByIds(
  supabase: SupabaseClient,
  documentIds: string[]
): Promise<any[]> {
  const fetchId = crypto.randomUUID().substring(0, 8);
  console.log(JSON.stringify({
    event: 'fetchDocumentsByIds_start',
    fetch_id: fetchId,
    requested_ids: documentIds,
    ids_count: documentIds.length
  }));

  try {
    const results: any[] = [];

    // Fetch folder documents
    const { data: documents, error: docsError } = await supabase
      .from('folder_documents')
      .select('id, file_name, content_text, created_at')
      .in('id', documentIds);

    console.log(JSON.stringify({
      event: 'fetch_folder_documents',
      fetch_id: fetchId,
      found: documents?.length || 0,
      error: docsError?.message
    }));

    if (!docsError && documents) {
      results.push(...documents.map(doc => ({
        ...doc,
        type: 'document',
        content: doc.content_text
      })));
    }

    // Fetch journal entries
    const { data: journals, error: journalsError } = await supabase
      .from('journal_entries')
      .select('id, title, entry_text, created_at')
      .in('id', documentIds);

    console.log(JSON.stringify({
      event: 'fetch_journals',
      fetch_id: fetchId,
      found: journals?.length || 0,
      error: journalsError?.message
    }));

    if (!journalsError && journals) {
      results.push(...journals.map(j => ({
        ...j,
        type: 'journal',
        content: j.entry_text
      })));
    }

    // Fetch conversation messages (if IDs are conversation IDs)
    const { data: conversations, error: convsError } = await supabase
      .from('conversations')
      .select('id, title, mode, created_at')
      .in('id', documentIds);

    console.log(JSON.stringify({
      event: 'fetch_conversations',
      fetch_id: fetchId,
      found: conversations?.length || 0,
      error: convsError?.message
    }));

    if (!convsError && conversations) {
      // For each conversation, fetch recent messages
      for (const conv of conversations) {
        const { data: messages, error: msgsError } = await supabase
          .from('messages')
          .select('role, text, created_at')
          .eq('chat_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(20); // Last 20 messages

        console.log(JSON.stringify({
          event: 'fetch_conversation_messages',
          fetch_id: fetchId,
          conversation_id: conv.id,
          messages_found: messages?.length || 0,
          error: msgsError?.message
        }));

        if (!msgsError && messages) {
          const messageText = messages
            .map(m => `${m.role}: ${m.text}`)
            .join('\n\n');

          results.push({
            id: conv.id,
            title: conv.title || 'Untitled Conversation',
            mode: conv.mode,
            created_at: conv.created_at,
            type: 'conversation',
            content: messageText,
            message_count: messages.length
          });
        }
      }
    }

    // Fetch reports
    const { data: reports, error: reportsError } = await supabase
      .from('report_logs')
      .select('id, chat_id, report_type, report_text, created_at')
      .in('id', documentIds);

    console.log(JSON.stringify({
      event: 'fetch_reports',
      fetch_id: fetchId,
      found: reports?.length || 0,
      error: reportsError?.message
    }));

    if (!reportsError && reports) {
      results.push(...reports.map(r => ({
        ...r,
        type: 'report',
        content: r.report_text
      })));
    }

    console.log(JSON.stringify({
      event: 'fetchDocumentsByIds_complete',
      fetch_id: fetchId,
      total_results: results.length,
      result_types: results.map(r => r.type)
    }));

    return results;
  } catch (err) {
    console.error(JSON.stringify({
      event: 'fetchDocumentsByIds_error',
      fetch_id: fetchId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    }));
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
      thinkingConfig: { thinkingBudget: -1 }
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
    const supabase = createPooledClient();

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
).join('\n') || 'No journal entries'}

Conversations (${folderMap.conversations.length}):
${folderMap.conversations.map((c, i) => 
  `${i + 1}. [${c.id}] ${c.title || 'Untitled'} (${c.mode || 'chat'}) - Created: ${new Date(c.created_at).toLocaleDateString()}`
).join('\n') || 'No conversations'}

Reports/Insights (${folderMap.reports.length}):
${folderMap.reports.map((r, i) => 
  `${i + 1}. [${r.id}] ${r.report_type || 'Insight'} - Created: ${new Date(r.created_at).toLocaleDateString()}`
).join('\n') || 'No reports'}`;

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
    const totalItems = folderMap.documents.length + folderMap.journals.length + folderMap.conversations.length + folderMap.reports.length;
    geminiMessages.push({
      role: 'model',
      parts: [{ text: `I can see the folder contents. I'm ready to help you work with ${totalItems} items: ${folderMap.documents.length} documents, ${folderMap.journals.length} journal entries, ${folderMap.conversations.length} conversations, and ${folderMap.reports.length} reports.` }]
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
    console.log(JSON.stringify({
      event: 'gemini_first_call',
      request_id: requestId,
      message_count: geminiMessages.length,
      has_request_documents: !!request_documents
    }));

    const geminiResponse = await callGeminiAPI(geminiMessages, TOOL_DEFINITIONS);

    console.log(JSON.stringify({
      event: 'gemini_first_response',
      request_id: requestId,
      has_candidates: !!geminiResponse.candidates?.length,
      candidate_count: geminiResponse.candidates?.length || 0
    }));

    // Parse response
    const candidate = geminiResponse.candidates?.[0];
    if (!candidate) {
      console.error(JSON.stringify({
        event: 'gemini_no_candidate',
        request_id: requestId,
        response: JSON.stringify(geminiResponse)
      }));
      throw new Error('No response from Gemini');
    }

    let assistantText = candidate.content?.parts?.[0]?.text || '';
    const functionCall = candidate.content?.parts?.[0]?.functionCall;

    console.log(JSON.stringify({
      event: 'gemini_response_parsed',
      request_id: requestId,
      text_length: assistantText.length,
      text_preview: assistantText.substring(0, 200),
      has_function_call: !!functionCall,
      function_name: functionCall?.name
    }));

    // If there's a function call (tool request via Gemini function calling)
    if (functionCall && functionCall.name === 'fetch_documents') {
      const requestedIds = functionCall.args?.ids || [];
      
      console.log(JSON.stringify({
        event: 'function_call_detected',
        request_id: requestId,
        function_name: functionCall.name,
        requested_ids: requestedIds,
        ids_count: requestedIds.length
      }));
      
      // Save assistant message with tool request metadata
      await saveMessage(supabase, folder_id, user_id, 'assistant', assistantText, {
        tool_call: 'fetch_documents',
        requested_ids: requestedIds
      });

      // Fetch documents and continue automatically
      console.log(JSON.stringify({
        event: 'fetching_documents_start',
        request_id: requestId,
        ids: requestedIds
      }));

      const fetchStartTime = Date.now();
      const fetchedDocs = await fetchDocumentsByIds(supabase, requestedIds);
      const fetchDuration = Date.now() - fetchStartTime;

      console.log(JSON.stringify({
        event: 'fetching_documents_complete',
        request_id: requestId,
        documents_found: fetchedDocs.length,
        fetch_duration_ms: fetchDuration,
        document_ids: fetchedDocs.map(d => d.id),
        document_types: fetchedDocs.map(d => d.type || 'unknown')
      }));

      const docsContent = fetchedDocs.map(doc => {
        const content = doc.content || doc.content_text || doc.entry_text || '[No text content]';
        const contentLength = content.length;
        return `\n\nDocument: ${doc.file_name || doc.title || 'Untitled'}\nID: ${doc.id}\nType: ${doc.type || 'unknown'}\nContent:\n${content}`;
      }).join('\n\n---\n');

      console.log(JSON.stringify({
        event: 'documents_formatted',
        request_id: requestId,
        total_content_length: docsContent.length,
        content_preview: docsContent.substring(0, 500)
      }));

      // Add fetched documents to context
      geminiMessages.push({
        role: 'model',
        parts: [{ text: assistantText }]
      });
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `Here are the documents you requested:\n${docsContent}\n\nPlease analyze these and provide your response.` }]
      });

      console.log(JSON.stringify({
        event: 'gemini_second_call_start',
        request_id: requestId,
        message_count: geminiMessages.length
      }));

      // Call Gemini again with the fetched documents
      const secondResponseStart = Date.now();
      const secondResponse = await callGeminiAPI(geminiMessages, TOOL_DEFINITIONS);
      const secondResponseDuration = Date.now() - secondResponseStart;

      console.log(JSON.stringify({
        event: 'gemini_second_response',
        request_id: requestId,
        has_candidates: !!secondResponse.candidates?.length,
        duration_ms: secondResponseDuration
      }));

      const secondCandidate = secondResponse.candidates?.[0];
      if (secondCandidate) {
        const newText = secondCandidate.content?.parts?.[0]?.text || '';
        console.log(JSON.stringify({
          event: 'gemini_second_response_parsed',
          request_id: requestId,
          new_text_length: newText.length,
          new_text_preview: newText.substring(0, 300)
        }));
        assistantText = newText;
      } else {
        console.warn(JSON.stringify({
          event: 'gemini_second_no_candidate',
          request_id: requestId,
          using_original_text: true
        }));
      }
    }

    // Check if the text response contains XML document request tags
    // More robust regex with multiline and whitespace handling
    const xmlRequestMatch = assistantText.match(/<request_documents>[\s\S]*?<ids>\s*\[([\s\S]*?)\]\s*<\/ids>[\s\S]*?<reason>([\s\S]*?)<\/reason>[\s\S]*?<\/request_documents>/);
    
    console.log(JSON.stringify({
      event: 'checking_xml_tags',
      request_id: requestId,
      has_xml_match: !!xmlRequestMatch,
      text_contains_request: assistantText.includes('<request_documents>'),
      raw_text_preview: assistantText.substring(0, 500)
    }));

    if (xmlRequestMatch) {
      try {
        const idsString = xmlRequestMatch[1];
        const ids = idsString.split(',').map(id => id.trim().replace(/['"]/g, ''));
        const reason = xmlRequestMatch[2]?.trim() || 'No reason provided';
        
        console.log(JSON.stringify({
          event: 'xml_request_detected',
          request_id: requestId,
          ids_string: idsString,
          parsed_ids: ids,
          ids_count: ids.length,
          reason: reason
        }));
        
        // Save the request message
        await saveMessage(supabase, folder_id, user_id, 'assistant', assistantText, {
          xml_request: 'fetch_documents',
          requested_ids: ids
        });

        console.log(JSON.stringify({
          event: 'fetching_documents_xml_start',
          request_id: requestId,
          ids: ids
        }));

        // Fetch documents
        const fetchStartTime = Date.now();
        const fetchedDocs = await fetchDocumentsByIds(supabase, ids);
        const fetchDuration = Date.now() - fetchStartTime;

        console.log(JSON.stringify({
          event: 'fetching_documents_xml_complete',
          request_id: requestId,
          documents_found: fetchedDocs.length,
          fetch_duration_ms: fetchDuration,
          document_ids: fetchedDocs.map(d => d.id),
          document_types: fetchedDocs.map(d => d.type || 'unknown'),
          document_titles: fetchedDocs.map(d => d.file_name || d.title || 'Untitled')
        }));

        if (fetchedDocs.length === 0) {
          console.warn(JSON.stringify({
            event: 'no_documents_found',
            request_id: requestId,
            requested_ids: ids
          }));
        }

        const docsContent = fetchedDocs.map(doc => {
          const content = doc.content || doc.content_text || doc.entry_text || '[No text content]';
          const contentLength = content.length;
          return `\n\nDocument: ${doc.file_name || doc.title || 'Untitled'}\nID: ${doc.id}\nType: ${doc.type || 'unknown'}\nContent:\n${content}`;
        }).join('\n\n---\n');

        console.log(JSON.stringify({
          event: 'documents_formatted_xml',
          request_id: requestId,
          total_content_length: docsContent.length,
          content_preview: docsContent.substring(0, 500)
        }));

        // Add to context and continue
        geminiMessages.push({
          role: 'model',
          parts: [{ text: assistantText }]
        });
        geminiMessages.push({
          role: 'user',
          parts: [{ text: `Here are the documents you requested:\n${docsContent}\n\nPlease analyze these and provide your response.` }]
        });

        console.log(JSON.stringify({
          event: 'gemini_continued_call_start',
          request_id: requestId,
          message_count: geminiMessages.length
        }));

        // Call Gemini again
        const continuedResponseStart = Date.now();
        const continuedResponse = await callGeminiAPI(geminiMessages, TOOL_DEFINITIONS);
        const continuedResponseDuration = Date.now() - continuedResponseStart;

        console.log(JSON.stringify({
          event: 'gemini_continued_response',
          request_id: requestId,
          has_candidates: !!continuedResponse.candidates?.length,
          duration_ms: continuedResponseDuration
        }));

        const continuedCandidate = continuedResponse.candidates?.[0];
        if (continuedCandidate) {
          const newText = continuedCandidate.content?.parts?.[0]?.text || '';
          console.log(JSON.stringify({
            event: 'gemini_continued_response_parsed',
            request_id: requestId,
            new_text_length: newText.length,
            new_text_preview: newText.substring(0, 300)
          }));
          // Use the continued response
          assistantText = newText;
          
          // Check if the continued response ALSO has a document request (nested requests)
          const nestedMatch = newText.match(/<request_documents>[\s\S]*?<ids>\s*\[([\s\S]*?)\]\s*<\/ids>[\s\S]*?<reason>([\s\S]*?)<\/reason>[\s\S]*?<\/request_documents>/);
          if (nestedMatch) {
            console.warn(JSON.stringify({
              event: 'nested_document_request_detected',
              request_id: requestId,
              message: 'AI requested more documents in continued response - this needs another iteration'
            }));
            // For now, we'll return the current response and let the user trigger the next fetch
            // In a future enhancement, we could loop here
          }
        } else {
          console.warn(JSON.stringify({
            event: 'gemini_continued_no_candidate',
            request_id: requestId,
            using_original_text: true
          }));
        }
      } catch (parseError) {
        console.error(JSON.stringify({
          event: 'xml_parse_error',
          request_id: requestId,
          error: parseError instanceof Error ? parseError.message : String(parseError),
          stack: parseError instanceof Error ? parseError.stack : undefined
        }));
        // Continue with original response
      }
    }
    
    // Strip any remaining XML request tags from final response
    // This ensures the user doesn't see the raw XML
    assistantText = assistantText.replace(/<request_documents>[\s\S]*?<\/request_documents>/g, '').trim();

    // Save final assistant response
    console.log(JSON.stringify({
      event: 'saving_final_response',
      request_id: requestId,
      response_length: assistantText.length,
      response_preview: assistantText.substring(0, 200)
    }));

    await saveMessage(supabase, folder_id, user_id, 'assistant', assistantText);

    // Increment usage (fire-and-forget)
    incrementFolderAIUsage(supabase, user_id).catch(() => {});

    const totalLatency = Date.now() - startTime;
    console.log(JSON.stringify({
      event: 'request_complete',
      request_id: requestId,
      total_latency_ms: totalLatency,
      final_response_length: assistantText.length
    }));

    return JSON_RESPONSE(200, {
      text: assistantText,
      request_id: requestId,
      latency_ms: totalLatency
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

