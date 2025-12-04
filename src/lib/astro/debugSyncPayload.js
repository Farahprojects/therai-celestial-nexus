// 60-second verification script for Sync UI debugging
// Paste this in the browser console on the Relationship page

function debugSyncPayload(payload) {
  // Debug function - all logging removed for security
}

// Usage examples:
// debugSyncPayload(window.__ASTRO_SYNC_PAYLOAD__);
// debugSyncPayload(payload);
// debugSyncPayload(swissData);

window.debugSyncPayload = debugSyncPayload;
