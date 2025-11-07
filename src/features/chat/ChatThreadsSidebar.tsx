import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Orbit, Sparkles, MoreHorizontal, Search, Image, Blend, SquarePen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserData } from '@/hooks/useUserData';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/settings/UserAvatar';
import { AuthModal } from '@/components/auth/AuthModal';
import { SearchModal } from '@/components/search/SearchModal';
import { AddFolderButton } from '@/components/folders/AddFolderButton';
import { ImageGallery } from '@/components/chat/ImageGallery';
import { ExploreActions } from '@/components/chat/ExploreActions';
import { useChatCreation } from '@/components/chat/ChatCreationProvider';
import { FoldersList } from '@/components/folders/FoldersList';
import { FolderModal } from '@/components/folders/FolderModal';
import { useSettingsModal } from '@/contexts/SettingsModalContext';
import { ConversationActionsMenuContent } from '@/components/chat/ConversationActionsMenu';
import { getConversation, updateConversationTitle } from '@/services/conversations';
import { getUserFolders, createFolder, updateFolderName, deleteFolder, getFolderConversations, getSharedFolder, moveConversationToFolder } from '@/services/folders';
import { supabase } from '@/integrations/supabase/client';

/**
 * ChatThreadsSidebar (refactored)
 * Goals:
 * - Trim unused state & imports
 * - Centralize folder-loading logic
 * - Prefer derived state over duplicated state
 * - Keep existing external components/APIs so the rest of the app keeps working
 * - Small, predictable effects; no hidden cross-feature coupling
 */

interface ChatThreadsSidebarProps {
  className?: string;
  onDelete?: () => void;
  onCloseMobileSidebar?: () => void;
  conversationType?: 'chat' | 'swiss';
}

/** Lightweight helpers **/
const useIntersection = (callback: () => void) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) callback();
    });
    io.observe(el);
    return () => io.unobserve(el);
  }, [callback]);
  return ref;
};

/** Folder shape used locally **/
interface SidebarFolder {
  id: string;
  name: string;
  chatsCount: number;
  chats: Array<{ id: string; title: string }>
}

/** Consolidated folder loader with minimal branching **/
const useFolders = (userId?: string, currentFolderId?: string) => {
  const [folders, setFolders] = useState<SidebarFolder[]>([]);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    try {
      const list: SidebarFolder[] = [];

      if (userId) {
        const userFolders = await getUserFolders(userId);
        const withChats = await Promise.all(userFolders.map(async (f) => {
          const conversations = await getFolderConversations(f.id);
          return {
            id: f.id,
            name: f.name,
            chatsCount: conversations.length,
            chats: conversations.map((c: any) => ({ id: c.id, title: c.title || 'New Chat' }))
          } as SidebarFolder;
        }));
        list.push(...withChats);
      }

      // If viewing a shared folder that isn't already present, load it
      if (currentFolderId && !list.find(f => f.id === currentFolderId)) {
        try {
          const shared = await getSharedFolder(currentFolderId);
          if (shared) {
            const conversations = await getFolderConversations(currentFolderId);
            list.push({
              id: shared.id,
              name: shared.name,
              chatsCount: conversations.length,
              chats: conversations.map((c: any) => ({ id: c.id, title: c.title || 'New Chat' }))
            });
          }
        } catch { /* non-blocking */ }
      }

      // Deduplicate by id
      const uniq: SidebarFolder[] = [];
      const seen = new Set<string>();
      for (const f of list) {
        if (!seen.has(f.id)) { seen.add(f.id); uniq.push(f); }
      }
      setFolders(uniq);
    } catch (e) {
      console.error('[ChatThreadsSidebar] loadFolders failed', e);
    }
  }, [userId, currentFolderId]);

  return { folders, setFolders, expanded, setExpanded, load };
};

