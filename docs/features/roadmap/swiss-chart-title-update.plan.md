<!-- b37fbaf8-1944-45d3-a479-7ad677aebacf 18050488-1c40-4584-b285-98e1a0efabe9 -->
# Update Swiss Conversation Titles

## Problem

Currently, all Swiss chart conversations are titled "[username] - Swiss Data" regardless of the chart type. Need to replace "Swiss Data" with the specific chart type name.

## Chart Type Mappings

From `SwissChartSelector.tsx`:

- `essence` → "The Self"
- `sync` → "Compatibility"
- `weekly` → "Weekly Snap"
- `focus` → "Daily Shot"

## Changes Required

### 1. Create Chart Type Name Mapping

**File**: `src/constants/swissEndpoints.ts`

Add a helper function to map chart IDs to display names:

```typescript
export const getSwissChartDisplayName = (chartId: string): string => {
  const chartType = SWISS_CHART_TYPES.find(ct => ct.id === chartId);
  return chartType?.name || 'Swiss Data';
};
```

### 2. Update Conversation Title Generation

**File**: `src/components/chat/AstroDataForm.tsx`

Use `request` field (via selectedAstroType) instead of reportType for title generation, and ensure reportType is null for Swiss mode:

```typescript
} else if (explicitMode === 'swiss') {
  conversationMode = 'swiss';
  const chartTypeName = getSwissChartDisplayName(selectedAstroType || '');
  title = `${data.name} - ${chartTypeName}`;
}

// For Swiss mode, explicitly set reportType to null to skip orchestrator
const payloadToSend = explicitMode === 'swiss' 
  ? { 
      ...payload, 
      report_data: { 
        ...payload.report_data, 
        reportType: null 
      }
    }
  : { reportType, ...payload };

const currentChatId = await createConversation(conversationMode, 
  title,
  payloadToSend
);
```

Add import at top of file:

```typescript
import { getSwissChartDisplayName } from '@/constants/swissEndpoints';
```

### 3. Remove request_id from initiate-auth-report

**File**: `supabase/functions/initiate-auth-report/index.ts`

Remove the request_id generation since chat_id is already used for tracking:

```typescript
// Remove this line:
request_id: crypto.randomUUID().slice(0, 8),
```

## Result

Conversations will now be titled:

- "John Doe - The Self"
- "Jane Smith - Compatibility"
- "Bob Jones - Weekly Snap"
- "Alice Brown - Daily Shot"

Instead of all showing "Swiss Data".

