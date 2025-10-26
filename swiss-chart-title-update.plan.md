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

**File**: `src/components/chat/AstroDataForm.tsx` (line 168-170)

Replace the hardcoded "Swiss Data" with dynamic chart type name:

```typescript
} else if (explicitMode === 'swiss') {
  conversationMode = 'swiss';
  const chartTypeName = getSwissChartDisplayName(reportType || '');
  title = `${data.name} - ${chartTypeName}`;
}
```

Add import at top of file:

```typescript
import { getSwissChartDisplayName } from '@/constants/swissEndpoints';
```

## Result

Conversations will now be titled:

- "John Doe - The Self"
- "Jane Smith - Compatibility"
- "Bob Jones - Weekly Snap"
- "Alice Brown - Daily Shot"

Instead of all showing "Swiss Data".

