# Bluetooth Audio Routing - Deployment Steps

## ✅ Implementation Complete

All code has been written and the Android platform has been synced successfully.

## What Was Built

1. **Capacitor Plugin** - Native Bluetooth audio routing control
2. **Android Implementation** - `BluetoothAudioPlugin.java` with SCO mode switching
3. **iOS Implementation** - `BluetoothAudioPlugin.swift` with AVAudioSession configuration
4. **Integration** - `UniversalSTTRecorder.ts` now uses Bluetooth routing before mic access
5. **Permissions** - Android Bluetooth permissions added to AndroidManifest.xml

## Android - Ready to Test ✅

Android is fully synced and ready to test:

```bash
npx cap open android
```

Then in Android Studio:
1. Build → Make Project
2. Run → Run 'app'
3. Install on physical device (Bluetooth testing requires real device)

### Test Instructions (Android)
1. Connect Bluetooth headset to Android device
2. Open the app
3. Go to Conversation Mode
4. Check logcat: `adb logcat | grep "BluetoothAudioPlugin"`
5. Look for: "Bluetooth audio routing enabled"
6. Speak into Bluetooth headset
7. Stop speaking for 1.5 seconds
8. Verify silence detection triggers correctly

## iOS - Needs Manual Setup ⚠️

The iOS sync failed due to a Ruby encoding issue. Manual steps needed:

### Option 1: Fix Ruby Encoding (Recommended)
```bash
# Add to ~/.zshrc or ~/.bash_profile
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Reload shell
source ~/.zshrc  # or source ~/.bash_profile

# Try sync again
npx cap sync ios
```

### Option 2: Manual Xcode Setup
If sync continues to fail, manually add the plugin in Xcode:

1. Open Xcode: `npx cap open ios`
2. In Project Navigator, right-click on `App` group
3. Add Files to "App"...
4. Navigate to `ios/App/App/BluetoothAudioPlugin.swift`
5. Make sure "Copy items if needed" is UNCHECKED (file is already in the right place)
6. Add to target: App
7. Build and run on physical device (Bluetooth testing requires real device)

### Test Instructions (iOS)
1. Connect Bluetooth headset to iOS device
2. Open the app
3. Go to Conversation Mode
4. Check Xcode console for: "[BluetoothAudioPlugin]" messages
5. Look for: "Bluetooth audio routing enabled"
6. Speak into Bluetooth headset
7. Stop speaking for 1.5 seconds
8. Verify silence detection triggers correctly

## Expected Behavior

### ✅ Success Indicators
- Android logs show: "Bluetooth SCO started successfully"
- iOS logs show: "Bluetooth input explicitly selected: [device name]"
- Silence detection triggers after 1.5 seconds of quiet
- Audio quality is good (using headset mic)
- No more premature cutoffs mid-sentence

### ⚠️ Graceful Degradation
- If no Bluetooth headset connected: uses built-in mic (same as before)
- If Bluetooth routing fails: warning logged, continues with default mic
- If permissions denied: error shown to user (same as before)
- Web version: no changes, works as before

## Debugging Commands

### Android
```bash
# View all logs
adb logcat

# Filter for plugin only
adb logcat | grep "BluetoothAudioPlugin"

# Filter for Bluetooth events
adb logcat | grep -i bluetooth

# Check audio routing
adb shell dumpsys audio | grep -A 10 "Audio routes"
```

### iOS
- Use Xcode Console (⇧⌘C)
- Filter for "BluetoothAudioPlugin"
- Watch for AVAudioSession routing notifications

## Known Issues

### iOS CocoaPods Sync Error
If you see "Unicode Normalization not appropriate for ASCII-8BIT":

**Cause**: Ruby 2.7.6 with incorrect terminal encoding

**Fix**: Add to shell profile:
```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

### Android Build Errors
If Java compilation fails:

**Cause**: Plugin not registered or syntax error

**Fix**: Check `MainActivity.java` has:
```java
registerPlugin(BluetoothAudioPlugin.class);
```

## Performance Notes

- **Latency**: No additional latency (Bluetooth routing happens before getUserMedia)
- **Battery**: Bluetooth SCO is more efficient than A2DP for voice
- **Memory**: Minimal overhead (just native API calls)
- **Compatibility**: Android 5.0+ (API 21+), iOS 12.0+

## Rollback Plan

If this causes issues, you can rollback by:

1. Remove Bluetooth routing calls:
   ```typescript
   // In UniversalSTTRecorder.ts, comment out:
   // await BluetoothAudio.startBluetoothAudio();
   // await BluetoothAudio.stopBluetoothAudio();
   ```

2. Rebuild and sync:
   ```bash
   npm run build
   npx cap sync
   ```

The app will work exactly as before (using default audio routing).

## Next Steps After Testing

Once you confirm the fix works:

1. **Optimize VAD Parameters** (if needed):
   - Tighten silence detection threshold (currently 15% below baseline)
   - Reduce silence hangover (currently 600ms)
   - Adjust baseline capture duration (currently 600-700ms)

2. **Monitor Analytics**:
   - Track Bluetooth usage rate
   - Monitor silence detection accuracy
   - Compare STT success rates (Bluetooth vs built-in mic)

3. **User Feedback**:
   - Ask beta testers to test with Bluetooth headsets
   - Collect feedback on silence detection timing
   - Verify no regressions on non-Bluetooth users

## Documentation

Created documentation files:
- `BLUETOOTH_AUDIO_ROUTING_FIX.md` - Technical deep dive
- `BLUETOOTH_MIC_IMPLEMENTATION_SUMMARY.md` - Implementation overview
- `BLUETOOTH_DEPLOYMENT_STEPS.md` - This file (deployment guide)

## Questions?

If something doesn't work:
1. Check logs (Android: adb logcat, iOS: Xcode console)
2. Verify Bluetooth headset is connected before starting recording
3. Ensure physical device is being used (not simulator/emulator)
4. Check permissions are granted (Microphone + Bluetooth)

The plugin is designed to fail gracefully, so even if Bluetooth routing fails, the app should continue working with the default microphone.

