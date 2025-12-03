
import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError, safeConsoleLog } from '@/utils/safe-logging';
export interface GenerateInsightRequest {
  clientId: string;
  coachId: string;
  insightType: string;
  title: string;
  clientData: {
    fullName: string;
    goals?: string;
    journalEntries?: Array<{
      id: string;
      title?: string;
      entry_text: string;
      created_at: string;
    }>;
    previousReportTexts?: string;    // New field for report content
    previousAstroDataText?: string;  // Existing field for astro data
  };
}

export interface GenerateInsightResponse {
  success: boolean;
  insightId?: string;
  content?: string;
  error?: string;
  requestId?: string;
}

export const insightsService = {
  async generateInsight(request: {
    clientId: string;
    coachId: string;
    insightType: string;
    title: string;
    clientData: {
      fullName: string;
      goals?: string;
      journalEntries?: Array<{
        id: string;
        title?: string;
        entry_text: string;
        created_at: string;
      }>;
      previousReportTexts?: string;    // New field for report content
      previousAstroDataText?: string;  // Existing field for astro data
    };
  }): Promise<GenerateInsightResponse> {
    console.log('🚀 === INSIGHTS SERVICE: Starting generateInsight ===');
    console.log('🚀 SERVICE: Raw request received:', request);
    
    try {
      // Get current session with better error handling
      console.log('🚀 SERVICE: === AUTHENTICATION STEP ===');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        safeConsoleError('🚀 SERVICE: Session error details:', sessionError);
        return {
          success: false,
          error: 'Authentication session error. Please try signing in again.'
        };
      }

      if (!session?.user?.id) {
        console.error('🚀 SERVICE: No authenticated user found in session');
        return {
          success: false,
          error: 'You must be signed in to generate insights. Please sign in and try again.'
        };
      }

      safeConsoleLog('🚀 SERVICE: User authenticated:', session.user.id);

      // Mock API key for now since table was dropped
      console.log('🚀 SERVICE: === API KEY MOCK (TABLE DROPPED) ===');
      const mockApiKey = 'mock_api_key_for_insights';
      console.log('🚀 SERVICE: Using mock API key for insights generation');

      // Extract plain text from journal entries (if included)
      console.log('🚀 SERVICE: === DATA TRANSFORMATION ===');
      let journalText = 'No journal entries available.';
      
      if (request.clientData.journalEntries) {
        console.log('🚀 SERVICE: Processing journal entries:', request.clientData.journalEntries.length);
        
        journalText = request.clientData.journalEntries.map((entry, index) => {
          safeConsoleLog(`🚀 SERVICE: Processing journal entry ${index + 1}:`, {
            id: entry.id,
            title: entry.title,
            entry_text_length: entry.entry_text?.length || 0,
            created_at: entry.created_at
          });
          
          const title = entry.title ? `Title: ${entry.title}\n` : '';
          const date = new Date(entry.created_at).toLocaleDateString();
          return `${title}Date: ${date}\nContent: ${entry.entry_text}`;
        }).join('\n\n---\n\n');
      }

      console.log('🚀 SERVICE: Transformed journal text length:', journalText.length);

      // Create the payload object with flexible data fields
      const payload = {
        clientId: request.clientId,
        coachId: request.coachId,
        insightType: request.insightType,
        title: request.title,
        clientData: {
          fullName: request.clientData.fullName,
          goals: request.clientData.goals,
          journalText,
          // Include report texts if provided
          ...(request.clientData.previousReportTexts && { previousReportTexts: request.clientData.previousReportTexts }),
          // Include astro data if provided  
          ...(request.clientData.previousAstroDataText && { previousAstroDataText: request.clientData.previousAstroDataText })
        }
      };

      console.log('🚀 SERVICE: === CALLING EDGE FUNCTION ===');
      console.log('🚀 SERVICE: Final payload being sent:', payload);
      console.log('🚀 SERVICE: Payload includes report texts:', !!payload.clientData.previousReportTexts);
      console.log('🚀 SERVICE: Payload includes astro data:', !!payload.clientData.previousAstroDataText);
      console.log('🚀 SERVICE: About to call supabase.functions.invoke...');
      
      // Use the safe pattern - send raw object, let Supabase handle stringification and headers
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: payload,  // ✅ Raw object - Supabase will stringify automatically
        headers: {
          Authorization: `Bearer ${mockApiKey}`,
          // 🚫 Removed Content-Type - let Supabase set it automatically
        }
      });

      console.log('🚀 SERVICE: === EDGE FUNCTION RESPONSE ===');
      console.log('🚀 SERVICE: Response data:', data);
      console.log('🚀 SERVICE: Response error:', error);
      
      if (error) {
        console.error('🚀 SERVICE: Edge function error details:', '[REDACTED ERROR OBJECT - Check for sensitive data]');
        return {
          success: false,
          error: error.message || 'Failed to generate insight. Please try again.'
        };
      }

      console.log('🚀 SERVICE: Edge function call successful, returning data');
      return data;
    } catch (error) {
      console.error('🚀 SERVICE: === CRITICAL ERROR IN INSIGHTS SERVICE ===');
      console.error('🚀 SERVICE: Error type:', typeof error);
      console.error('🚀 SERVICE: Error name:', error instanceof Error ? error.name : 'Unknown');
      console.error('🚀 SERVICE: Error message:', error instanceof Error ? error.message : String(error));
      // Stack trace logging removed for security - full error logged via safeConsoleError above
      safeConsoleError('🚀 SERVICE: Full error object:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred while generating the insight.'
      };
    }
  }
};
