import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/core/types';
import ChatContainer from './ChatContainer';

const JoinConversation: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsAuthenticated(!!session?.user);
    };
    
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {                                                                    
      setUser(session?.user || null);
      setIsAuthenticated(!!session?.user);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Check if conversation is public and load it
  useEffect(() => {
    const loadPublicConversation = async () => {
      if (!chatId) {
        // Invalid chat ID - navigate to main route
        navigate('/therai', { replace: true });
        return;
      }

      try {
        // Check if conversation exists and is public
        const { data, error: fetchError } = await supabase
          .from('conversations')
          .select('id, user_id, title, created_at, updated_at, meta, is_public')
          .eq('id', chatId)
          .eq('is_public', true)
          .maybeSingle();

        if (fetchError || !data) {
          // Conversation not found or not public - check if it's private and needs auth
          if (!isAuthenticated) {
            // Try to fetch to see if it exists (might be private)
            const { data: privateConv } = await supabase
              .from('conversations')
              .select('id')
              .eq('id', chatId)
              .maybeSingle();
            
            if (privateConv) {
              // Private conversation - store pending and full URL path
              localStorage.setItem('pending_join_chat_id', chatId);
              localStorage.setItem('pending_redirect_path', `/c/${chatId}`);
              navigate('/therai', { replace: true });
              return;
            }
          }
          
          // Conversation doesn't exist - navigate to main route
          navigate('/therai', { replace: true });
          return;
        }

        setConversation(data as Conversation);

        // If user is signed in, add them as a participant; then redirect to /c/:chatId
        if (isAuthenticated && user) {
          // Check if user is already a participant
          const { data: existingParticipant } = await supabase
            .from('conversations_participants')
            .select('conversation_id')
            .eq('conversation_id', chatId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!existingParticipant) {
            // Add user as a participant
            const { error: insertError } = await supabase
              .from('conversations_participants')
              .insert({
                conversation_id: chatId,
                user_id: user.id,
                role: 'member', // Default to member role
              });

            if (insertError) {
              console.error('Error adding user as participant:', insertError);
              setError('Failed to join conversation');
              setLoading(false);
              return;
            }
          }

          setIsJoined(true);
          navigate(`/c/${chatId}`, { replace: true });
          return;
        }
      } catch (err) {
        console.error('Error loading conversation:', err);
        // On error, navigate to main route instead of showing error
        navigate('/therai', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadPublicConversation();
  }, [chatId, isAuthenticated, user]);

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
    try {
      if (chatId) {
        localStorage.setItem('pending_join_chat_id', chatId);
      }
    } catch {}
    navigate('/therai');
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
