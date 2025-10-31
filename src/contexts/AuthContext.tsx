import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useNavigationState } from '@/contexts/NavigationStateContext';
import { getAbsoluteUrl } from '@/utils/urlUtils';
import { log } from '@/utils/logUtils';
import { getAuthManager } from '@/services/authManager';

import { authService } from '@/services/authService';
/**
 * Utility – logs enabled in production for debugging.
 */
const debug = (...args: any[]) => {
  // Console logs enabled in production for debugging
  console.log(...args);
};

// Lightweight trace object
if (typeof window !== 'undefined' && !(window as any).__authTrace) {
  (window as any).__authTrace = {
    providerMounts: 0,
    listeners: 0,
    initialSessionChecks: 0,
  };
}

// ──────────────────────────────────────────
// Remove hardcoded constants - use the centralized Supabase client instead
// ──────────────────────────────────────────

/**
 * Typed shape for the Auth context.
 */
export type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isValidating: boolean;
  pendingEmailAddress?: string;
  isPendingEmailCheck?: boolean;
  isAuthenticated: boolean; // Single source of truth
  signIn: (email: string, password: string) => Promise<{ error: Error | null; data: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  signUp: (email: string, password: string) => Promise<{ error: Error | null; user?: User | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
  setPendingEmailAddress?: (email: string) => void;
  clearPendingEmail?: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Removed checkForPendingEmailChange - no longer needed for signed user email changes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Email verification state removed - handled by custom system
  const [isValidating, setIsValidating] = useState(false);
  const [pendingEmailAddress, setPendingEmailAddressState] = useState<string | undefined>(undefined);
  const [isPendingEmailCheck, setIsPendingEmailCheck] = useState(false);
  const { clearNavigationState } = useNavigationState();
  const initializedRef = useRef(false);
  
  // Single source of truth for authentication state
  const isAuthenticated = !!user;

  // Functions to manage pending email state
  const setPendingEmailAddress = (email: string) => {
    setPendingEmailAddressState(email);
    setIsPendingEmailCheck(false);
  };

  const clearPendingEmail = () => {
    setPendingEmailAddressState(undefined);
    setIsPendingEmailCheck(false);
  };

  /* ─────────────────────────────────────────────────────────────
   * Register Supabase auth listener and get initial session
   * ────────────────────────────────────────────────────────────*/
  useEffect(() => {
    // Skip auth initialization during SSR but don't return early from provider
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    if (initializedRef.current) return;
    initializedRef.current = true;

    if (typeof window !== 'undefined') (window as any).__authTrace.providerMounts++;
    log('debug', 'Initializing AuthContext with enhanced session management', null, 'auth');

    // Handle OAuth callback if present in URL
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      
      // Also check hash for PKCE flow
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const hashCode = hashParams.get('code');
      const hashError = hashParams.get('error');
      
      const oauthCode = code || hashCode;
      const oauthError = error || hashError;
      
      if (oauthCode || oauthError) {
        console.log('[AuthContext] OAuth callback detected', { 
          code: !!oauthCode, 
          error: oauthError,
          hasHashCode: !!hashCode,
          hasQueryCode: !!code,
          fullUrl: window.location.href 
        });
        
        if (oauthError) {
          console.error('[AuthContext] OAuth error:', oauthError);
          // Clean up URL parameters
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          url.searchParams.delete('error');
          url.searchParams.delete('state');
          url.hash = url.hash.replace(/[?&](code|error|state)=[^&]*/g, '');
          window.history.replaceState({}, '', url.toString());
          return;
        }
        
        if (oauthCode) {
          try {
            console.log('[AuthContext] Attempting to exchange code for session');
            // Check if PKCE verifier exists in sessionStorage
            const pkceVerifier = sessionStorage.getItem('supabase.auth.token') 
              ? JSON.parse(sessionStorage.getItem('supabase.auth.token') || '{}')?.pkceCodeVerifier
              : null;
            
            console.log('[AuthContext] PKCE verifier check:', { 
              hasVerifier: !!pkceVerifier,
              hasAuthToken: !!sessionStorage.getItem('supabase.auth.token'),
              sessionStorageKeys: Object.keys(sessionStorage).filter(k => k.includes('supabase'))
            });
            
            // Exchange code for session - Supabase should handle PKCE automatically
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(oauthCode);
            if (exchangeError) {
              console.error('[AuthContext] OAuth code exchange error:', exchangeError);
              console.error('[AuthContext] Exchange error details:', {
                message: exchangeError.message,
                status: exchangeError.status,
                url: window.location.href
              });
            } else {
              console.log('[AuthContext] OAuth code exchanged successfully');
              log('debug', 'OAuth code exchanged successfully', null, 'auth');
            }
          } catch (err) {
            console.error('[AuthContext] OAuth code exchange exception:', err);
          }
        }
        
        // Clean up URL parameters after processing
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('error');
        url.searchParams.delete('state');
        // Also clean hash
        url.hash = url.hash.replace(/[?&](code|error|state)=[^&]*/g, '');
        window.history.replaceState({}, '', url.toString());
      }
    };

    // Process OAuth callback if present
    handleOAuthCallback();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, supaSession) => {
      if (typeof window !== 'undefined') (window as any).__authTrace.listeners++;
      log('debug', 'Auth state change', { event, hasSession: !!supaSession }, 'auth');
      
      // Set user and session state - let features decide access based on email_confirmed_at
      setUser(supaSession?.user ?? null);
      setSession(supaSession);
      setLoading(false);

      // Update URL parameters to match auth state
      if (supaSession?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        // User signed in or has existing session - no need to add user_id to URL
        // The user information is available through the auth context
      } else if (!supaSession?.user && event === 'SIGNED_OUT') {
        // User signed out - clean up any existing user_id from URL if present
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('user_id')) {
          currentUrl.searchParams.delete('user_id');
          window.history.replaceState({}, '', currentUrl.toString());
        }
      }

      // Session validation removed - auth subscription already provides validated user
      // No need to call getUser() again, it's redundant and causes unnecessary API calls

      if (event === 'SIGNED_IN' && supaSession) {
        // Handle pending join after user signs in
        try {
          const pendingChatId = typeof window !== 'undefined' ? localStorage.getItem('pending_join_chat_id') : null;
          if (pendingChatId) {
            localStorage.removeItem('pending_join_chat_id');
            // Check if user is already a participant
            const { data: existingParticipant } = await supabase
              .from('conversations_participants')
              .select('conversation_id')
              .eq('conversation_id', pendingChatId)
              .eq('user_id', supaSession.user.id)
              .maybeSingle();

            if (!existingParticipant) {
              // Verify the conversation exists and is public
              const { data: source } = await supabase
                .from('conversations')
                .select('title, is_public')
                .eq('id', pendingChatId)
                .eq('is_public', true)
                .maybeSingle();

              if (!source) {
                console.error('[AuthContext] Public conversation not found:', pendingChatId);
                return;
              }

              // Add user as a participant
              const { error: insertError } = await supabase
                .from('conversations_participants')
                .insert({
                  conversation_id: pendingChatId,
                  user_id: supaSession.user.id,
                  role: 'member', // Default to member role
                });

              if (insertError) {
                console.error('[AuthContext] Error adding user as participant:', insertError);
                return;
              }
            }

            // Navigate to the conversation
            try {
              window.location.replace(`/c/${pendingChatId}`);
            } catch (_) {}
          }
        } catch (e) {
          console.error('[AuthContext] Pending join failed:', e);
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        
        // Clear chat stores when user signs out (downstream cleanup)
        try {
          const { triggerMessageStoreSelfClean } = await import('@/stores/messageStore');
          const { useChatStore } = await import('@/core/store');
          await triggerMessageStoreSelfClean();
          useChatStore.getState().clearAllData();
        } catch (error) {
          console.warn('Could not clear chat stores on sign out:', error);
        }
      }
      
      // Additional check for user deletion - validate user still exists
      if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        if (supaSession?.user) {
          // Validate that the user still exists in the database
          validateUserExists(supaSession.user.id).catch(() => {
            // User doesn't exist anymore - clear auth state
            console.warn('[AuthContext] User no longer exists in database, clearing auth state');
            setUser(null);
            setSession(null);
          });
        }
      }
    });

    /* ────────────────────────────
     * Bootstrap existing session ONLY ONCE
     * ────────────────────────────*/
    if (typeof window !== 'undefined') (window as any).__authTrace.initialSessionChecks++;
    supabase.auth.getSession().then(async ({ data: { session: supaSession } }) => {
      log('debug', 'Initial session check', { hasSession: !!supaSession }, 'auth');
      
      // Set user and session state initially
      setUser(supaSession?.user ?? null);
      setSession(supaSession);
      setLoading(false);

      // Initial validation removed - getSession() already validates the session
      // No need for additional getUser() call
    }).catch((error) => {
      console.error('Error getting initial session:', error);
      setLoading(false);
    });

    // Removed periodic user validation - unnecessary and resource-intensive
    // User existence is validated on auth state changes only

    return () => {
      log('debug', 'Cleaning up auth subscription', null, 'auth');
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // clearPendingEmail function removed - handled by custom system

  // Validate that a user still exists in the database
  const validateUserExists = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (error || !data) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  };

  /* ──────────────────────────────────
   * Helpers exposed through context
   * ─────────────────────────────────*/
  const signIn = async (email: string, password: string) => {
    try {
      // Clean up any existing localStorage data before signing in
      // This ensures no stale data from previous sessions
      const { cleanupAuthState } = await import('@/utils/authCleanup');
      await cleanupAuthState();
      log('debug', 'Cleaned up existing auth state before signin', null, 'auth');

      // Note: 400 errors in console are expected for invalid credentials - handled gracefully below
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        // Return error without logging - UI will show "Invalid email or password"
        return { error, data: null };
      }
      
        // Email verification check removed - handled by custom verification system
        // Users will be redirected to verification page if needed

        if (data?.user) {
          setUser(data.user);
          setSession(data.session);
          setLoading(false);
        }
      
      return { error: null, data };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unexpected sign-in error');
      return { error, data: null };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      log('debug', 'Starting signup process', { email }, 'auth');

      // Clean up any existing localStorage data before creating new account
      // This ensures a fresh start for the new user
      const { cleanupAuthState } = await import('@/utils/authCleanup');
      await cleanupAuthState();
      log('debug', 'Cleaned up existing auth state before signup', null, 'auth');

      // Call the new Edge Function that handles user creation and email verification
      const { data, error } = await supabase.functions.invoke('create-user-and-verify', {
        body: {
          email,
          password
        }
      });

      if (error) {
        log('debug', 'Edge function error', { error }, 'auth');
        return { error: new Error(error.message || 'Failed to create account') };
      }

      if (!data?.success) {
        log('debug', 'Edge function returned error', { data }, 'auth');
        
        // Handle specific error codes for better user experience
        if (data?.code === 'EMAIL_EXISTS') {
          return { error: new Error('An account with this email already exists. Please sign in instead.') };
        }
        
        return { error: new Error(data?.error || 'Failed to create account') };
      }

      log('debug', 'Signup completed successfully', { userId: data.user_id }, 'auth');

      // Success case - verification email sent
      return { 
        error: null, 
        data: { 
          message: data.message || 'Verification email sent. Please check your inbox and click the verification link to complete registration.' 
        } 
      };

    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unexpected sign-up error');
      return { error };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    // Unified auth manager handles platform routing automatically
    return await getAuthManager().signInWithOAuth('google');
  };

  const signInWithApple = async (): Promise<{ error: Error | null }> => {
    // Unified auth manager handles platform routing automatically
    return await getAuthManager().signInWithOAuth('apple');
  };

  const signOut = async () => {
    try {
      debug('========== SIGN‑OUT ==========');
      setLoading(true);
      
      // Step 1: Clear local state first
      setUser(null);
      setSession(null);
      clearNavigationState();

      // Step 2: Comprehensive cleanup using utility
      const { cleanupAuthState } = await import('@/utils/authCleanup');
      await cleanupAuthState();

      // Step 3: Sign out from Supabase with global scope
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (signOutError) {
        console.warn('Supabase signOut failed, but continuing with cleanup:', signOutError);
      }

      // Step 4: Additional aggressive cleanup
      try {
        // Clear any remaining Supabase session data
        await supabase.auth.signOut({ scope: 'local' });
        
        // Clear any cookies that might contain session data
        if (typeof document !== 'undefined') {
          document.cookie.split(";").forEach((c) => {
            const eqPos = c.indexOf("=");
            const name = eqPos > -1 ? c.substr(0, eqPos) : c;
            if (name.includes('supabase') || name.includes('sb-') || name.includes('auth')) {
              document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
              document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
            }
          });
        }
      } catch (cleanupError) {
        console.warn('Additional cleanup failed:', cleanupError);
      }

      // No navigation - let user stay on current page
      // AuthGuard will show auth modal if needed
      
    } catch (error) {
      console.error('Sign out error:', error);
      // Continue with cleanup even on error - auth state change will handle the rest
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resend confirmation link if the user deleted the first one.
   * Only succeeds when the account exists & is still unconfirmed.
   */
  const resendVerificationEmail = async (email: string) => {
    try {
      // Get user ID for the email
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        return { error: new Error('User not found') };
      }

      // Use custom verification email function
      const { error } = await supabase.functions.invoke('email-verification', {
        body: {
          user_id: userData.user.id
        }
      });
      
      return { error };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Could not resend verification') };
    }
  };


  /* ────────────────────────────────────────────────────────────────*/
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isValidating,
        pendingEmailAddress,
        isPendingEmailCheck,
        isAuthenticated,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithApple,
        signOut,
        resendVerificationEmail,
        setPendingEmailAddress,
        clearPendingEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    console.error('useAuth called outside AuthProvider - check component hierarchy');
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
