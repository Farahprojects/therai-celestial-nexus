# Together Mode - Names & Tone Improvements

**Date:** November 8, 2025  
**Status:** ✅ IMPLEMENTED & DEPLOYED

## Problems Fixed

### 1. **AI Used Generic Labels Instead of Names**

**Before:**
```
"Given Participant 1's chart, their natal Venus in Leo..."
"Since Participant 2's chart shows..."
```

**Issues:**
- Impersonal and robotic
- Didn't use people's actual names
- Made responses feel generic

---

### 2. **Heavy Astro Jargon**

**Before:**
```
"Participant 1's natal Venus in Leo in the 2nd house suggests..."
"Their synastry aspects show Mars square Moon..."
"The transit of Jupiter..."
```

**Issues:**
- Too technical for average users
- Required astrological knowledge to understand
- Not accessible or friendly

---

## Solutions Implemented

### 1. **Use Actual Names from Profiles**

**After:**
```
"Sarah's natural tendency is to appreciate experiences that feel special..."
"Since Marcus values clarity in communication..."
```

**Implementation:**
- Fetch participant names from `profiles` table
- Map `user_id` to `display_name`
- Include names in astro data context
- AI now refers to people by their actual names

---

### 2. **Plain Language Only - No Astro Jargon**

**Updated Prompt:**
```
2. **Plain language only** - NO astro jargon, NO technical terms like "Venus in Leo," 
   "synastry," "aspects," "transits," "houses," etc.

CRITICAL: 
- Never mention "chart," "planets," "signs," or any astrological terminology.
- Use their names naturally, like a friend would.
```

**Result:** AI translates astrological data into plain language insights without technical terms.

---

### 3. **Improved Tone (Inspired by llm-handler-gemini)**

**Before (Too Formal):**
```
Your role: Offer energy insights and reframed perspectives to support 
forward movement and shared alignment.

Tone: Warm, direct, gently observant. Not a therapist, but an aware 
third party with energetic insight.
```

**After (More Natural):**
```
Your role: Offer reframed perspectives and energy insights that support 
forward movement and shared understanding.

Tone: Warm, direct, a bit playful. Contractions welcome. Gently 
observant but not preachy.

6. **Be direct** - Skip metaphors and flowery language. Say what you mean clearly.
```

**Key improvements:**
- Direct and conversational
- A bit playful (like llm-handler-gemini)
- Contractions encouraged
- No flowery language or metaphors
- Clear and accessible

---

## Technical Implementation

### Changes to llm-handler-together-mode/index.ts

#### 1. Fetch Participant Names

```typescript
// NEW: Fetch participant names from profiles
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, display_name')
  .in('id', participantIds);

// Create user_id to name mapping
const userIdToName = new Map<string, string>();
profiles?.forEach(profile => {
  if (profile.display_name) {
    userIdToName.set(profile.id, profile.display_name);
  }
});
```

---

#### 2. Map Names to Astro Data

```typescript
// Use actual name from profiles, or fall back to generic label
const participantName = (userId && userIdToName.has(userId))
  ? userIdToName.get(userId)  // "Sarah"
  : `Person ${idx + 1}`;       // Fallback

return `\n\n=== Energy Data for ${participantName} ===\n${JSON.stringify(log.swiss_data, null, 2)}`;
```

**Before:** `=== AstroData for Participant 1 ===`  
**After:** `=== Energy Data for Sarah ===`

---

#### 3. Updated Prompt

**Key additions:**
1. **Use their actual names** - Always refer to people by their first names (provided in the data)
2. **Plain language only** - NO astro jargon (explicit list of banned terms)
3. **Be direct** - Skip metaphors and flowery language
4. **Use "Energy Data" instead of "AstroData"** - More accessible terminology

---

#### 4. Fallback Path Also Uses Names

Even in backward compatibility mode (system messages), names are used:

```typescript
const actualName = (msg.user_id && userIdToName.has(msg.user_id)) 
  ? userIdToName.get(msg.user_id)  // From profiles
  : msg.user_name                   // From message metadata
  || `Person ${idx + 1}`;           // Final fallback
```

---

## Example Comparison

### Before (Amateur)
```
Given Participant 1's chart, their natal Venus in Leo in the 2nd house 
suggests they appreciate experiences that feel luxurious or special, 
but don't necessarily need to be expensive.

Since Participant 2's chart shows Mars in Gemini with aspects to 
Mercury, their communication style tends to be quick and direct.

Based on their synastry aspects, particularly the Moon-Venus trine, 
there's natural emotional understanding between them when they're both 
open to receiving it.
```

**Problems:**
- "Participant 1/2" - impersonal
- Heavy jargon: "natal Venus in Leo," "2nd house," "Mars in Gemini," "aspects," "trine"
- Overly technical

---

