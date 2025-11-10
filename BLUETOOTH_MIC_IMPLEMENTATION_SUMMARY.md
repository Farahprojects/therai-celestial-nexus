# Bluetooth Microphone Routing - Implementation Summary

## What Was the Problem?

Your silence detection was failing with Bluetooth headsets because:

1. **Recording from the wrong mic**: Your app was using the phone's built-in microphone instead of the Bluetooth headset mic
2. **High noise floor**: Built-in mics pick up ambient noise (HVAC, fans, rustling) that never gets quiet enough to trigger your 1.5-second silence threshold
3. **Wrong Bluetooth profile**: The device was stuck in A2DP (music) mode instead of switching to SCO/HFP (phone call) mode

Google's STT could still process the audio because it's sophisticated enough to filter out the noise, but your simple energy-based silence detector couldn't differentiate between ambient noise and actual silence.

## The Fix

Created a **Capacitor plugin** that forces native Bluetooth audio routing **before** requesting microphone access:

### What the Plugin Does

**Android:**
```java
audioManager.setMode(MODE_IN_COMMUNICATION);  // Phone call mode
audioManager.startBluetoothSco();             // Start Bluetooth SCO profile
audioManager.setBluetoothScoOn(true);         // Route audio through Bluetooth
```

**iOS:**
```swift
AVAudioSession.setCategory(
  .playAndRecord,              // Simultaneous input/output
  mode: .voiceChat,            // Voice communication mode
  options: [.allowBluetooth]   // Enable Bluetooth routing
)
AVAudioSession.setPreferredInput(bluetoothDevice)  // Explicit routing
```

### Integration Flow

```
1. User starts recording
   ↓
2. [NEW] BluetoothAudio.startBluetoothAudio()  ← Forces SCO mode
   ↓
3. navigator.mediaDevices.getUserMedia()       ← Now gets Bluetooth mic
   ↓
4. Recording with clean audio (noise-canceling headset)
   ↓
5. Silence detection works correctly
   ↓
6. [NEW] BluetoothAudio.stopBluetoothAudio()   ← Restore normal mode
```

## Files Created

1. **`src/plugins/BluetoothAudio.ts`** - TypeScript plugin interface
2. **`src/plugins/web.ts`** - Web fallback (no-op)
3. **`android/app/src/main/java/com/therai/app/BluetoothAudioPlugin.java`** - Android native code
4. **`ios/App/App/BluetoothAudioPlugin.swift`** - iOS native code

## Files Modified

1. **`src/services/audio/UniversalSTTRecorder.ts`**
   - Added Bluetooth routing before mic access in `start()`
   - Added Bluetooth cleanup in `cleanup()`

2. **`android/app/src/main/java/com/therai/app/MainActivity.java`**
   - Registered the plugin

3. **`android/app/src/main/AndroidManifest.xml`**
   - Added Bluetooth permissions

## Next Steps to Deploy

1. **Build the app:**
   ```bash
   npm run build
   npx cap sync
   ```

2. **Test on Android:**
   ```bash
   npx cap open android
   # Build in Android Studio and install on device
   ```

3. **Test on iOS:**
   ```bash
   npx cap open ios
   # Build in Xcode and install on device
   ```

4. **Validation:**
   - Connect Bluetooth headset
   - Start Conversation Mode
   - Speak and then stop
   - Verify 1.5-second silence detection triggers correctly

## Expected Results

✅ **With Bluetooth headset:**
- Audio captured from headset mic (noise-canceling, clean signal)
- Low noise floor allows silence detection to work
- 1.5-second timeout triggers reliably

✅ **Without Bluetooth headset:**
- Falls back to built-in mic gracefully
- No errors or crashes
- Same behavior as before

✅ **On web browsers:**
- No changes (browsers handle routing automatically)
- Plugin is no-op on web

## Debugging

**Android logs:**
```bash
adb logcat | grep "BluetoothAudioPlugin"
```

**iOS logs:**
Look in Xcode console for `[BluetoothAudioPlugin]` messages

**What to look for:**
- "Bluetooth audio routing enabled" ✅
- "Bluetooth SCO started successfully" (Android) ✅
- "Bluetooth input explicitly selected" (iOS) ✅

## Key Design Decisions

1. **Fail gracefully**: If Bluetooth routing fails, app continues with default mic (no user-facing errors)
2. **Platform-specific**: Only runs on native mobile, web version is no-op
3. **Lifecycle management**: Bluetooth routing is started/stopped with each recording session
4. **Permissions**: Added necessary Bluetooth permissions for Android

## Why This Works

The core issue was **source control**, not the silence detection algorithm:

- **Before**: Recording from noisy built-in mic → constant ambient noise → silence never detected
- **After**: Recording from Bluetooth headset → noise-canceling mic → true silence → detection works

The "garbage" audio Google STT could handle was actually from the compressed Bluetooth SCO profile, which your STT service handles fine. The problem was the **energy threshold**, not the transcription quality.

## Performance Impact

- **Minimal**: Plugin calls are lightweight native APIs
- **No latency**: Bluetooth routing happens before getUserMedia (same flow)
- **Memory**: No additional memory overhead
- **Battery**: Bluetooth SCO is actually more efficient than A2DP for voice

## Future Optimizations

Now that the noise floor is fixed with Bluetooth headsets, you could:
- Tighten silence detection thresholds (currently 15% below baseline)
- Reduce silence hangover (currently 600ms)
- Adjust baseline capture duration (currently 600-700ms)

But test first to confirm the fix works as expected!