export const ChatThreadsSidebar: React.FC<ChatThreadsSidebarProps> = ({
  className,
  onDelete,
  onCloseMobileSidebar,
  conversationType = 'chat'
}) => {
  const { startChat } = useChatCreation();
  const { threadId, folderId } = useParams<{ threadId?: string; folderId?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Auth / user
  const { isAuthenticated, user, signOut } = useAuth();
  const { openSettings } = useSettingsModal();
  const handleLegalTerms = () => {
    window.open('/legal', '_blank');
  };

  const { displayName } = useUserData();

  // Stores
  const {
    threads,
    isLoadingThreads,
    pendingInsightThreads,
    startConversation,
    updateConversation,
    setViewMode,
    selectedFolderId,
  } = useChatStore();
  const { setChatId, messages } = useMessageStore();

  // Active chat id: prefer URL param
  const chat_id = threadId || useChatStore.getState().chat_id || undefined;

  // Folders
  const { folders, setFolders, expanded, setExpanded, load } = useFolders(user?.id, folderId);

  // UI state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);
  const [conversationToMoveToNewFolder, setConversationToMoveToNewFolder] = useState<string | null>(null);
  const [editTitleFor, setEditTitleFor] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<string | null>(null);

  /** Load folders on mount and when user/folder changes */
  useEffect(() => { load(); }, [load]);

  /** Listen for folder creation events (e.g., from onboarding) */
  useEffect(() => {
    const handleFolderCreated = () => {
      // Reload folders when a new folder is created elsewhere
      load();
    };
    
    window.addEventListener('folders:created', handleFolderCreated);
    return () => window.removeEventListener('folders:created', handleFolderCreated);
  }, [load]);

  /** If loading a shared/public conversation as a guest, make it visible in threads */
  useEffect(() => {
    (async () => {
      if (!chat_id || user?.id) return;
      try {
        const conversation = await getConversation(chat_id);
        if (conversation?.is_public) {
          const { threads } = useChatStore.getState();
          if (!threads.some(t => t.id === chat_id)) {
            useChatStore.setState({ threads: [conversation, ...threads] });
          }
        }
      } catch {/* noop */}
    })();
  }, [chat_id, user?.id]);

  /** Realtime: mark report threads ready when completed */
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const chan = supabase
      .channel('report-completions')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'insights', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new?.is_ready) {
          const map = new Map(useChatStore.getState().pendingInsightThreads);
          map.delete(payload.new.id);
          useChatStore.setState({ pendingInsightThreads: map });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [isAuthenticated, user?.id]);

  /** Derived **/
  const filteredThreads = useMemo(() => {
    return threads.filter(t => {
      if (t.mode === 'profile') return false; // internal
      if (t.folder_id) return false; // shown under folders
      return conversationType === 'swiss' ? t.mode === 'swiss' : t.mode !== 'swiss';
    });
  }, [threads, conversationType]);

  const [visible, setVisible] = useState(12);
  const hasMore = filteredThreads.length > visible;
  const loadMore = useCallback(() => setVisible(v => Math.min(v + 12, filteredThreads.length)), [filteredThreads.length]);
  const sentinelRef = useIntersection(() => { if (hasMore) loadMore(); });

  const isSharedThread = (thread: any) => {
    const p = thread?.conversations_participants?.[0];
    return (p?.role === 'member') || (p?.role === 'owner' && thread?.has_other_participants);
  };

  /** Actions **/
  const switchToChat = async (conversationId: string, folderId?: string) => {
    setShowImageGallery(false); // Close image gallery when switching chats
    const c = threads.find(t => t.id === conversationId);
    if (c?.mode === 'swiss') {
      navigate(`/astro?chat_id=${conversationId}`, { replace: true });
      onCloseMobileSidebar?.();
      return;
    }
    
    // If clicking from a folder, keep folder view mode
    // If clicking from history (no folderId), switch to chat view and collapse folders
    if (folderId) {
      setViewMode('folder', folderId);
    } else {
      setViewMode('chat', null); // Clear folder context
    }
    
    setChatId(conversationId);
    startConversation(conversationId);
    try {
      const { chatController } = await import('@/features/chat/ChatController');
      await chatController.switchToChat(conversationId);
    } catch {/* ignore socket handoff errors to avoid blocking nav */}
    navigate(`/c/${conversationId}`, { replace: true });
    onCloseMobileSidebar?.();
  };

  const saveTitle = async () => {
    if (!editTitleFor || !editTitle.trim()) return;
    const id = editTitleFor;
    setEditTitleFor(null);
    try { updateConversationTitle(id, editTitle.trim()).catch(() => {}); } catch {}
    const existing = useChatStore.getState().threads.find(t => t.id === id);
    if (existing) {
      updateConversation({ ...existing, title: editTitle.trim(), updated_at: new Date().toISOString() } as any);
    }
    setEditTitle('');
  };

  const deleteChat = async (conversationId: string) => {
    setConfirmDeleteFor(null);
    if (isAuthenticated && conversationId) {
      try {
        // Check if insight chat
        const { data: conversation } = await supabase
          .from('conversations')
          .select('meta')
          .eq('id', conversationId as any)
          .maybeSingle();
        const isInsight = conversation && 'meta' in conversation && (conversation.meta as any)?.type === 'insight_chat';

        await supabase.from('conversations').delete().eq('id', conversationId as any);
        if (isInsight) {
          await supabase.from('insights').delete().eq('id', conversationId as any);
          await supabase.from('report_logs').delete().eq('chat_id' as any, conversationId as any);
          await supabase.from('translator_logs').delete().eq('chat_id' as any, conversationId as any);
        }

        const cur = useChatStore.getState();
        useChatStore.setState({ threads: cur.threads.filter(t => t.id !== conversationId) });
        if (cur.chat_id === conversationId) cur.clearChat();
        navigate('/therai', { replace: true });
      } catch (e) {
        console.error('[ChatThreadsSidebar] delete error', e);
      }
    } else {
      try {
        onDelete?.();
        useChatStore.getState().clearChat();
        sessionStorage.clear();
        localStorage.removeItem('chat_id');
        localStorage.removeItem('therai_active_chat_auth_');
        window.location.replace('/c');
      } catch {
        window.location.replace('/c');
      }
    }
  };

  /** Folder actions **/
  const handleCreateOrRenameFolder = async (name: string) => {
    if (!user?.id) return;
    try {
      if (editingFolder) {
        await updateFolderName(editingFolder.id, name);
        setFolders(prev => prev.map(f => (f.id === editingFolder.id ? { ...f, name } : f)));
        setEditingFolder(null);
        return;
      }
      const newFolder = await createFolder(user.id, name);
      if (conversationToMoveToNewFolder) {
        await moveConversationToFolder(conversationToMoveToNewFolder, newFolder.id);
        setConversationToMoveToNewFolder(null);
        await load();
      } else {
        setFolders(prev => [...prev, { id: newFolder.id, name: newFolder.name, chatsCount: 0, chats: [] }]);
      }
    } catch (e) {
      console.error('[ChatThreadsSidebar] create/rename folder failed', e);
    }
  };

  const handleMoveToFolder = async (conversationId: string, folderId: string | null) => {
    if (!user?.id) return;
    try {
      await moveConversationToFolder(conversationId, folderId);
      await load();
    } catch (e) {
      console.error('[ChatThreadsSidebar] move to folder failed', e);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!user?.id) return;
    try { await deleteFolder(id); await load(); } catch (e) { console.error(e); }
  };

  /** Small derived label from first user message (fallback) **/
  const draftTitle = useMemo(() => {
    const first = messages.find(m => m.role === 'user' && m.text);
    if (!first?.text) return 'New Chat';
    const words = first.text.trim().split(/\s+/).slice(0, 6).join(' ');
    return words.length <= 30 ? words : words.slice(0, 27) + '...';
  }, [messages]);

  return (
    <div className={cn('w-full h-full flex flex-col', className)}>
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* New Chat + Search */}
        {conversationType !== 'swiss' && (
          <div className="space-y-0.5 px-2 pt-2 pb-0">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-3 py-1 text-sm font-light"
              onClick={() => { void startChat(); }}
            >
              <SquarePen className="w-4 h-4" />
              New Chat
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 px-3 py-1 text-sm font-light" onClick={() => setShowSearchModal(true)}>
              <Search className="w-4 h-4" /> Search Chat
            </Button>
            <ExploreActions />
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 px-3 py-1 text-sm font-light" 
              onClick={() => setShowImageGallery(true)}
              data-image-gallery-button
            >
              <Image className="w-4 h-4" /> Images
            </Button>
          </div>
        )}

        {/* Folders */}
        <div className="px-2">
          <AddFolderButton
            onClick={() => {
              if (!isAuthenticated) return setShowAuthModal(true);
              setEditingFolder(null);
              setShowFolderModal(true);
            }}
            isExpanded={expanded}
            onToggleExpand={() => setExpanded(!expanded)}
          />
          {expanded && (
            <FoldersList
              folders={folders}
              onFolderClick={(id) => { navigate(`/folders/${id}`, { replace: true }); onCloseMobileSidebar?.(); }}
              onChatClick={(folderId, chatId) => switchToChat(chatId, folderId)}
              onEditFolder={isAuthenticated ? (id, name) => { setEditingFolder({ id, name }); setShowFolderModal(true); } : undefined}
              onDeleteFolder={isAuthenticated ? handleDeleteFolder : undefined}
              onEditChat={isAuthenticated ? (id, current) => { setEditTitleFor(id); setEditTitle(current || ''); } : undefined}
              onDeleteChat={isAuthenticated ? (id) => setConfirmDeleteFor(id) : undefined}
              onMoveToFolder={isAuthenticated ? handleMoveToFolder : undefined}
              onCreateFolder={isAuthenticated ? (id) => { setConversationToMoveToNewFolder(id); setShowFolderModal(true); } : undefined}
              allFolders={folders.map(f => ({ id: f.id, name: f.name }))}
              activeChatId={chat_id}
              activeFolderId={selectedFolderId}
            />
          )}
        </div>

        {/* Threads */}
        <div className="mt-2">
          <div className="text-xs text-gray-600 font-medium px-3 py-1">History</div>
          {isLoadingThreads ? (
            <div className="space-y-1 px-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-2 rounded-lg animate-pulse bg-gray-100" />
              ))}
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-xs text-gray-500 px-3 py-1">No previous chats</div>
          ) : (
            <div className="space-y-0.5 px-2">
              {filteredThreads.slice(0, visible).map((c) => {
                const isActive = c.id === chat_id;
                const isPending = (c.meta as any)?.isPending || pendingInsightThreads.has(c.id);

                return (
                  <div key={c.id} className={cn('group flex items-center gap-2 p-1.5 rounded-lg transition-colors', isActive ? 'bg-gray-100' : 'hover:bg-gray-100', isPending && 'opacity-60') }>
                    {isPending && (
                      <svg className="w-4 h-4 animate-spin text-gray-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
                      </svg>
                    )}
                    <button
                      className="flex-1 min-w-0 text-left"
                      disabled={isPending}
                      onClick={() => switchToChat(c.id)}
                    >
                      <div className="flex items-center gap-2">
                        {c.mode === 'insight' && <Sparkles className="w-4 h-4 text-gray-600" />}
                        {c.mode === 'astro' && <Orbit className="w-4 h-4 text-gray-600" />}
                        {c.mode === 'together' && <Blend className="w-4 h-4 text-gray-600" />}
                        {(c.mode === 'chat' || !c.mode) && <MessageCircle className="w-4 h-4 text-gray-600" />}
                        <div className="text-sm font-medium text-gray-900 truncate" title={c.title || draftTitle}>{c.title || draftTitle}</div>
                        {isSharedThread(c) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Shared</span>
                        )}
                      </div>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-200 rounded">
                          <MoreHorizontal className="w-4 h-4 text-gray-600" />
                        </button>
                      </DropdownMenuTrigger>
                      <ConversationActionsMenuContent
                        conversationId={c.id}
                        currentTitle={c.title || ''}
                        onEdit={(id, current) => { setEditTitleFor(id); setEditTitle(current || ''); }}
                        onDelete={(id) => setConfirmDeleteFor(id)}
                        onMoveToFolder={handleMoveToFolder}
                        onCreateFolder={(id) => { setConversationToMoveToNewFolder(id); setShowFolderModal(true); }}
                        folders={folders.map(f => ({ id: f.id, name: f.name }))}
                        currentFolderId={c.folder_id || null}
                        align="end"
                      />
                    </DropdownMenu>
                  </div>
                );
              })}
              {hasMore && <div ref={sentinelRef} className="h-6" />}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-3">
        {isAuthenticated ? (
          <div className="px-2 pb-2">
            {isMobile ? (
              <Button 
                variant="ghost" 
                className="w-full justify-start p-0 h-auto rounded-none bg-transparent hover:bg-gray-100"
                onClick={() => {
                  onCloseMobileSidebar?.();
                  openSettings('general');
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2 w-full">
                  <UserAvatar size="xs" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium text-gray-900">{displayName}</div>
                  </div>
                </div>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100">
                    <UserAvatar size="xs" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48 rounded-xl border border-gray-200 shadow-lg p-1">
                  <DropdownMenuItem onClick={() => openSettings('general')}>General</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openSettings('account')}>Account Settings</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openSettings('profiles')}>Profiles</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openSettings('memory')}>Memory</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openSettings('billing')}>Billing</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openSettings('notifications')}>Notifications</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openSettings('delete')}>Delete Account</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openSettings('support')}>Contact Support</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLegalTerms}>Legal & Terms</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-red-600 hover:text-red-700 hover:bg-red-50">Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          <div className="px-3 pb-3">
            <Button className="w-full rounded-full" onClick={() => setShowAuthModal(true)}>Sign in</Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} defaultMode="login" />
      <SearchModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} onSelectMessage={(chatId) => switchToChat(chatId)} />
      <ImageGallery isOpen={showImageGallery} onClose={() => setShowImageGallery(false)} />

      <FolderModal
        isOpen={showFolderModal}
        onClose={() => { setShowFolderModal(false); setEditingFolder(null); setConversationToMoveToNewFolder(null); }}
        onCreateFolder={handleCreateOrRenameFolder}
        editingFolder={editingFolder}
      />

      {/* Edit Title */}
      <Dialog open={!!editTitleFor} onOpenChange={(o) => { if (!o) { setEditTitleFor(null); setEditTitle(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit chat title</DialogTitle>
          </DialogHeader>
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Enter chat title..." onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }} />
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => { setEditTitleFor(null); setEditTitle(''); }} className="rounded-full">Cancel</Button>
            <Button onClick={saveTitle} disabled={!editTitle.trim()} className="rounded-full bg-gray-900 hover:bg-gray-800 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDeleteFor} onOpenChange={(o) => { if (!o) setConfirmDeleteFor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This action cannot be undone.</p>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setConfirmDeleteFor(null)} className="rounded-full">Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteFor && deleteChat(confirmDeleteFor)} className="rounded-full">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
