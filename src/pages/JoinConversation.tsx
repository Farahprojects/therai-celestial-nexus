import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/core/types';
import ChatContainer from './ChatContainer';
import { setRedirectPath, encodeRedirectPath } from '@/utils/redirectUtils';

const JoinConversation: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsAuthenticated(!!session?.user);
      setAuthLoading(false);
    };
    
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {                                                                    
      setUser(session?.user || null);
      setIsAuthenticated(!!session?.user);
      setAuthLoading(false);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Check if conversation is public and load it
  useEffect(() => {
    // Wait for auth check to complete before proceeding
    if (authLoading) return;

    const loadPublicConversation = async () => {
      if (!chatId) {
        // Invalid chat ID - navigate to main route
        navigate('/therai', { replace: true });
        return;
      }

      // If user is not authenticated, preserve redirect and prompt for auth
      // This prevents RLS errors when querying conversations
      if (!isAuthenticated) {
        console.log('[JoinConversation] User not authenticated - preserving redirect for chat');
        const redirectPath = setRedirectPath(`/c/${chatId}`);
        const encodedRedirect = encodeRedirectPath(redirectPath);
        
        // Also store for backward compatibility
        try {
          localStorage.setItem('pending_join_chat_id', chatId);
        } catch {
          // Ignore localStorage errors
        }
        
        setLoading(false);
        navigate(`/therai?redirect=${encodedRedirect}`, { replace: true });
        return;
      }

      // User is authenticated - navigate immediately for seamless UX
      // Add as participant in background
      if (isAuthenticated && user) {
        console.log('[JoinConversation] User authenticated - navigating immediately');
        
        // Navigate first for instant, seamless transition
        navigate(`/c/${chatId}`, { replace: true });
        
        // Add user as participant in background (fire and forget)
        (async () => {
          try {
            const { data: existingParticipant } = await supabase
              .from('conversations_participants')
              .select('conversation_id')
              .eq('conversation_id', chatId)
              .eq('user_id', user.id)
              .maybeSingle();

            if (!existingParticipant) {
              await supabase
                .from('conversations_participants')
                .insert({
                  conversation_id: chatId,
                  user_id: user.id,
                  role: 'member',
                });
              console.log('[JoinConversation] Added user as participant in background');
            }
            
            // Clear pending keys
            try {
              localStorage.removeItem('pending_join_chat_id');
              localStorage.removeItem('pending_redirect_path');
            } catch (e) {
              // Ignore
            }
          } catch (err) {
            console.error('[JoinConversation] Error adding participant in background:', err);
          }
        })();
        
        return;
      }
    };

    loadPublicConversation();
  }, [chatId, isAuthenticated, user, authLoading, navigate]);

  const handleJoin = async () => {
    if (!isAuthenticated || !user || !chatId || !conversation) return;

    try {
      // Add this conversation to the user's conversations
      const { error: joinError } = await supabase
        .from('conversations')
        .insert({
          id: chatId,
          user_id: user.id,
          title: conversation.title,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          meta: conversation.meta
        });

      if (joinError) {
        console.error('Error joining conversation:', joinError);
        return;
      }

      setIsJoined(true);
      
      // Redirect to the full chat interface
      navigate(`/c/${chatId}`, { replace: true });
    } catch (err) {
      console.error('Error joining conversation:', err);
    }
  };

  const handleSignIn = () => {
    if (chatId) {
      const redirectPath = setRedirectPath(`/c/${chatId}`);
      const encodedRedirect = encodeRedirectPath(redirectPath);
      navigate(`/therai?redirect=${encodedRedirect}`);
    } else {
      navigate('/therai');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>                                     
          <p className="text-gray-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Component handles navigation internally - show loading or ChatContainer
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-light">Loading conversation...</p>
        </div>
      </div>
    );
  }
  
  if (!conversation || error) {
    // Will navigate to /therai - show ChatContainer in meantime
    return <ChatContainer />;
  }

  return (
    <ChatContainer />
  );
};

export default JoinConversation;
