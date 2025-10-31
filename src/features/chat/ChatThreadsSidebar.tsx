import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUserData } from '@/hooks/useUserData';
import { useThreads } from '@/contexts/ThreadsContext';
import { Trash2, Sparkles, AlertTriangle, MoreHorizontal, UserPlus, Plus, Search, User, Settings, Bell, CreditCard, LifeBuoy, LogOut, BarChart3, ChevronDown, MessageCircle, Orbit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReportModal } from '@/contexts/ReportModalContext';
import { getChatTokens, clearChatTokens } from '@/services/auth/chatTokens';
import { AuthModal } from '@/components/auth/AuthModal';
import { getUserTypeConfig, useUserPermissions } from '@/hooks/useUserType';
import { useSettingsModal } from '@/contexts/SettingsModalContext';
import { UserAvatar } from '@/components/settings/UserAvatar';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { updateConversationTitle } from '@/services/conversations';
import { unifiedWebSocketService } from '@/services/websocket/UnifiedWebSocketService';
import { supabase } from '@/integrations/supabase/client';
import { SearchModal } from '@/components/search/SearchModal';
import { NewChatDropdown } from '@/components/chat/NewChatDropdown';
import { AddFolderButton } from '@/components/folders/AddFolderButton';
import { FoldersList } from '@/components/folders/FoldersList';
import { FolderModal } from '@/components/folders/FolderModal';
import { ConversationActionsMenuContent } from '@/components/chat/ConversationActionsMenu';
import { getUserFolders, createFolder, updateFolderName, deleteFolder, getFolderConversations, moveConversationToFolder } from '@/services/folders';
import { getConversation } from '@/services/conversations';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';


interface ChatThreadsSidebarProps {
  className?: string;
  onDelete?: () => void;
  onCloseMobileSidebar?: () => void;
  conversationType?: 'chat' | 'swiss'; // Filter conversations by type
}

