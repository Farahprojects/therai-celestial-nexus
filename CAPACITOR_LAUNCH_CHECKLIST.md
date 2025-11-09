# Capacitor App Store Launch Checklist

**Status: Ready for Testing** ✅  
**Last Updated:** November 9, 2025

## ✅ Completed Setup

### 1. Dependencies Installed
- ✅ @capacitor/cli: 7.4.4
- ✅ @capacitor/core: 7.4.4  
- ✅ @capacitor/android: 7.4.4
- ✅ @capacitor/ios: 7.4.4
- ✅ @capacitor/app: 7.1.0
- ✅ @capacitor/browser: 7.0.2

### 2. Platform Status
**iOS:** ✅ Looking great!
**Android:** ✅ Looking great!

### 3. Configuration
- **App ID:** `com.therai.app`
- **App Name:** Therai
- **Bundle ID (iOS):** com.therai.app
- **Package Name (Android):** com.therai.app
- **Version:** 1.0 (Build 1)
- **OAuth Callback:** `therai://auth/callback`

### 4. Assets & Permissions
- ✅ App icons (all densities)
- ✅ Splash screens (light/dark modes)
- ✅ Microphone permission (iOS & Android)
- ✅ Speech recognition permission (iOS)
- ✅ Internet permission (Android)

---

## 🧪 Testing Your App (Command Line)

### Build & Test iOS

```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# Build iOS app (command line - requires Apple Developer signing)
cd ios/App
xcodebuild -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath build

# Or open in Xcode to test on device
npx cap open ios
```

### Build & Test Android

**Note:** Android CLI builds require Java 17+. Current system: Java 11

```bash
# Build web assets
npm run build

# Sync to Android
npx cap sync android

# Option 1: Install Java 17 for CLI builds
brew install openjdk@17

# Then build from CLI
cd android
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
./gradlew assembleDebug

# Option 2: Use Android Studio
npx cap open android
```

---

## 📦 Command Line Build Commands

### iOS (xcodebuild)

```bash
# Debug build for simulator
cd ios/App
xcodebuild -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath build

# Release build for device
xcodebuild -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath build \
  archive -archivePath build/App.xcarchive

# Export for App Store
xcodebuild -exportArchive \
  -archivePath build/App.xcarchive \
  -exportPath build/Release \
  -exportOptionsPlist ExportOptions.plist
```

### Android (Gradle)

```bash
cd android

# Debug APK
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk

# Release AAB (for Play Store)
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab

# Release APK (for direct distribution)
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## 🚀 Pre-Launch Requirements

### Before iOS App Store Submission

#### 1. Code Signing Setup
- [ ] Apple Developer account ($99/year)
- [ ] Create App ID in Apple Developer Portal: `com.therai.app`
- [ ] Create provisioning profiles (Development & Distribution)
- [ ] Configure signing in Xcode or via command line

#### 2. App Store Connect
- [ ] Create app listing in App Store Connect
- [ ] Add app metadata (description, keywords, etc.)
- [ ] Prepare screenshots (required sizes):
  - 6.7" iPhone: 1290x2796px
  - 6.5" iPhone: 1242x2688px
  - 5.5" iPhone: 1242x2208px
  - iPad Pro: 2048x2732px
- [ ] Add privacy policy URL
- [ ] Set app category and pricing

#### 3. iOS Build Info to Update
```
Location: ios/App/App.xcodeproj/project.pbxproj
- MARKETING_VERSION: 1.0
- CURRENT_PROJECT_VERSION: 1
- PRODUCT_BUNDLE_IDENTIFIER: com.therai.app
```

### Before Google Play Store Submission

#### 1. Signing Configuration
- [ ] Google Play Console account ($25 one-time)
- [ ] Generate release keystore:

```bash
cd android/app
keytool -genkey -v -keystore therai-release.keystore \
  -alias therai -keyalg RSA -keysize 2048 -validity 10000
