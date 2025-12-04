import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { checker } from "vite-plugin-checker";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    cors: {
      origin: true,
      credentials: true
    },
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; media-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.io wss://*.supabase.io https://api.therai.co wss://api.therai.co https://fonts.googleapis.com https://fonts.gstatic.com https://api.stripe.com https://js.stripe.com https://billing.stripe.com; font-src 'self' https://fonts.gstatic.com; frame-src https://js.stripe.com/* https://hooks.stripe.com https://billing.stripe.com; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';",
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff'
    }
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    checker({
      typescript: true,
      // ESLint disabled temporarily due to flat config compatibility issues
      // eslint: {
      //   lintCommand: 'eslint "./src/**/*.{ts,tsx}" --config ./eslint.config.js',
      // },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['src/workers/audio/ConversationAudioProcessor.js']
  },
  build: {
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'utils-vendor': ['clsx', 'tailwind-merge', 'date-fns'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'stripe-vendor': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          // Heavy components
          'capacitor-vendor': ['@capacitor/core', '@capacitor/app', '@capacitor/browser'],
        },
      },
    },
  },
  esbuild: {
    // Remove console logs and debugger statements from production builds
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
