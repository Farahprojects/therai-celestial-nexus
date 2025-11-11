import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.therai.app',
  appName: 'Therai',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    App: {
      launchUrl: 'therai://auth/callback'
    },
    StatusBar: {
      style: 'Light',
      backgroundColor: '#ffffff',
      overlaysWebView: false
    }
  }
};

export default config;
