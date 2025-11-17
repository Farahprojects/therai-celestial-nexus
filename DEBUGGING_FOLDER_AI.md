# Debugging Folder AI Document Requests

## How the Auto-Fetch Works

When the AI requests documents, the system should automatically:

1. **Detect Request** - Match XML tags using robust regex
2. **Fetch Documents** - Query database for requested IDs
3. **Inject Content** - Add documents to conversation context
4. **Continue** - Call Gemini again with the documents
5. **Return Analysis** - User sees the complete answer

## What to Check in Logs

### Supabase Edge Function Logs

Go to: **Supabase Dashboard → Edge Functions → folder-ai-handler → Logs**

Look for these events in sequence:

```json
{"event": "gemini_first_response", "has_candidates": true}
{"event": "gemini_response_parsed", "text_preview": "..."}
{"event": "checking_xml_tags", "has_xml_match": true}
{"event": "xml_request_detected", "parsed_ids": [...]}
{"event": "fetching_documents_xml_start"}
{"event": "fetchDocumentsByIds_start"}
{"event": "fetch_folder_documents", "found": 1}
{"event": "fetch_conversations", "found": 2}
{"event": "fetching_documents_xml_complete", "documents_found": 3}
{"event": "documents_formatted_xml", "total_content_length": 5432}
{"event": "gemini_continued_call_start"}
{"event": "gemini_continued_response", "has_candidates": true}
{"event": "gemini_continued_response_parsed", "new_text_length": 1234}
{"event": "saving_final_response"}
{"event": "request_complete"}
```

## If the AI Stops After Requesting Documents

### Check These Logs:

1. **`checking_xml_tags`** - Does `has_xml_match` = true?
   - If false, the regex didn't match → XML format issue
   
2. **`xml_request_detected`** - Are the `parsed_ids` correct?
   - If empty, the ID parsing failed
   
3. **`fetching_documents_xml_complete`** - How many `documents_found`?
   - If 0, the IDs don't exist in the database
   
4. **`gemini_continued_call_start`** - Did the second call happen?
   - If missing, something failed before the second call
   
5. **`gemini_continued_response_parsed`** - What's the `new_text_length`?
   - If 0 or very small, Gemini didn't respond properly

## Common Issues

### Issue 1: XML Not Matching
**Symptom**: `has_xml_match: false` but text contains `<request_documents>`

**Cause**: XML format variation (extra spaces, newlines, etc.)

**Fix**: The regex now uses `[\s\S]*?` which handles all whitespace and newlines

### Issue 2: No Documents Found
**Symptom**: `documents_found: 0`

**Cause**: Document IDs don't exist or wrong table

**Fix**: Check that the IDs in the folder map match the IDs in the database

### Issue 3: Second Call Fails
**Symptom**: Logs stop at `gemini_continued_call_start`

**Cause**: Gemini API error, timeout, or rate limit

**Fix**: Check for API errors in the logs, increase timeout if needed

### Issue 4: Empty Continued Response
**Symptom**: `new_text_length: 0`

**Cause**: Gemini returned no text (blocked by safety, etc.)

**Fix**: Check `gemini_continued_response` for error details

## Manual Testing

### Test the Edge Function Directly

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/folder-ai-handler \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "folder_id": "YOUR_FOLDER_ID",
    "user_id": "YOUR_USER_ID",
    "message": "Analyze the conversation about compatibility"
  }'
```

Watch the Supabase logs in real-time while this runs.

## Expected Behavior

### Good Flow:
1. User: "Analyze the compatibility conversation"
2. AI: (internally) "I need to fetch document X, Y, Z"
3. Backend: Fetches X, Y, Z automatically
4. Backend: Calls Gemini again with X, Y, Z content
5. AI: "Based on the compatibility conversation, here's my analysis..."
6. User: Sees complete analysis immediately

### Bad Flow (Old Behavior):
1. User: "Analyze the compatibility conversation"
2. AI: Shows XML request tags
3. AI: STOPS ❌
4. User: Confused, nothing happens

## How to Force a Clean Test

1. Clear the folder AI messages:
   ```sql
   DELETE FROM folder_ai_messages WHERE folder_id = 'YOUR_FOLDER_ID';
   ```

2. Restart the conversation with "New Chat" button

3. Ask the AI to analyze a specific document

4. Watch the Supabase logs

## Regex Pattern Explained

```javascript
/<request_documents>[\s\S]*?<ids>\s*\[([\s\S]*?)\]\s*<\/ids>[\s\S]*?<reason>([\s\S]*?)<\/reason>[\s\S]*?<\/request_documents>/
```

- `[\s\S]*?` = Match any character including newlines (non-greedy)
- `\s*` = Match any amount of whitespace
- Handles formats like:
  - `<ids>["id1", "id2"]</ids>` (inline)
  - ```
    <ids>
      ["id1", "id2"]
    </ids>
    ```
  - `<ids>  [  "id1"  ,  "id2"  ]  </ids>` (extra spaces)

## Recent Improvements

- ✅ Robust multiline regex matching
- ✅ Better whitespace handling
- ✅ XML stripping from final response
- ✅ Nested request detection
- ✅ Comprehensive logging at every step
- ✅ Error recovery and fallbacks

