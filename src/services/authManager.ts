import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError, safeConsoleWarn, safeConsoleLog } from '@/utils/safe-logging';
type Platform = 'web' | 'ios' | 'android';
type OAuthProvider = 'google' | 'apple';

/**
 * Unified OAuth Manager - Single source of truth for authentication
 * Detects platform once at bootstrap, routes to correct OAuth flow
 */
class AuthManager {
  private static instance: AuthManager;
  private platform: Platform;
  private isListening = false;
  private readonly OAUTH_CALLBACK_URL = 'therai://auth/callback';

  private constructor() {
    // Detect platform once at initialization
    const cap = Capacitor.getPlatform();
    this.platform = cap === 'ios' ? 'ios' : cap === 'android' ? 'android' : 'web';

    // Register platform-specific listeners
    if (this.isNativeApp()) {
      this.setupDeepLinkListener();
    }
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Returns true if running in native Capacitor app (iOS or Android)
   */
  isNativeApp(): boolean {
    return this.platform === 'ios' || this.platform === 'android';
  }

  /**
   * Sign in with OAuth provider
   * Routes to correct flow based on platform automatically
   */
  async signInWithOAuth(provider: OAuthProvider): Promise<{ error: Error | null }> {
    // IMPORTANT: Do NOT clear Supabase auth state before OAuth!
    // Supabase stores the PKCE code_verifier in sessionStorage/localStorage
    // and needs it when exchanging the code for a session after redirect
    // Only clear very specific non-auth related items
    safeConsoleLog('[AuthManager] Starting OAuth sign-in', { provider, platform: this.platform });
    
    // Only clear non-Supabase related items that won't affect PKCE flow
    try {
      localStorage.removeItem('pending_join_token'); // Old token, not needed
    } catch (error) {
      safeConsoleWarn('[AuthManager] Failed to clear pending_join_token:', error);
    }

    if (this.isNativeApp()) {
      return await this.signInNative(provider);
    } else {
      return await this.signInWeb(provider);
    }
  }

  /**
   * Native app flow: In-app browser + deep link callback
   */
  private async signInNative(provider: OAuthProvider): Promise<{ error: Error | null }> {
    try {
      // IMPORTANT: We DON'T call supabase.auth.signInWithOAuth() here
      // because it automatically opens a browser (triggers system browser)
      // Instead, manually construct the OAuth URL
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://api.therai.co';
      const redirectUri = encodeURIComponent(this.OAUTH_CALLBACK_URL);
      
      let oauthUrl: string;
      if (provider === 'google') {
        oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectUri}&access_type=offline&prompt=consent`;
      } else {
        oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=apple&redirect_to=${redirectUri}&response_mode=form_post`;
      }

      // Open ONLY in-app browser (no automatic system browser)
      await Browser.open({
        url: oauthUrl,
        windowName: '_self',
        toolbarColor: '#ffffff',
        presentationStyle: 'fullscreen', // iOS: Hide URL bar for cleaner UI
      });

      return { error: null };
    } catch (err: unknown) {
      safeConsoleError('[AuthManager] Native OAuth error:', err);
      return { error: err instanceof Error ? err : new Error('OAuth failed') };
    }
  }

  /**
   * Web flow: Standard OAuth redirect
   */
  private async signInWeb(provider: OAuthProvider): Promise<{ error: Error | null }> {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      
      // Preserve redirect path through OAuth flow (URL params are more reliable than localStorage)
      let redirectTo = `${baseUrl}/therai`;
      
      // Check if there's a redirect param in the current URL
      if (typeof window !== 'undefined') {
        const currentUrl = new URL(window.location.href);
        const redirectParam = currentUrl.searchParams.get('redirect');
        
        if (redirectParam) {
          // Preserve the redirect param through OAuth flow
          redirectTo = `${baseUrl}/therai?redirect=${encodeURIComponent(redirectParam)}`;
        }
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Redirect back to /therai with redirect param preserved
          redirectTo,
          queryParams: provider === 'google'
            ? { access_type: 'offline', prompt: 'consent' }
            : { response_mode: 'form_post' },
        },
      });

      if (error) {
        safeConsoleError('[AuthManager] Web OAuth error:', error);
        return { error: new Error(error.message || 'OAuth failed') };
      }

      return { error: null };
    } catch (err: unknown) {
      safeConsoleError('[AuthManager] Web OAuth error:', err);
      return { error: err instanceof Error ? err : new Error('OAuth failed') };
    }
  }

  /**
   * Set up deep link listener for native app OAuth callbacks
   * Only called if platform is iOS or Android
   */
  private setupDeepLinkListener() {
    if (this.isListening) return;

    App.addListener('appUrlOpen', async (event) => {

      if (event.url.startsWith(this.OAUTH_CALLBACK_URL)) {
        try {
          // CRITICAL: Close in-app browser FIRST
          await Browser.close();

          // Parse the callback URL
          const url = new URL(event.url);
          const hash = url.hash.substring(1);
          const searchParams = new URLSearchParams(url.search);
          const hashParams = new URLSearchParams(hash);

          // Try to get tokens from either hash or search params
          const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
          
          // Or handle OAuth code flow
          const code = searchParams.get('code');

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              safeConsoleError('[AuthManager] Session error:', error);
            }
          } else if (code) {
            
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              safeConsoleError('[AuthManager] Code exchange error:', error);
            }
          } else {
            console.error('[AuthManager] ❌ No tokens or code in callback URL');
            console.error('[AuthManager] Full URL: [REDACTED - may contain sensitive auth parameters]');
          }
        } catch (error) {
          safeConsoleError('[AuthManager] Callback handling error:', error);
        }
      }
    });

    this.isListening = true;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      safeConsoleError('[AuthManager] Sign out error:', error);
      throw error;
    }
  }
}

// Lazy/safe singleton accessors (no eager initialization at import time)
let _authManager: AuthManager | null = null;
export function getAuthManager(): AuthManager {
  if (!_authManager) {
    _authManager = AuthManager.getInstance();
  }
  return _authManager;
}

// Explicit initializer to be called at app bootstrap (main.tsx)
export function initAuthManager(): void {
  getAuthManager();
}

// Export helper for components (centralized platform check)
export function useIsNativeApp(): boolean {
  return getAuthManager().isNativeApp();
}

