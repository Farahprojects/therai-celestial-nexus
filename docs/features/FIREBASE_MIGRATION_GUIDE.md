# Firebase Migration Guide

## ✅ What's Done
- [x] Firebase project connected (`therai-775c1`)
- [x] Firestore rules deployed
- [x] Firestore indexes deployed  
- [x] Firebase SDK installed
- [x] Service layer created

## 🔄 Next Steps

### 1. Get Firebase Config
Go to [Firebase Console](https://console.firebase.google.com/project/therai-775c1/settings/general) and:
1. Click "Add app" → Web app
2. Copy the config object
3. Replace the config in `src/lib/firebase.ts`

### 2. Enable Authentication
In Firebase Console:
1. Go to Authentication → Sign-in method
2. Enable Email/Password
3. Enable Google (optional)

### 3. Enable Functions
```bash
firebase deploy --only functions
```

### 4. Update Your App
Replace Supabase imports with Firebase:

```typescript
// OLD (Supabase)
import { createClient } from '@supabase/supabase-js'

// NEW (Firebase)
import { profileService, conversationService, messageService } from './lib/firebase-service'
```

### 5. Test Migration
```bash
npm run dev
```

## 🚀 Benefits
- **More reliable** than Supabase
- **Better performance** (Google CDN)
- **Lower costs** at scale
- **Better real-time** features
- **No vendor lock-in** concerns

## 📞 Need Help?
I'll guide you through each step!
