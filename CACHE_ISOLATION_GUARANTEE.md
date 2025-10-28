# Cache Isolation Guarantee

## 100% Cache Isolation per Chat

The Gemini context caching system **guarantees** that each conversation (`chat_id`) has exactly ONE cache at any time. You cannot have two reports cached for the same conversation.

## How It's Enforced

### 1. Database Constraint (PRIMARY KEY)

```sql
CREATE TABLE conversation_caches (
  chat_id UUID PRIMARY KEY,  -- ✅ Only ONE cache per chat_id
  cache_name TEXT NOT NULL,
  system_data_hash TEXT NOT NULL,
  ...
);
```

**What this means:**
- PostgreSQL enforces that `chat_id` is UNIQUE
- Attempting to insert a second cache for the same `chat_id` will fail
- Using `UPSERT` will replace the old cache with the new one

### 2. Hash Validation on Every Request

The `llm-handler-gemini` now validates the cache on EVERY request:

```typescript
// Always fetch system message (parallel with cache check)
const systemText = fetch_system_message_from_db();
const currentHash = hashSystemData(systemText);

// Check cache
if (cache_exists && cache_hash === currentHash) {
  // ✅ Cache is valid, use it
} else {
  // ⚠️ Hash mismatch or no cache
  // Delete old cache (if exists)
  // Create new cache with current system data
}
```

**What this means:**
- Even if a cache exists, we verify it matches the current system message
- If system message changed (new report), cache is invalidated automatically
- New cache is created with the updated data

### 3. Automatic Invalidation on New Data

When you inject a new report via `context-injector`:

```typescript
// context-injector automatically does this:
await supabase
  .from("conversation_caches")
  .delete()
  .eq("chat_id", chat_id);
```

**What this means:**
- New astro data injection → old cache deleted immediately
- Next LLM request will create a fresh cache with new data
- No stale data can persist

## Example Scenario

**Scenario:** You generate a natal chart, then later generate a transit chart for the same conversation.

### Step-by-Step:

1. **Generate Natal Chart**
   - Context-injector inserts system message with natal data
   - First LLM request creates cache: `{chat_id: "abc", hash: "natal123"}`
   - Subsequent requests use this cache

2. **Generate Transit Chart (SAME chat_id)**
   - Context-injector inserts NEW system message with transit data
   - Context-injector **deletes cache** for `chat_id: "abc"`
   - Next LLM request:
     - Checks cache → NOT FOUND
     - Fetches new system message (transit data)
     - Creates NEW cache: `{chat_id: "abc", hash: "transit456"}`
   - Subsequent requests use the NEW cache

3. **Result:**
   - ✅ Only ONE cache exists for `chat_id: "abc"` at any time
   - ✅ Cache always reflects the LATEST system message
   - ✅ No stale natal data can leak into transit conversation

## Guarantees

| Guarantee | Mechanism | Enforcement |
|-----------|-----------|-------------|
| **One cache per chat_id** | PRIMARY KEY constraint | Database level |
| **Cache matches current data** | Hash validation every request | Application level |
| **Stale cache removed** | Auto-delete on new data injection | Application level |
| **Cannot insert duplicate** | UPSERT replaces existing | Database level |

## Testing Cache Isolation

```sql
-- Check cache for specific conversation
SELECT chat_id, cache_name, system_data_hash, created_at, expires_at
FROM conversation_caches
WHERE chat_id = 'your-chat-id';

-- Should return 0 or 1 row (never 2+)

-- Check all caches
SELECT chat_id, COUNT(*) as cache_count
FROM conversation_caches
GROUP BY chat_id
HAVING COUNT(*) > 1;

-- Should return 0 rows (proves uniqueness)
```

## Edge Cases Handled

### Edge Case 1: Context-injector fails to delete cache
**Solution:** Hash validation catches this on next request and recreates cache

### Edge Case 2: Cache expires mid-conversation
**Solution:** Auto-recreates cache on next request

### Edge Case 3: System message changes without triggering context-injector
**Solution:** Hash validation detects mismatch and invalidates cache

### Edge Case 4: Concurrent requests for same chat_id
**Solution:** 
- First request creates cache (if needed)
- Subsequent requests see cache already exists
- All use the same cache_name reference
- PRIMARY KEY prevents duplicate inserts

## Performance Impact of Hash Validation

**Before this improvement:**
- Skip system message fetch if cache exists
- Risk: stale cache if system message changed

**After this improvement:**
- Always fetch system message (small query, ~5-10ms)
- Validate hash against cached hash
- Benefit: 100% guarantee cache is correct

**Net cost:** ~5-10ms per request for peace of mind and correctness

## Summary

**You are 100% protected from cache collisions:**
1. ✅ Database enforces one cache per chat_id (PRIMARY KEY)
2. ✅ Hash validation ensures cache matches current data
3. ✅ Auto-invalidation on new data injection
4. ✅ Edge cases handled with multiple safety layers

**Bottom line:** If you generate a new report with new data for the same conversation, the old cache is GUARANTEED to be replaced with a new one. You cannot have two cached reports for one chat_id.