export const ChatThreadsSidebar: React.FC<ChatThreadsSidebarProps> = ({ 
  className, 
  onDelete, 
  onCloseMobileSidebar,
  conversationType = 'chat' // Default to chat
}) => {
  // Use single source of truth for auth state
  const { isAuthenticated } = useAuth();
  const { isSubscriptionActive } = useSubscription();
  const userPermissions = useUserPermissions();
  const uiConfig = getUserTypeConfig(isAuthenticated ? 'authenticated' : 'unauthenticated');
  
  // Credit balance state
  const [credits, setCredits] = useState<number>(0);
  const [creditsLoading, setCreditsLoading] = useState(true);

  // Function to refresh credit balance
  const refreshCredits = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[ChatThreadsSidebar] Failed to refresh credits:', error);
      } else {
        setCredits((data as any)?.credits || 0);
      }
    } catch (error) {
      console.error('[ChatThreadsSidebar] Failed to refresh credits:', error);
    }
  };
  
  // Get chat_id and folderId directly from URL (most reliable source)
  const { threadId, folderId } = useParams<{ threadId?: string; folderId?: string }>();
  const storeChatId = useChatStore((state) => state.chat_id);
  const navigate = useNavigate();
  
  // Use URL threadId as primary source, fallback to store
  const chat_id = threadId || storeChatId;
  
  const { 
    clearChat,
    clearAllData
  } = useChatStore();
  
  // Use centralized thread management with broadcast support
  const {
    threads,
    isLoadingThreads,
    threadsError,
    addThread,
    removeThread,
    pendingInsightThreads
  } = useChatStore();
  
  // Get messages from message store
  const { messages } = useMessageStore();

  const { user, signOut } = useAuth();
  const { displayName } = useUserData();
  
  const { open: openReportModal } = useReportModal();
  const { uuid } = getChatTokens();
  const { openSettings } = useSettingsModal();
  const isMobile = useIsMobile();

  // Settings handler
  const handleOpenSettings = (panel: string) => {
    openSettings(panel as "general" | "account" | "notifications" | "support" | "billing");
  };

  // Load credits and folders on mount
  useEffect(() => {
    const loadCredits = async () => {
      if (!user?.id) {
        setCreditsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('user_credits')
          .select('credits')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('[ChatThreadsSidebar] Failed to load credits:', error);
        } else {
          setCredits((data as any)?.credits || 0);
        }
      } catch (error) {
        console.error('[ChatThreadsSidebar] Failed to load credits:', error);
      } finally {
        setCreditsLoading(false);
      }
    };

    const loadFolders = async () => {
      try {
        let foldersList: Array<{ id: string; name: string; chatsCount: number; chats: Array<{ id: string; title: string }> }> = [];
        
        // For authenticated users, load their folders
        if (user?.id) {
          const userFolders = await getUserFolders(user.id);
          
          // Load conversations for each folder
          foldersList = await Promise.all(
            userFolders.map(async (folder) => {
              const conversations = await getFolderConversations(folder.id);
              return {
                id: folder.id,
                name: folder.name,
                chatsCount: conversations.length,
                chats: conversations.map(conv => ({
                  id: conv.id,
                  title: conv.title || 'New Chat',
                })),
              };
            })
          );
        }
        
        setFolders(foldersList);
      } catch (error) {
        console.error('[ChatThreadsSidebar] Failed to load folders:', error);
      }
    };
    
    // Load current conversation if accessing via join link (for unauthenticated users)
    const loadCurrentConversation = async () => {
      if (chat_id && !user?.id) {
        try {
          const conversation = await getConversation(chat_id);
          if (conversation && conversation.is_public) {
            // Check if conversation is already in threads
            const { threads } = useChatStore.getState();
            const exists = threads.some(t => t.id === chat_id);
            
            if (!exists) {
              // Add to threads list
              useChatStore.setState({ threads: [conversation, ...threads] });
            }
          }
        } catch (error) {
          console.error('[ChatThreadsSidebar] Failed to load current conversation:', error);
        }
      }
    };
    
    loadCredits();
    loadFolders();
    loadCurrentConversation();
  }, [user?.id, folderId, chat_id]);

  // Set up real-time subscription for credit balance updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user_credits_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[ChatThreadsSidebar] Credit balance updated:', payload);
          if (payload.new && 'credits' in payload.new) {
            setCredits((payload.new as any).credits);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Folder handlers
  const handleCreateFolder = async (name: string) => {
    if (!user?.id) return;
    
    try {
      // If editing, update the folder name
      if (editingFolder) {
        await updateFolderName(editingFolder.id, name);
        
        // Update local state
        setFolders(prev => prev.map(f => 
          f.id === editingFolder.id ? { ...f, name } : f
        ));
        
        setEditingFolder(null);
        return;
      }
      
      // Otherwise, create new folder
      const newFolder = await createFolder(user.id, name);
      
      // If there's a conversation waiting to be moved, move it now
      if (conversationToMoveToNewFolder) {
        await moveConversationToFolder(conversationToMoveToNewFolder, newFolder.id);
        setConversationToMoveToNewFolder(null);
        
        // Reload folders with updated counts and chat lists
        const userFolders = await getUserFolders(user.id);
        const foldersWithChats = await Promise.all(
          userFolders.map(async (folder) => {
            const conversations = await getFolderConversations(folder.id);
            return {
              id: folder.id,
              name: folder.name,
              chatsCount: conversations.length,
              chats: conversations.map(conv => ({
                id: conv.id,
                title: conv.title || 'New Chat',
              })),
            };
          })
        );
        
        setFolders(foldersWithChats);
        
        // Reload threads to update the main chat list
        const { loadThreads } = useChatStore.getState();
        await loadThreads(user.id);
      } else {
        // Add to local state (no conversation to move)
        setFolders(prev => [...prev, {
          id: newFolder.id,
          name: newFolder.name,
          chatsCount: 0,
          chats: [],
        }]);
      }
    } catch (error) {
      console.error('[ChatThreadsSidebar] Failed to create/update folder:', error);
    }
  };

  const handleEditFolder = (folderId: string, currentName: string) => {
    setEditingFolder({ id: folderId, name: currentName });
    setShowFolderModal(true);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!user?.id) return;
    
    try {
      await deleteFolder(folderId);
      
      // Remove from local state
      setFolders(prev => prev.filter(f => f.id !== folderId));
      
      // Reload threads to show conversations that were in the deleted folder
      const { loadThreads } = useChatStore.getState();
      await loadThreads(user.id);
    } catch (error) {
      console.error('[ChatThreadsSidebar] Failed to delete folder:', error);
    }
  };

  const handleFolderClick = (folderId: string) => {
    // Navigate to folder URL
    navigate(`/folders/${folderId}`, { replace: true });
    onCloseMobileSidebar?.();
  };

  const handleFolderChatClick = (folderId: string, chatId: string) => {
    // Navigate to the chat (handleSwitchToChat already handles swiss vs chat routing)
    handleSwitchToChat(chatId);
  };

  const handleMoveToFolder = async (conversationId: string, folderId: string | null) => {
    if (!user?.id) return;
    
    try {
      await moveConversationToFolder(conversationId, folderId);
      
      // Reload folders to update counts and chat lists
      const userFolders = await getUserFolders(user.id);
      const foldersWithChats = await Promise.all(
        userFolders.map(async (folder) => {
          const conversations = await getFolderConversations(folder.id);
          return {
            id: folder.id,
            name: folder.name,
            chatsCount: conversations.length,
            chats: conversations.map(conv => ({
              id: conv.id,
              title: conv.title || 'New Chat',
            })),
          };
        })
      );
      
      setFolders(foldersWithChats);
      
      // Reload threads to update the main chat list
      const { loadThreads } = useChatStore.getState();
      await loadThreads(user.id);
    } catch (error) {
      console.error('[ChatThreadsSidebar] Failed to move conversation to folder:', error);
    }
  };

  const handleCreateFolderAndMove = (conversationId: string) => {
    setConversationToMoveToNewFolder(conversationId);
    setShowFolderModal(true);
  };

  const [hoveredThread, setHoveredThread] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [showEditTitle, setShowEditTitle] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCreditPurchaseModal, setShowCreditPurchaseModal] = useState(false);
  
  // Folders state (dev-only UI while building)
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);
  const [conversationToMoveToNewFolder, setConversationToMoveToNewFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<Array<{
    id: string;
    name: string;
    chatsCount: number;
    chats: Array<{ id: string; title: string }>;
  }>>([]);
  const [areFoldersExpanded, setAreFoldersExpanded] = useState(true);
  
  // Lazy loading state
  const [visibleThreads, setVisibleThreads] = useState(10); // Show first 10 threads initially
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Thread loading is now handled by ThreadsProvider
  // No need for manual loadThreads() calls

  // Helper function to format report type for display
  const formatReportType = (reportType: string) => {
    const typeMap: Record<string, string> = {
      'essence_personal': 'Personal',
      'essence_professional': 'Professional', 
      'essence_relationship': 'Relationship',
      'sync_personal': 'Compatibility',
      'sync_professional': 'Co-working'
    };
    return typeMap[reportType] || reportType;
  };

  // Set up report completion listener for authenticated users
  // ISOLATED: Own channel, doesn't interfere with chat message subscriptions
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    
    // Create dedicated channel for ALL report completions (not tied to UnifiedWebSocketService)
    const reportChannel = supabase
      .channel('report-completions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'insights',
          filter: `user_id=eq.${user.id}` // Only this user's reports
        },
        async (payload) => {
          const insight = payload.new;
          
          // Check if the insight is marked as ready
          if (insight.is_ready === true) {
            console.log('[ChatThreadsSidebar] Report completed:', insight.id);
            // Note: Conversation already created by addThread in AstroDataForm
            // Just remove from pending map
            const { pendingInsightThreads } = useChatStore.getState();
            const newPendingMap = new Map(pendingInsightThreads);
            newPendingMap.delete(insight.id);
            useChatStore.setState({ pendingInsightThreads: newPendingMap });
          }
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(reportChannel);
    };
  }, [isAuthenticated, user?.id]);


  // Handle switching to a different conversation
  const handleSwitchToChat = async (conversationId: string) => {
    // Find the conversation to check its mode
    const conversation = threads.find(t => t.id === conversationId);
    
      // For Swiss conversations, navigate to Astro page (no WebSocket needed)
      if (conversation?.mode === 'swiss') {
        navigate(`/astro?chat_id=${conversationId}`, { replace: true });
      onCloseMobileSidebar?.();
      return;
    }
    
    // For regular chat conversations, proceed with full chat flow
    // DIRECT FLOW: Immediately set chat_id and fetch messages
    const { setChatId } = useMessageStore.getState();
    setChatId(conversationId);
    
    // Also update the main chat store
    const { startConversation } = useChatStore.getState();
    startConversation(conversationId);
    
    // Switch WebSocket subscription to new chat_id
    const { chatController } = await import('@/features/chat/ChatController');
    await chatController.switchToChat(conversationId);
    
    // Navigate to auth route
    navigate(`/c/${conversationId}`, { replace: true });
    
    // Close mobile sidebar if callback provided
    onCloseMobileSidebar?.();
  };

  // Handle clicking on insight report - create or navigate to dedicated chat thread
  const handleInsightClick = async (reportId: string, reportType: string) => {
    if (!user?.id) return;
    
    try {
      // Check if insight chat thread already exists
      const { data: existingChat } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', reportId) // Use reportId as chat_id
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingChat) {
        // Navigate to existing insight chat thread
        await handleSwitchToChat(reportId);
      } else {
        // Create new insight chat thread using reportId as chat_id
        const { error } = await supabase
          .from('conversations')
          .insert({
            id: reportId, // Use report_id as chat_id
            user_id: user.id,
            title: formatReportType(reportType), // Just the type name (Personal, Professional, etc.)
            mode: 'insight', // Explicitly set mode to insight
            meta: {
              type: 'insight_chat',
              insight_report_id: reportId,
              parent_report_type: reportType
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('[ChatThreadsSidebar] Failed to create insight chat thread:', error);
          return;
        }

        // Refresh threads to include the new insight chat
        const { loadThreads } = useChatStore.getState();
        await loadThreads(user.id);

        // Navigate to the new insight chat thread
        await handleSwitchToChat(reportId);
      }
    } catch (error) {
      console.error('[ChatThreadsSidebar] Error handling insight click:', error);
    }
  };

  // Handle deleting/clearing based on user type
  const handleDeleteOrClearChat = async () => {
    if (isAuthenticated && conversationToDelete) {
      setIsDeleting(true);
      // DELETE CHAT THREAD: Delete from conversations and insights tables
      try {
        // Check if this is an insight chat thread (has meta.type === 'insight_chat')
        const { data: conversation } = await supabase
          .from('conversations')
          .select('meta')
          .eq('id', conversationToDelete)
          .maybeSingle();

        const isInsightChat = (conversation?.meta as any)?.type === 'insight_chat';

        // Delete from conversations table (cascades to messages)
        const { error: convDeleteError } = await supabase
          .from('conversations')
          .delete()
          .eq('id', conversationToDelete);
        
        if (convDeleteError) {
          console.error('[ChatThreadsSidebar] Failed to delete chat thread:', convDeleteError);
          return;
        }

        // If it's an insight chat, also delete from insights, report_logs, translator_logs
        if (isInsightChat) {
          // Delete from insights table
          await supabase.from('insights').delete().eq('id', conversationToDelete);
          // Delete from report_logs - uses chat_id not user_id
          await supabase.from('report_logs').delete().eq('chat_id', conversationToDelete);
          // Delete from translator_logs - uses chat_id not user_id  
          await supabase.from('translator_logs').delete().eq('chat_id', conversationToDelete);
        }

        // Update UI immediately - remove from local threads state
        const currentState = useChatStore.getState();
        useChatStore.setState({ 
          threads: currentState.threads.filter(thread => thread.id !== conversationToDelete) 
        });
        
        setShowDeleteConfirm(false);
        setConversationToDelete(null);
        
        // If this was the current chat, clear the session
        if (currentState.chat_id === conversationToDelete) {
          currentState.clearChat();
        }
        
          // Navigate to therai after deleting conversation
          setIsDeleting(false);
          navigate('/therai', { replace: true });
      } catch (error) {
        console.error('[ChatThreadsSidebar] Error deleting chat thread:', error);
        setIsDeleting(false);
      }
    } else {
      // Unauthenticated user: Clear session and redirect to main page for clean slate
      try {
        // Set delete flag to prevent rehydration
        if (onDelete) {
          onDelete();
        }
        
        // 1. Clear all stores first (atomic cleanup)
        const { clearChat } = useChatStore.getState();
        clearChat();
        
        // 2. Nuke all storage to prevent race conditions
        sessionStorage.clear();
        localStorage.removeItem('chat_id');
        localStorage.removeItem('therai_active_chat_auth_');
        
        // 3. Server cleanup (simplified for authenticated users)
        
        // 4. Now redirect only after cleanup is done (replace prevents history issues)
        window.location.replace('/c');
      } catch (error) {
        console.error('[ChatThreadsSidebar] ❌ Session cleanup failed:', error);
        // Fallback: Force navigation anyway
        window.location.replace('/c');
      }
    }
  };


  // Generate thread title from first user message
  const threadTitle = useMemo(() => {
    if (messages.length === 0) return 'New Chat';
    
    // Find first user message
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (!firstUserMessage?.text) return 'New Chat';
    
    // Get first few words (max 6 words, max 30 chars)
    const words = firstUserMessage.text.trim().split(/\s+/);
    const firstWords = words.slice(0, 6).join(' ');
    
    if (firstWords.length <= 30) {
      return firstWords;
    }
    
    // Truncate to 30 chars and add ellipsis
    return firstWords.substring(0, 27) + '...';
  }, [messages]);

  // Filter threads by conversation type first
  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      // Filter by conversation type
      // Swiss conversations have mode='swiss', regular chat has mode='chat' or null
      if (conversationType === 'swiss') {
        return thread.mode === 'swiss';
      } else {
        // Chat page shows all non-swiss conversations (chat, astro, insight, or null)
        return thread.mode !== 'swiss';
      }
    });
  }, [threads, conversationType]);

  // Apply lazy loading to filtered threads
  const visibleThreadsList = useMemo(() => {
    return filteredThreads.slice(0, visibleThreads);
  }, [filteredThreads, visibleThreads]);

  const isSharedThread = (thread: any) => {
    try {
      // Show pill if:
      // - user is a member (not owner), or
      // - user is the owner and at least one other participant has joined
      const participant = thread?.conversations_participants?.[0];
      const isMember = participant?.role === 'member';
      const ownerWithOthers = participant?.role === 'owner' && thread?.has_other_participants === true;
      return isMember || ownerWithOthers;
    } catch {
      return false;
    }
  };

  // Check if there are more threads to load (only count filtered threads)
  const hasMoreThreads = filteredThreads.length > visibleThreads;

  // Load more threads function
  const loadMoreThreads = useCallback(async () => {
    if (isLoadingMore || !hasMoreThreads) return;
    
    setIsLoadingMore(true);
    
    // Simulate loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setVisibleThreads(prev => Math.min(prev + 10, filteredThreads.length));
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreThreads, filteredThreads.length]);

  // Handle edit title
  const handleEditTitle = (conversationId: string, currentTitle: string) => {
    setEditingConversationId(conversationId);
    setEditTitle(currentTitle || '');
    setShowEditTitle(true);
  };

  // Save title changes
  const handleSaveTitle = async () => {
    if (!editingConversationId || !editTitle.trim() || isSavingTitle) return;
    
    setIsSavingTitle(true);
    
    try {
      // Update conversation title in conversations table
      // Fire-and-forget API call - don't wait for it
      updateConversationTitle(editingConversationId, editTitle.trim()).catch((error) => {
        console.error('[ChatThreadsSidebar] Failed to update title:', error);
      });
      
      // Immediately update the local state for instant UI feedback
      const { updateConversation, threads } = useChatStore.getState();
      const existingConversation = threads.find(t => t.id === editingConversationId);
      
      if (existingConversation) {
        const updatedConversation = {
          ...existingConversation,
          title: editTitle.trim(),
          updated_at: new Date().toISOString()
        };
        updateConversation(updatedConversation);
      }
      
      // Close modal immediately after local update
      setShowEditTitle(false);
      setEditingConversationId(null);
      setEditTitle('');
    } catch (error) {
      console.error('[ChatThreadsSidebar] Failed to update title:', error);
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    if (isSavingTitle) return; // Prevent canceling while saving
    setShowEditTitle(false);
    setEditingConversationId(null);
    setEditTitle('');
  };





  return (
    <div className={cn("w-full h-full flex flex-col", className)}>

      {/* Scrollable middle section - only threads scroll */}
      <div className="flex-1 overflow-y-auto min-h-0">

      {/* Thread history */}
      <div className="space-y-1">
        {/* New Chat and Search - show for all users */}
        {conversationType !== 'swiss' && uiConfig.newChatLabel && (
          <NewChatDropdown className="w-full font-light" />
        )}
        
        {conversationType !== 'swiss' && uiConfig.showSearchChat && (
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-black hover:bg-gray-100 rounded-lg transition-colors font-light"
          >
            <Search className="w-4 h-4" />
            Search chat
          </button>
        )}

        {/* Folders Section - show for all users */}
        <AddFolderButton 
          onClick={() => {
            if (!isAuthenticated) {
              // Show auth modal if not authenticated
              setShowAuthModal(true);
              return;
            }
            setEditingFolder(null);
            setShowFolderModal(true);
          }}
          isExpanded={areFoldersExpanded}
          onToggleExpand={() => setAreFoldersExpanded(!areFoldersExpanded)}
        />
        {areFoldersExpanded && (
          <FoldersList
            folders={folders}
            onFolderClick={handleFolderClick}
            onChatClick={handleFolderChatClick}
            onEditFolder={isAuthenticated ? handleEditFolder : undefined}
            onDeleteFolder={isAuthenticated ? handleDeleteFolder : undefined}
            onEditChat={isAuthenticated ? handleEditTitle : undefined}
            onDeleteChat={isAuthenticated ? (conversationId) => {
              setConversationToDelete(conversationId);
              setShowDeleteConfirm(true);
            } : undefined}
            onMoveToFolder={isAuthenticated ? handleMoveToFolder : undefined}
            onCreateFolder={isAuthenticated ? handleCreateFolderAndMove : undefined}
            allFolders={folders.map(f => ({ id: f.id, name: f.name }))}
            activeChatId={chat_id}
          />
        )}
        
        {/* Space between Folders and Chat History */}
        <div className="py-2"></div>
        
        {/* Chat history section */}
        <div className="space-y-0.5">
          <div className="text-xs text-gray-600 font-medium px-3 py-0.5">{uiConfig.threadSectionLabel}</div>
            {isLoadingThreads ? (
              // Loading skeleton
              <div className="space-y-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="text-xs text-gray-500 px-3 py-0.5">No previous chats</div>
            ) : (
              <div className="space-y-0.5">
                {visibleThreadsList.map((conversation) => {
                  const isActive = conversation.id === chat_id;
                  const isPendingInsight = pendingInsightThreads.has(conversation.id);
                  const isPending = (conversation.meta as any)?.isPending === true || isPendingInsight;
                  
                  return (
                    <div
                      key={conversation.id}
                      className="relative group"
                      onMouseEnter={() => setHoveredThread(conversation.id)}
                      onMouseLeave={() => setHoveredThread(null)}
                    >
                      <div className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-gray-100' 
                          : isPending 
                            ? 'opacity-60' 
                            : 'hover:bg-gray-100'
                      }`}>
                      {/* Show spinner for pending threads */}
                      {isPending && (
                        <svg className="w-4 h-4 animate-spin text-gray-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      <div 
                        className={`flex-1 min-w-0 ${isPending ? 'cursor-default' : 'cursor-pointer'}`}
                        onClick={() => !isPending && handleSwitchToChat(conversation.id)}
                      >
                        <div className="flex items-center gap-2">
                          {/* Mode icon */}
                          {conversation.mode === 'insight' && <Sparkles className="w-4 h-4 flex-shrink-0 text-gray-600" />}
                          {conversation.mode === 'astro' && <Orbit className="w-4 h-4 flex-shrink-0 text-gray-600" />}
                          {(conversation.mode === 'chat' || !conversation.mode) && <MessageCircle className="w-4 h-4 flex-shrink-0 text-gray-600" />}
                          <div className="text-sm font-medium text-gray-900 truncate" title={conversation.title || 'New Chat'}>
                            {conversation.title || 'New Chat'}
                          </div>
                          {isSharedThread(conversation) && (
                            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              Shared
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Three dots menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-gray-600" />
                          </button>
                        </DropdownMenuTrigger>
                        <ConversationActionsMenuContent
                          conversationId={conversation.id}
                          currentTitle={conversation.title || ''}
                          onEdit={handleEditTitle}
                          onDelete={(conversationId) => {
                            setConversationToDelete(conversationId);
                            setShowDeleteConfirm(true);
                          }}
                          onMoveToFolder={handleMoveToFolder}
                          onCreateFolder={handleCreateFolderAndMove}
                          folders={folders.map(f => ({ id: f.id, name: f.name }))}
                          currentFolderId={conversation.folder_id || null}
                          align="end"
                        />
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
                
                {/* Load More Button */}
                {hasMoreThreads && (
                  <div className="pt-2">
                    <button
                      onClick={loadMoreThreads}
                      disabled={isLoadingMore}
                      className="w-full px-3 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingMore ? 'Loading...' : `Load more (${filteredThreads.length - visibleThreads} remaining)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Clean Footer - Sticky at bottom */}
      <div className="mt-auto pt-4 shrink-0">
        {isAuthenticated ? (
          /* Authenticated User - Settings Menu */
          <div className="space-y-2">
            {isMobile ? (
              /* Mobile: Simple button that opens settings directly */
              <Button 
                variant="ghost" 
                className="w-full justify-start p-0 h-auto rounded-none bg-transparent hover:bg-gray-100 hover:text-gray-900"
                onClick={() => handleOpenSettings('general')}
              >
                  <div className="flex items-center gap-3 px-3 py-2 w-full">
                    <UserAvatar size="xs" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {displayName}
                      </div>
                    </div>
                    {!creditsLoading && credits === 0 && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCreditPurchaseModal(true);
                        }}
                        className="flex-shrink-0 px-3 py-1 text-xs font-light bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        Upgrade
                      </div>
                    )}
                    <Settings className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  </div>
              </Button>
            ) : (
              /* Desktop: Dropdown Menu */
              <DropdownMenu>
                {/* Wrapper with flex layout */}
                <div className="w-full flex items-center gap-2 px-3 py-2 rounded-none hover:bg-gray-100 transition-colors">
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 flex-1 min-w-0 bg-transparent hover:bg-transparent">
                      <UserAvatar size="xs" />
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {displayName}
                        </div>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  
                  {!creditsLoading && credits === 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCreditPurchaseModal(true);
                      }}
                      className="flex-shrink-0 px-3 py-1 text-xs font-light bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
                <DropdownMenuContent align="end" className="min-w-48 rounded-xl border border-gray-200 shadow-lg p-1">
                  
                  <DropdownMenuItem onClick={() => handleOpenSettings('general')}>
                    <Settings className="mr-2 h-4 w-4" />
                    General
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenSettings('account')}>
                    <User className="mr-2 h-4 w-4" />
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenSettings('billing')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenSettings('notifications')}>
                    <Bell className="mr-2 h-4 w-4" />
                    Notifications
                  </DropdownMenuItem>
                  
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <LifeBuoy className="mr-2 h-4 w-4" />
                      Help
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => window.open('/legal', '_blank')}>
                        Legal & Terms
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenSettings('support')}>
                        Contact Support
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  
                  <DropdownMenuItem onClick={() => signOut()} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          /* Unauthenticated User - Sign In Button */
          uiConfig.authButtonLabel && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-4/5 px-2.5 py-2 text-sm bg-gray-900 text-white hover:bg-gray-800 rounded-full transition-colors font-light"
              >
                {uiConfig.authButtonLabel}
              </button>
            </div>
          )
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && uiConfig.chatMenuActions.delete && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {uiConfig.chatMenuActions.delete.confirmTitle}
                </h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              {uiConfig.chatMenuActions.delete.confirmMessage}
            </p>
            
            <div className="flex gap-3 justify-between">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleDeleteOrClearChat();
                  setShowDeleteConfirm(false);
                  setConversationToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {uiConfig.chatMenuActions.delete.confirmButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Title Popup */}
      {showEditTitle && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Chat Title</h3>
              <button
                onClick={handleCancelEdit}
                disabled={isSavingTitle}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editTitle.trim() && !isSavingTitle) {
                      handleSaveTitle();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  placeholder="Enter chat title..."
                  disabled={isSavingTitle}
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleSaveTitle}
                  disabled={!editTitle.trim() || isSavingTitle}
                  className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isSavingTitle && (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {isSavingTitle ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="login"
      />


      {/* Search Modal */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectMessage={(chatId, messageId) => {
          // Use handleSwitchToChat to ensure proper routing (swiss vs chat)
          handleSwitchToChat(chatId);
          // TODO: Implement scroll to specific message
        }}
      />

      {/* Folder Creation/Edit Modal */}
      <FolderModal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false);
          setEditingFolder(null);
          setConversationToMoveToNewFolder(null);
        }}
        onCreateFolder={handleCreateFolder}
        editingFolder={editingFolder}
      />

      {/* Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showCreditPurchaseModal}
        onClose={() => {
          setShowCreditPurchaseModal(false);
          refreshCredits(); // Refresh credit balance after purchase
        }}
        onNavigateToCheckout={() => {
          // Close any open modals when navigating to checkout
          setShowCreditPurchaseModal(false);
        }}
      />
    </div>
  );
};