```

- [ ] Create `android/keystore.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=therai
storeFile=app/therai-release.keystore
```

- [ ] Update `android/app/build.gradle` signing config:
```gradle
android {
    signingConfigs {
        release {
            def keystorePropertiesFile = rootProject.file("keystore.properties")
            def keystoreProperties = new Properties()
            keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
            
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

#### 2. Play Console Setup
- [ ] Create app listing in Play Console
- [ ] Add store listing details
- [ ] Prepare screenshots (required):
  - Phone: 1080x1920px (min 2 screenshots)
  - Tablet: 1200x1920px
  - Feature graphic: 1024x500px
- [ ] Add privacy policy URL
- [ ] Complete content rating questionnaire
- [ ] Set up pricing and distribution

#### 3. Android Version Info
```
Location: android/app/build.gradle
- versionCode: 1
- versionName: "1.0"
- minSdkVersion: 23
- targetSdkVersion: 35
- compileSdkVersion: 35
```

---

## 🔐 OAuth Configuration Checklist

### Supabase Dashboard
- [ ] Add redirect URI: `therai://auth/callback`
- [ ] Configure Google OAuth provider
- [ ] Configure Apple OAuth provider

### Google OAuth
- [ ] Create OAuth 2.0 Client ID in Google Cloud Console
- [ ] Add redirect URIs:
  - `therai://auth/callback`
  - `https://YOUR_SUPABASE_URL.supabase.co/auth/v1/callback`

### Apple OAuth
- [ ] Create App ID with "Sign In with Apple" capability
- [ ] Create Services ID for web authentication
- [ ] Add redirect URI: `therai://auth/callback`
- [ ] Configure in Supabase

---

## 📱 Testing Before Launch

### Must Test
1. **OAuth Flow**
   - [ ] Google sign-in on iOS
   - [ ] Google sign-in on Android
   - [ ] Apple sign-in on iOS
   - [ ] Apple sign-in on Android (if applicable)
   - [ ] Deep link callback handling

2. **Core Features**
   - [ ] Chat functionality
   - [ ] Voice/Conversation Mode
   - [ ] Profile management
   - [ ] Subscription/payments

3. **Device Testing**
   - [ ] Test on real iOS device (not just simulator)
   - [ ] Test on real Android device (not just emulator)
   - [ ] Test on different screen sizes
   - [ ] Test on older OS versions

---

## 🎯 Quick Build & Test Workflow

```bash
# 1. Make code changes
# ... edit your React code ...

# 2. Build web assets
npm run build

# 3. Sync to native platforms
npx cap sync

# 4. Test iOS (opens Xcode)
npx cap open ios
# In Xcode: Select device → Run (⌘R)

# 5. Test Android (opens Android Studio)
npx cap open android
# In Android Studio: Select device → Run (▶)
```

---

## ⚠️ Known Issues

### Java Version for Android CLI Builds
- **Issue:** Android Gradle plugin requires Java 17+
- **Current:** Java 11 installed
- **Solution:** Install Java 17:
  ```bash
  brew install openjdk@17
  export JAVA_HOME=$(/usr/libexec/java_home -v 17)
  ```

### Firebase Push Notifications (Optional)
- **Status:** Not configured
- **Files Missing:**
  - `android/app/google-services.json`
  - `ios/App/App/GoogleService-Info.plist`
- **Impact:** Push notifications won't work without these
- **Action:** Add if you need push notifications

---

## 📊 Current Build Status

| Platform | Status | Version | Build | Ready for Store |
|----------|--------|---------|-------|-----------------|
| iOS      | ✅ Synced | 1.0 | 1 | Needs signing |
| Android  | ✅ Synced | 1.0 | 1 | Needs signing |
| Web      | ✅ Built | 1.0 | - | ✅ Ready |

---

## 🔗 Useful Commands

```bash
# Check Capacitor status
npx cap doctor

# Sync all platforms
npx cap sync

# Sync specific platform
npx cap sync ios
npx cap sync android

# Open native IDE
npx cap open ios
npx cap open android

# Update Capacitor
npm install @capacitor/cli@latest @capacitor/core@latest
npm install @capacitor/ios@latest @capacitor/android@latest

# Clean and rebuild
rm -rf android/build ios/App/build dist
npm run build
npx cap sync
```

---

## 📞 Next Steps

1. **Immediate Testing:**
   - Install Java 17 (for Android CLI) or use Android Studio
   - Build and test on real devices
   - Verify OAuth flow works end-to-end

2. **App Store Prep:**
   - Set up signing certificates (iOS) and keystore (Android)
   - Create store listings
   - Prepare marketing assets (screenshots, descriptions)

3. **Before Submission:**
   - Test all features on real devices
   - Verify subscription/payment flow
   - Complete app review questionnaires
   - Submit for review

---

**Ready to test!** All Capacitor dependencies are installed and synced. The native projects are configured correctly.

