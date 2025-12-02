
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';


interface SessionValidationResult {
  isValid: boolean;
  session: Session | null;
  user: User | null;
  needsRefresh: boolean;
}

class AuthService {
  private refreshPromise: Promise<Session | null> | null = null;

  /**
   * Validates current session and checks if token needs refresh
   */
  async validateSession(): Promise<SessionValidationResult> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return { isValid: false, session: null, user: null, needsRefresh: true };
      }

      if (!session) {
        return { isValid: false, session: null, user: null, needsRefresh: false };
      }

      // Check if token expires within the next 5 minutes
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      const needsRefresh = expiresAt - now < fiveMinutes;

      return {
        isValid: true,
        session,
        user: session.user,
        needsRefresh
      };
    } catch (_error) {
      return { isValid: false, session: null, user: null, needsRefresh: true };
    }
  }

  /**
   * Proactively refreshes the session token
   */
  async refreshSession(): Promise<Session | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._performRefresh();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    return result;
  }

  private async _performRefresh(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return null;
      }

      return session;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Ensures we have a valid session before making API calls
   */
  async ensureValidSession(): Promise<Session | null> {
    const validation = await this.validateSession();
    
    if (!validation.isValid) {
      // Try to refresh if we think it might help
      if (validation.needsRefresh) {
        return await this.refreshSession();
      }
      return null;
    }

    // Proactively refresh if token expires soon
    if (validation.needsRefresh) {
      const refreshed = await this.refreshSession();
      return refreshed || validation.session;
    }

    return validation.session;
  }

  /**
   * Checks if current session has a valid auth token for backend RLS
   */
  async verifyBackendAuth(): Promise<boolean> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return false;
      }

      return true;
    } catch (_error) {
      return false;
    }
  }
}

export const authService = new AuthService();
