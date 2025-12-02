import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    cors: {
      origin: true,
      credentials: true
    }
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    // Temporarily disable ESLint checker to avoid config issues
    // checker({
    //   typescript: true,
    //   eslint: {
    //     lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
    //   },
    // }),
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
