# Bluetooth Audio Routing Fix

## Problem
The app's silence detection (VAD - Voice Activity Detection) was failing when using Bluetooth headsets because:

1. **Wrong Microphone Source**: The app was recording from the phone's built-in mic instead of the Bluetooth headset mic
2. **High Noise Floor**: The built-in mic picks up ambient noise (HVAC, computer fans, rustling clothes) that keeps the energy level above the silence threshold
3. **Profile Mismatch**: The device stayed in A2DP mode (high-quality music playback) instead of switching to SCO/HFP mode (low-latency phone call mode optimized for voice)

## Root Cause
Web APIs (`navigator.mediaDevices.getUserMedia`) don't provide explicit control over audio routing. On mobile devices with Bluetooth headsets, the OS needs explicit instructions to:
- Switch from A2DP (music) profile to SCO/HFP (phone call) profile
- Route microphone input from Bluetooth instead of the built-in mic
- Configure audio session for voice communication

## Solution
Created a Capacitor plugin that manages Bluetooth audio routing at the native OS level:

### Android Implementation
- Uses `AudioManager.setMode(MODE_IN_COMMUNICATION)` to indicate voice communication
- Calls `startBluetoothSco()` to force the switch to SCO (Synchronous Connection-Oriented) profile
- Enables `setBluetoothScoOn(true)` to route audio through Bluetooth

### iOS Implementation
- Configures `AVAudioSession` with `.playAndRecord` category (simultaneous input/output)
- Sets mode to `.voiceChat` (optimized for voice communication)
- Adds `.allowBluetooth` option to enable Bluetooth routing
- Explicitly selects Bluetooth input if available using `setPreferredInput()`

## Files Created/Modified

### New Files
- `src/plugins/BluetoothAudio.ts` - Capacitor plugin interface
- `src/plugins/web.ts` - Web implementation (no-op for browsers)
- `android/app/src/main/java/com/therai/app/BluetoothAudioPlugin.java` - Android native implementation
- `ios/App/App/BluetoothAudioPlugin.swift` - iOS native implementation

### Modified Files
- `src/services/audio/UniversalSTTRecorder.ts` - Integrated Bluetooth routing before mic access
- `android/app/src/main/java/com/therai/app/MainActivity.java` - Registered plugin
- `android/app/src/main/AndroidManifest.xml` - Added Bluetooth permissions

## How It Works

1. **Before Recording Starts** (in `UniversalSTTRecorder.start()`):
   ```typescript
   // On native mobile platforms, configure Bluetooth audio FIRST
   if (Capacitor.isNativePlatform()) {
     await BluetoothAudio.startBluetoothAudio();
   }
   // Then request microphone access
   const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
   ```

2. **During Recording**:
   - Audio is routed from the Bluetooth headset mic (noise-canceling, clean signal)
   - Silence detection can now accurately detect when the user stops speaking
   - Google STT continues to work (it was already handling the "garbage" audio well)

3. **After Recording** (in `cleanup()`):
   ```typescript
   // Stop Bluetooth SCO and restore normal audio mode
   if (Capacitor.isNativePlatform()) {
     await BluetoothAudio.stopBluetoothAudio();
   }
   ```

## Expected Results

### With Bluetooth Headset Connected
- ✅ Audio is recorded from the Bluetooth headset mic (not phone's built-in mic)
- ✅ Noise-canceling on headset provides clean audio with low noise floor
- ✅ Silence detection works reliably (1.5-second timeout triggers correctly)
- ✅ Google STT continues to transcribe accurately

### Without Bluetooth Headset
- ✅ Falls back to built-in mic gracefully
- ✅ No errors or crashes if Bluetooth not available
- ✅ Existing behavior maintained

### On Web Browsers
- ✅ No changes - browsers handle routing automatically
- ✅ Plugin provides no-op implementation for web

## Testing Instructions

1. **Build Native Apps**:
   ```bash
   npm run build
   npx cap sync
   ```

2. **Test on Android**:
   ```bash
   npx cap open android
   # Build and run in Android Studio
   ```

3. **Test on iOS**:
   ```bash
   npx cap open ios
   # Build and run in Xcode
   ```

4. **Validation Steps**:
   - Connect Bluetooth headset to device
   - Open Conversation Mode
   - Speak into Bluetooth headset
   - Stop speaking for 1.5 seconds
   - Verify silence detection triggers correctly
   - Check logs for "Bluetooth audio routing enabled" message

## Debugging

### Android Logs
```bash
adb logcat | grep "BluetoothAudioPlugin"
```

Look for:
- "Starting Bluetooth audio routing"
- "Bluetooth SCO started successfully"
- "Bluetooth audio stopped"

### iOS Logs
In Xcode Console, look for:
- "[BluetoothAudioPlugin] Starting Bluetooth audio routing"
- "[BluetoothAudioPlugin] Bluetooth input explicitly selected"
- "[BluetoothAudioPlugin] Current route: [device name]"

## Fallback Behavior
If Bluetooth audio routing fails:
- Error is logged but not thrown
- App continues with default mic (same as before)
- No user-facing errors or crashes
- Graceful degradation

## Future Improvements
After confirming the noise floor is fixed, you may be able to:
- Tighten silence detection thresholds for faster response
- Reduce baseline capture duration
- Fine-tune VAD parameters for Bluetooth-specific characteristics

