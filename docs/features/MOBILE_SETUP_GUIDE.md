# Therai Mobile App Setup Guide

## ✅ Completed Setup

Your Capacitor mobile app is now ready! Here's what has been configured:

### 1. Capacitor Configuration
- **App Name**: Therai
- **App ID**: com.therai.app
- **Platforms**: iOS & Android
- **Custom URL Scheme**: `therai://auth/callback`

### 2. OAuth Flow Setup
- Custom auth service: `src/lib/capacitorAuth.ts`
- Mobile auth component: `src/components/auth/CapacitorSocialLogin.tsx`
- URL scheme configured for both iOS and Android

### 3. App Assets
- App icons generated for all screen densities
- Splash screens created for light and dark modes
- PWA icons generated

## 🔧 Next Steps: OAuth Provider Configuration

### Google OAuth Setup

1. **Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select your project
   - Enable Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Add these redirect URIs:
     ```
     therai://auth/callback
     https://your-supabase-project.supabase.co/auth/v1/callback
     ```

2. **Supabase Configuration**
   - Go to your Supabase Dashboard → Authentication → Providers
   - Enable Google provider
   - Add your Google OAuth client ID and secret
   - Add redirect URL: `therai://auth/callback`

### Apple OAuth Setup

1. **Apple Developer Console**
   - Go to [Apple Developer Console](https://developer.apple.com/account/)
   - Create a new App ID with identifier: `com.therai.app`
   - Enable "Sign In with Apple" capability
   - Create a Services ID with identifier: `com.therai.app.auth`
   - Add redirect URL: `therai://auth/callback`

2. **Supabase Configuration**
   - Go to your Supabase Dashboard → Authentication → Providers
   - Enable Apple provider
   - Add your Apple Services ID and secret
   - Add redirect URL: `therai://auth/callback`

## 📱 Testing Your App

### iOS Testing
```bash
# Open in Xcode
npx cap open ios

# Run on simulator
npx cap run ios
```

### Android Testing
```bash
# Open in Android Studio
npx cap open android

# Run on device/emulator
npx cap run android
```

## 🚀 App Store Preparation

### iOS App Store
1. **Apple Developer Account** ($99/year)
2. **App Store Connect Setup**
   - Create app with bundle ID: `com.therai.app`
   - Upload screenshots and app metadata
   - Set up app review information

3. **Build & Submit**
   ```bash
   # Build for release
   npx cap build ios --prod
   
   # Archive in Xcode
   # Upload to App Store Connect
   ```

### Google Play Store
1. **Google Play Console Account** ($25 one-time)
2. **App Bundle Setup**
   ```bash
   # Generate signed bundle
   npx cap build android --prod
   
   # Upload to Play Console
   ```

## 🔄 Development Workflow

### Making Changes
1. Edit your React code
2. Build the web app: `npm run build`
3. Sync with native: `npx cap sync`
4. Test on device: `npx cap run ios/android`

### OAuth Testing
1. Use the `CapacitorSocialLogin` component in your auth flow
2. Test OAuth flow on real devices (simulators may have issues)
3. Verify URL scheme handling works correctly

## 📋 Environment Variables

Make sure these are set in your environment:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🎯 Key Features

- ✅ Native-feeling OAuth flow with browser sheets
- ✅ Automatic session management
- ✅ Deep link handling for OAuth callbacks
- ✅ Cross-platform iOS/Android support
- ✅ App icons and splash screens
- ✅ Production-ready build configuration

Your app is now ready for mobile app stores! 🎉
