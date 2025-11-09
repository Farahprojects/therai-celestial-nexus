# Install Therai on Your Phone

## ✅ Build Complete!

Your Android APK is ready at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📱 Install on Android Phone

### Option 1: ADB (Android Debug Bridge) - Fastest

```bash
# 1. Connect your phone via USB

# 2. Enable Developer Options on your phone:
#    - Go to Settings → About Phone
#    - Tap "Build Number" 7 times
#    - Go back to Settings → Developer Options
#    - Enable "USB Debugging"

# 3. Install the APK
cd android
./gradlew installDebug

# Or manually with adb
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Option 2: Direct File Transfer

```bash
# 1. Connect phone via USB or use file sharing

# 2. Copy APK to phone
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Desktop/therai.apk

# 3. Transfer to your phone and tap to install
#    (You may need to enable "Install from Unknown Sources" in phone settings)
```

### Option 3: Share via Cloud/Email

```bash
# Upload the APK to Google Drive, Dropbox, or email it to yourself
# Then download and install on your phone
```

---

## 🍎 Install on iPhone

### Using Xcode (Wireless or Cable)

```bash
# 1. Open the iOS project
npx cap open ios

# 2. In Xcode:
#    - Connect your iPhone (or use wireless debugging)
#    - Select your device in the top toolbar
#    - Click the "Play" button (⌘R) to build and run
#
# 3. First time setup:
#    - Go to iPhone Settings → General → VPN & Device Management
#    - Trust the developer certificate
```

### Build from Command Line

```bash
# Build for connected device
cd ios/App
xcodebuild -scheme App \
  -configuration Debug \
  -sdk iphoneos \
  -derivedDataPath build \
  -destination 'platform=iOS,id=YOUR_DEVICE_UDID'
```

---

## 🔄 Full Workflow for Updates

Every time you make changes:

```bash
# 1. Build web app
npm run build

# 2. Sync to native platforms
npx cap sync

# 3. Build Android APK
cd android && ./gradlew assembleDebug

# 4. Install on phone (if connected via USB)
./gradlew installDebug

# Or for iOS
npx cap open ios
# Then run from Xcode
```

---

## 🔧 Build Commands Reference

### Android

```bash
cd android

# Debug APK (for testing)
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk

# Release APK (unsigned)
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release-unsigned.apk

# Release AAB for Play Store (requires signing)
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab

# Install on connected device
./gradlew installDebug

# Clean build
./gradlew clean
```

### iOS

```bash
# Open in Xcode
npx cap open ios

# Command line build for simulator
cd ios/App
xcodebuild -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath build

# Command line build for device
xcodebuild -scheme App \
  -configuration Debug \
  -sdk iphoneos \
  -derivedDataPath build
```

---

## 📊 Current App Info

- **App Name:** Therai
- **Package:** com.therai.app
- **Version:** 1.0 (Build 1)
- **Min Android:** 23 (Android 6.0)
- **Target Android:** 35 (Android 15)
- **iOS Target:** Latest

---

## 🧪 Testing Checklist

Once installed on your phone, test:

- [ ] App launches successfully
- [ ] Sign in with Google works
- [ ] Sign in with Apple works (iOS)
- [ ] Deep link callback works (therai://auth/callback)
- [ ] Chat functionality
- [ ] Voice/Conversation Mode (microphone permission)
- [ ] Profile features
- [ ] All core features work as expected

---

## ⚡ Quick Install Commands

**Android (with phone connected via USB):**
```bash
npm run build && npx cap sync && cd android && ./gradlew installDebug
```

**iOS:**
```bash
npm run build && npx cap sync && npx cap open ios
# Then ⌘R in Xcode
```

---

## 🐛 Troubleshooting

### Android: "App not installed"
- Enable "Install from Unknown Sources" in Settings
- Try uninstalling any existing version first
- Check if you have enough storage space

### iOS: "Untrusted Developer"
- Go to Settings → General → VPN & Device Management
- Tap on your developer profile
- Tap "Trust"

### Build fails
```bash
# Clean everything and rebuild
cd android && ./gradlew clean
cd ../ios/App && rm -rf build
cd ../..
npm run build
npx cap sync
```

### Java Version Issues (Local Builds Only)
If building locally and you get Java version errors:
```bash
# Set JAVA_HOME for local builds (Icon CI handles this automatically)
export JAVA_HOME=/opt/homebrew/opt/openjdk@21  # macOS with Homebrew
# or
export JAVA_HOME=/opt/homebrew/opt/openjdk@17

# Then build
cd android && ./gradlew assembleDebug
```

---

**Your app is ready to test! 🎉**

APK Location: `android/app/build/outputs/apk/debug/app-debug.apk` (5.4 MB)

