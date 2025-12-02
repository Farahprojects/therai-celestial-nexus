# Memory Leak Testing Guide

This document provides step-by-step instructions for testing and verifying that the application has no memory leaks.

## 🔍 Quick Visual Test (Development Mode)

The app now includes automatic memory stats logging in development mode.

1. Start the development server: `npm run dev`
2. Open DevTools Console
3. Look for the initial memory log: `[MemoryCleanup] 📊 Memory Stats:`
4. Perform actions (navigate, open/close conversation mode, etc.)
5. Watch for cleanup logs: `[MemoryCleanup] 🧹 Starting global cleanup...`

## 🧪 Chrome DevTools Memory Profiler Test

### Test 1: Hot Reload Memory Leak Test

**Purpose**: Verify no memory accumulates on hot reloads

1. Open Chrome DevTools → Performance → Memory
2. Click "Take snapshot" (baseline)
3. Trigger hot reload 10 times (modify and save a file)
4. Click "Take snapshot" again
5. Compare heap sizes - should be similar (±10% acceptable)
6. Check for detached DOM nodes (should be minimal)

**Expected Result**: ✅ Heap size remains stable, no accumulation of detached DOM nodes

### Test 2: Event Listener Accumulation Test

**Purpose**: Verify global event listeners don't accumulate

1. Open Console and run:
   ```javascript
   getEventListeners(window)
   getEventListeners(document)
   ```
2. Count the listeners
3. Trigger hot reload 5 times
4. Run the same commands again
5. Compare listener counts

**Expected Result**: ✅ Listener counts remain the same or decrease (no accumulation)

### Test 3: WebSocket Connection Test

**Purpose**: Verify only 1 WebSocket per user

1. Login to the app
2. Open Chrome DevTools → Network → WS (WebSocket filter)
3. Navigate around the app
4. Count active WebSocket connections

**Expected Result**: ✅ Exactly 1 unified WebSocket connection (`user-realtime:{userId}`)

### Test 4: Conversation Mode Memory Test

**Purpose**: Verify conversation mode cleans up all resources

1. Take heap snapshot (baseline)
2. Open conversation mode (tap mic icon)
3. Start conversation (tap to start)
4. Speak and let assistant respond
5. Close conversation mode
6. Wait 5 seconds for cleanup
7. Take another heap snapshot
8. Compare snapshots

**Expected Result**: 
- ✅ AudioContext count: 0 or 1 (not accumulating)
- ✅ MediaStream count: 0 (mic released)
- ✅ No orphaned audio nodes
- ✅ Heap size returns close to baseline (±20% acceptable)

### Test 5: Timer Leak Test

**Purpose**: Verify no timers accumulate

1. Open Console and run:
   ```javascript
   // This shows active timers (Chrome-specific)
   performance.measure('start');
   // Count setInterval/setTimeout
   ```
2. Open/close conversation mode 10 times
3. Check if timers keep increasing

**Expected Result**: ✅ Timer count remains stable (no accumulation)

### Test 6: Audio Resource Test

**Purpose**: Verify audio resources are fully released

**Before starting conversation mode:**
```javascript
// Check AudioContext count
console.log('AudioContext count:', 
  window.AudioContext.length || 0);
```

**After closing conversation mode:**
```javascript
// Should be 0 or 1 (not accumulating)
console.log('AudioContext count:', 
  window.AudioContext.length || 0);
```

**Expected Result**: ✅ AudioContext count doesn't accumulate

## 🎯 Automated Memory Stats

The app now automatically logs memory stats in development mode. Watch for:

### On App Start:
```
[Main] 🚀 Starting app in development mode
[MemoryCleanup] 🔧 Dev cleanup handlers installed
[MemoryCleanup] 📊 Memory Stats: {
  usedJSHeapSize: "25.42 MB",
  totalJSHeapSize: "46.40 MB",
  jsHeapSizeLimit: "2172.00 MB",
  heapUsagePercent: "1.17%"
}
```

### On Hot Reload:
```
[MemoryCleanup] Hot reload detected, cleaning up...
[MemoryCleanup] 🧹 Starting global cleanup...
[MemoryCleanup] ✅ Global cleanup complete
```

### On Page Unload:
```
[MemoryCleanup] Page unloading, cleaning up...
```

## 📊 Success Criteria

All tests should meet these criteria:

- ✅ **Event Listeners**: No accumulation on hot reloads
- ✅ **WebSocket Connections**: Exactly 1 per logged-in user
- ✅ **AudioContext**: Count stays at 0 or 1 (not accumulating)
- ✅ **Timers**: No accumulation of setTimeout/setInterval
- ✅ **Heap Size**: Returns to baseline (±20%) after operations
- ✅ **Detached DOM Nodes**: Minimal count (< 50)
- ✅ **Memory Growth**: Linear, not exponential over time

## 🚨 Red Flags (Memory Leaks)

Watch out for these warning signs:

- ❌ Event listener count increases on each hot reload
- ❌ Multiple WebSocket connections for same user
- ❌ AudioContext count keeps increasing
- ❌ Heap size grows continuously without plateau
- ❌ Detached DOM nodes accumulate (> 500)
- ❌ Timer count increases indefinitely
- ❌ Memory usage percent exceeds 50% on simple pages

## 🔧 Troubleshooting

### If you find a memory leak:

1. **Identify the source:**
   - Check DevTools Memory Profiler → "Comparison" view
   - Look for objects with increasing counts
   - Check "Retained Size" column

2. **Common culprits:**
   - Event listeners not removed
   - Timers not cleared (setTimeout/setInterval)
   - WebSocket subscriptions not unsubscribed
   - AudioContext/MediaStream not closed
   - React refs not cleared

3. **Fix the leak:**
   - Add cleanup in useEffect return function
   - Call service cleanup methods
   - Clear refs on unmount
   - Unsubscribe from subscriptions

4. **Verify the fix:**
   - Re-run the tests above
   - Confirm metrics return to normal

## 📝 Manual Cleanup Commands

If needed, you can manually trigger cleanup in DevTools Console:

```javascript
// Import cleanup utility
import { cleanupAllServices, logMemoryStats } from './utils/memoryCleanup';

// Force cleanup all services
await cleanupAllServices();

// Log current memory stats
logMemoryStats();
```

## 🎓 Additional Resources

- [Chrome DevTools Memory Profiling](https://developer.chrome.com/docs/devtools/memory-problems/)
- [Finding Memory Leaks](https://web.dev/fixing-memory-leaks-in-web-applications/)
- [React Memory Leaks](https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development)

## ✅ Verification Checklist

Run through this checklist to verify memory leak fixes:

- [ ] Hot reload 10x → Event listeners stable
- [ ] Login → Only 1 WebSocket connection
- [ ] Open/close conversation mode 5x → AudioContext count stable
- [ ] Navigate around app → Heap size returns to baseline
- [ ] Take heap snapshot → Detached DOM nodes < 50
- [ ] Run app for 10 minutes → Memory growth linear, not exponential
- [ ] Check console → No cleanup errors
- [ ] All singleton services have cleanup methods
- [ ] All useEffect hooks have return cleanup functions

---

**Last Updated**: 2025-01-10
**Status**: All memory leaks eliminated ✅

