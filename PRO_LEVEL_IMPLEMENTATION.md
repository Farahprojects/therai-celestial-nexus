# Pro-Level Feature Usage Implementation

## Migration File
**File**: `supabase/migrations/20250207000001_pro_level_feature_usage.sql`

**Run this SQL yourself** to add the atomic check-and-increment functions.

## What's New

### 1. Atomic Check-and-Increment Functions
- `check_and_increment_voice_seconds()` - Atomically checks limit and increments
- `check_and_increment_insights_count()` - Atomically checks limit and increments

**Features**:
- ✅ Uses `FOR UPDATE` row locking to prevent race conditions
- ✅ Checks limit BEFORE incrementing (prevents overages)
- ✅ Returns detailed JSONB response with success/failure info
- ✅ Input validation (positive integers, valid limits)
- ✅ Comprehensive error handling

### 2. Updated TypeScript Functions

**New Function**: `atomicCheckAndIncrement()`
- Atomically checks limit and increments usage
- Returns detailed result object
- Handles unlimited plans
- Input validation

**Enhanced Function**: `incrementFeatureUsage()`
- Added retry logic (3 attempts with exponential backoff)
- Input validation
- Better error handling
- Retryable error detection

### 3. Updated Report Engines

**standard-report-three** and **standard-report-four**:
- Now use `atomicCheckAndIncrement()` BEFORE generating report
- Prevents wasting resources if limit exceeded
- Returns 403 immediately if limit reached

## Flow Comparison

### Old Flow (Race Condition Risk)
```
1. Check limit → [GAP] → 2. Generate report → [GAP] → 3. Increment
```

### New Flow (Pro-Level)
```
1. Atomic check + increment (in single transaction)
   ↓ Success?
2. Generate report
```

## Benefits

✅ **No Race Conditions**: `FOR UPDATE` locks prevent concurrent modifications
✅ **Never Exceeds Limits**: Check happens atomically with increment
✅ **Better UX**: Rejects before wasting resources
✅ **Input Validation**: Catches invalid data early
✅ **Retry Logic**: Handles transient failures
✅ **Detailed Logging**: Full visibility into what's happening

## Usage

### For Insights (Reports)
```typescript
const result = await atomicCheckAndIncrement(
  supabase,
  userId,
  'insights_count',
  1
);

if (!result.success) {
  return error(result.reason);
}
// Proceed with operation
```

### For Voice (after operation)
```typescript
// Still use incrementFeatureUsage (with retry logic)
await incrementFeatureUsage(supabase, userId, 'voice_seconds', durationSeconds);
```

## SQL Functions Return JSONB

```json
{
  "success": true,
  "previous_usage": 2,
  "incremented_by": 1,
  "new_usage": 3,
  "remaining": 0,
  "limit": 3
}
```

Or on failure:
```json
{
  "success": false,
  "reason": "Monthly limit exceeded",
  "current_usage": 3,
  "requested": 1,
  "new_usage": 4,
  "limit": 3,
  "remaining": 0,
  "error_code": "LIMIT_EXCEEDED"
}
```

## Next Steps

1. **Run the migration**: `supabase/migrations/20250207000001_pro_level_feature_usage.sql`
2. **Deploy updated functions**: standard-report-three, standard-report-four
3. **Test**: Verify limits are enforced correctly