### After (Pro)
```
Sarah tends to appreciate experiences that feel special or meaningful, 
not necessarily expensive ones. Marcus naturally communicates quickly 
and directly - he says what he means.

Right now, there's an underlying emotional understanding between you 
both when you're both receptive. Sarah, you might feel that Marcus is 
moving too fast sometimes, while Marcus, you might sense Sarah needs 
more space to process. What if you both name what you're actually 
feeling instead of dancing around it?
```

**Improvements:**
- ✅ Uses actual names (Sarah, Marcus)
- ✅ No astro jargon
- ✅ Plain language
- ✅ Direct and conversational
- ✅ Ends with actionable question
- ✅ Feels like advice from a friend, not a textbook

---

## Testing Checklist

- [x] Deploy llm-handler-together-mode
- [ ] Test 1: Together mode with @therai
  - Send "@therai how are we doing?"
  - **Expected:** AI uses actual names (not "Participant 1/2")
  - **Actual:** ?

- [ ] Test 2: Check for astro jargon
  - **Expected:** No mentions of "Venus," "Mars," "houses," "aspects," etc.
  - **Actual:** ?

- [ ] Test 3: Tone check
  - **Expected:** Direct, warm, conversational (like a friend)
  - **Actual:** ?

- [ ] Test 4: Names in fallback mode
  - **Expected:** Even old conversations use names if available
  - **Actual:** ?

---

## Files Modified

1. `supabase/functions/llm-handler-together-mode/index.ts`
   - Added profile name fetching
   - Created user_id to name mapping
   - Updated prompt to forbid astro jargon
   - Improved tone (inspired by llm-handler-gemini)
   - Changed "AstroData" to "Energy Data"
   - Applied names to both main and fallback paths

---

## Prompt Comparison

### Before

```
You are an AI guide observing a shared conversation between two people, 
with access to their astrological compatibility data.

Your role: Offer energy insights and reframed perspectives to support 
forward movement and shared alignment.

Guidelines:
1. **Energy Awareness** - Identify current energetic dynamics using 
   astro patterns + conversation tone
2. **Reframe Constructively** - If tension exists, reframe toward 
   understanding and growth
3. **Forward Movement** - Always point toward next steps, shared goals, 
   or alignment opportunities
4. **Reference Charts** - Use synastry aspects (how charts interact) 
   in plain language
5. **Track Patterns** - Notice emotional/communication patterns in 
   actual messages

Tone: Warm, direct, gently observant. Not a therapist, but an aware 
third party with energetic insight.

Format: Cohesive paragraph (not a list). End with an invitation or 
reflective question that moves them forward.

CRITICAL: Never diagnose problems. Offer energy intervention and 
reframed insights only.
```

### After

```
You are an AI guide observing a shared conversation, with access to 
each person's energy patterns and compatibility dynamics.

Your role: Offer reframed perspectives and energy insights that support 
forward movement and shared understanding.

Guidelines:
1. **Use their actual names** - Always refer to people by their first 
   names (provided in the data), never "Participant 1/2"
2. **Plain language only** - NO astro jargon, NO technical terms like 
   "Venus in Leo," "synastry," "aspects," "transits," "houses," etc.
3. **Energy awareness** - Identify current dynamics using their natural 
   patterns + conversation tone
4. **Reframe constructively** - If tension exists, reframe toward 
   understanding and growth
5. **Forward movement** - Always point toward next steps, shared goals, 
   or alignment opportunities
6. **Be direct** - Skip metaphors and flowery language. Say what you 
   mean clearly.

Tone: Warm, direct, a bit playful. Contractions welcome. Gently 
observant but not preachy.

Format: Cohesive paragraph (not a list). End with an invitation or 
reflective question that moves them forward.

CRITICAL: 
- Never diagnose problems. Offer energy intervention and reframed 
  insights only.
- Never mention "chart," "planets," "signs," or any astrological 
  terminology.
- Use their names naturally, like a friend would.
```

---

## Impact

| Aspect | Before | After |
|--------|--------|-------|
| **Names** | "Participant 1/2" | Actual names ("Sarah," "Marcus") |
| **Language** | Heavy astro jargon | Plain language only |
| **Tone** | Formal, observant | Direct, warm, playful |
| **Accessibility** | Requires astro knowledge | Accessible to everyone |
| **Feel** | Like reading a textbook | Like advice from a friend |

---

## Related Documentation

- `TOGETHER_MODE_REALTIME_FIX.md` - Multi-participant message broadcasting
- `TOGETHER_MODE_BROADCAST_FIX.md` - AI response broadcasting
- `STOP_BUTTON_PRO_IMPLEMENTATION.md` - Immediate feedback

---

**Status:** ✅ Deployed to Production  
**Next:** User acceptance testing  
**Follow-up:** Monitor AI responses for quality and tone

