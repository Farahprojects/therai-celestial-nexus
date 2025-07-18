
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MessagesSidebar } from '@/components/messages/MessagesSidebar';
import { GmailMessageList } from '@/components/messages/GmailMessageList';
import { GmailMessageDetail } from '@/components/messages/GmailMessageDetail';
import { ComposeModal } from '@/components/messages/ComposeModal';
import { MobileComposeButton } from '@/components/messages/MobileComposeButton';
import { EmailBrandingPanel } from '@/components/messages/EmailBrandingPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSearchParams } from "react-router-dom";
import { useDebounceSearch } from '@/hooks/useDebounceSearch';
import {
  toggleStarMessage,
  archiveMessages,
  deleteMessages,
  markMessageRead,
} from "@/utils/messageActions";
import { EmailMessage } from "@/types/email";
import UnifiedNavigation from '@/components/UnifiedNavigation';

const HEADER_HEIGHT = 72;

// Define type for message filters ("inbox", "sent", ...)
export type MessageFilterType = "inbox" | "sent" | "starred" | "archive" | "trash";

const MessagesPage = () => {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [hiddenMessages, setHiddenMessages] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [showEmailBranding, setShowEmailBranding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MessageFilterType>('inbox');
  const [isLoadingInProgress, setIsLoadingInProgress] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Initialize search with URL search params
  const initialSearch = searchParams.get('search') || '';
  const { searchValue, debouncedValue: debouncedSearchValue, setSearchValue } = useDebounceSearch(initialSearch);

  // Update URL when search value changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (searchValue) {
      newSearchParams.set('search', searchValue);
    } else {
      newSearchParams.delete('search');
    }
    setSearchParams(newSearchParams, { replace: true });
  }, [searchValue, searchParams, setSearchParams]);

  // Load messages based on the active filter with search support
  const loadMessages = useCallback(async (filter: MessageFilterType = activeFilter, searchQuery = '', forceRefresh = false) => {
    if (!user?.id) {
      console.log('No user ID available');
      setLoading(false);
      return;
    }

    // Prevent concurrent loads unless forced
    if (isLoadingInProgress && !forceRefresh) {
      console.log('Load already in progress, skipping...');
      return;
    }

    try {
      setIsLoadingInProgress(true);
      
      // Show content loading for filter changes, full loading for initial load
      if (messages.length > 0) {
        setContentLoading(true);
      } else {
        setLoading(true);
      }
      
      console.log('Loading messages for filter:', filter, 'search:', searchQuery, 'user:', user.id);
      
      let query = supabase
        .from('email_messages')
        .select('*')
        .eq('user_id', user.id);

      // Apply filter-specific conditions with proper handling
      switch (filter) {
        case 'inbox':
          query = query.eq('direction', 'inbound').eq('is_archived', false);
          break;
        case 'sent':
          query = query.eq('direction', 'outbound');
          break;
        case 'starred':
          query = query.eq('is_starred', true).eq('is_archived', false);
          break;
        case 'archive':
          query = query.eq('is_archived', true);
          break;
        case 'trash':
          // For trash, show hidden messages or use a proper deleted flag
          // For now, return empty array to avoid UUID errors
          console.log('Trash filter - returning empty results for now');
          setMessages([]);
          return;
        default:
          query = query.eq('direction', 'inbound').eq('is_archived', false);
      }

      // Add search conditions if search query exists
      if (searchQuery.trim()) {
        const searchTerm = `%${searchQuery.trim()}%`;
        query = query.or(`subject.ilike.${searchTerm},body.ilike.${searchTerm},from_address.ilike.${searchTerm},to_address.ilike.${searchTerm}`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // Direction mapping for consistency
      const messagesData: EmailMessage[] = (data || []).map((message: any) => {
        const mappedDirection = message.direction === 'inbound' ? 'incoming' : 
                               message.direction === 'outbound' ? 'outgoing' : 
                               message.direction;
        return {
          ...message,
          direction: mappedDirection,
        } as EmailMessage;
      });
      
      console.log(`Loaded ${messagesData.length} messages for filter: ${filter}, search: "${searchQuery}"`);
      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages. Please try again.",
        variant: "destructive",
      });
      // Reset to empty state on error
      setMessages([]);
    } finally {
      setLoading(false);
      setContentLoading(false);
      setIsLoadingInProgress(false);
    }
  }, [user?.id, activeFilter, messages.length, isLoadingInProgress, toast]);

  // Handle filter changes with proper state management
  const handleFilterChange = useCallback(async (newFilter: MessageFilterType) => {
    console.log('Filter change requested:', newFilter);
    
    // Prevent rapid filter changes
    if (isLoadingInProgress) {
      console.log('Load in progress, ignoring filter change');
      return;
    }

    // Update active filter immediately for UI responsiveness
    setActiveFilter(newFilter);
    
    // Clear selected message when changing filters
    setSelectedMessage(null);
    setSelectedMessages(new Set());
    setShowEmailBranding(false);
    
    // Clear search when changing filters
    setSearchValue('');
    
    // Load messages for the new filter
    await loadMessages(newFilter, '', true);
  }, [isLoadingInProgress, loadMessages, setSearchValue]);

  // Load messages when user changes or on initial load
  useEffect(() => {
    if (user?.id) {
      loadMessages(activeFilter, debouncedSearchValue);
    }
  }, [user?.id, debouncedSearchValue]); // Depend on debounced search value

  // Reload messages when filter changes (but not search, as that's handled above)
  useEffect(() => {
    if (user?.id && !debouncedSearchValue) {
      loadMessages(activeFilter, '', false);
    }
  }, [activeFilter]);

  // Filter out hidden messages for display (no client-side search filtering needed anymore)
  const visibleMessages = messages.filter(message => !hiddenMessages.has(message.id));

  const handleSelectMessage = async (message: EmailMessage) => {
    setSelectedMessage(message);
    setShowEmailBranding(false);

    // Mark as read in database (if not already)
    if (!message.is_read) {
      setMessages(prev =>
        prev.map(m => 
          m.id === message.id ? { ...m, is_read: true } : m
        )
      );
      await markMessageRead(message.id);
    }
  };

  const handleBackToList = () => {
    setSelectedMessage(null);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMessages(new Set(visibleMessages.map(m => m.id)));
    } else {
      setSelectedMessages(new Set());
    }
  };

  const handleSelectMessageCheckbox = (messageId: string, checked: boolean) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(messageId);
      } else {
        newSet.delete(messageId);
      }
      return newSet;
    });
  };

  const handleOpenBranding = () => {
    setShowEmailBranding(true);
    setSelectedMessage(null);
  };

  const handleCloseBranding = () => {
    setShowEmailBranding(false);
  };

  const handleReply = () => {
    toast({
      title: "Reply feature",
      description: "Reply functionality will be available soon.",
    });
  };

  const handleForward = () => {
    toast({
      title: "Forward feature",
      description: "Forward functionality will be available soon.",
    });
  };

  // Soft delete - just hide the message locally
  const handleSoftDelete = (messageId: string) => {
    setHiddenMessages(prev => new Set([...prev, messageId]));
    toast({
      title: "Message hidden",
      description: "Message has been hidden from view.",
    });
  };

  const handleArchive = async () => {
    // Archive currently selected message (single)
    if (selectedMessage) {
      await archiveMessages([selectedMessage.id], toast);
      // Remove from current view if not on archive page
      if (activeFilter !== 'archive') {
        setMessages(prev =>
          prev.filter(m => m.id !== selectedMessage.id)
        );
      }
      setSelectedMessage(null);
    }
  };

  const handleDelete = async () => {
    // Soft delete currently selected message (single)
    if (selectedMessage) {
      handleSoftDelete(selectedMessage.id);
      setSelectedMessage(null);
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedMessages.size === 0) return;
    const ids = Array.from(selectedMessages);
    await archiveMessages(ids, toast);
    // Remove from current view if not on archive page
    if (activeFilter !== 'archive') {
      setMessages(prev =>
        prev.filter(m => !ids.includes(m.id))
      );
    }
    setSelectedMessages(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedMessages.size === 0) return;
    const ids = Array.from(selectedMessages);
    // Soft delete selected messages
    setHiddenMessages(prev => new Set([...prev, ...ids]));
    setSelectedMessages(new Set());
    toast({
      title: "Messages hidden",
      description: `${ids.length} message(s) have been hidden from view.`,
    });
  };

  const handleToggleStar = async (message: EmailMessage) => {
    // Optimistic UI
    setMessages(prev =>
      prev.map(m =>
        m.id === message.id ? { ...m, is_starred: !m.is_starred } : m
      )
    );
    try {
      await toggleStarMessage(message, toast);
    } catch {
      // rollback on error
      setMessages(prev =>
        prev.map(m =>
          m.id === message.id ? { ...m, is_starred: message.is_starred } : m
        )
      );
    }
  };

  const unreadCount = messages.filter(m => !m.is_read && m.direction === 'incoming').length;

  console.log('Current filter:', activeFilter);
  console.log('Search query:', debouncedSearchValue);
  console.log('Visible messages count:', visibleMessages.length);
  console.log('Total messages count:', messages.length);
  console.log('Hidden messages count:', hiddenMessages.size);
  console.log('Loading in progress:', isLoadingInProgress);
  console.log('Show email branding:', showEmailBranding);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-lg">Loading messages...</div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    // Mobile layout: Remove in-page search bar section
    return (
      <>
        <UnifiedNavigation
          // Pass message nav props to header menu for mobile messages page only
          isMessagesPageMobile={true}
          activeFilter={activeFilter}
          unreadCount={unreadCount}
          onFilterChange={handleFilterChange}
        />
        <div className="w-full relative min-h-screen pb-24 bg-background">
          {/* Mobile Compose button */}
          <MobileComposeButton onClick={() => setShowCompose(true)} />
          <div className="w-full">
            {contentLoading ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                  <div className="text-sm text-gray-500">Loading...</div>
                </div>
              </div>
            ) : selectedMessage ? (
              <GmailMessageDetail
                message={selectedMessage}
                onClose={handleBackToList}
                onReply={handleReply}
                onForward={handleForward}
                onArchive={handleArchive}
                onDelete={handleDelete}
              />
            ) : (
              <GmailMessageList
                messages={visibleMessages}
                selectedMessages={selectedMessages}
                selectedMessage={null}
                onSelectMessage={handleSelectMessage}
                onSelectMessageCheckbox={handleSelectMessageCheckbox}
                onSelectAll={handleSelectAll}
                onArchiveSelected={handleArchiveSelected}
                onDeleteSelected={handleDeleteSelected}
                onToggleStar={handleToggleStar}
                mobileDense
              />
            )}
          </div>
          {/* Compose Modal */}
          <ComposeModal
            isOpen={showCompose}
            onClose={() => setShowCompose(false)}
            onSend={(messageData) => {
              toast({
                title: "Message sent",
                description: "Your message has been sent successfully.",
              });
              setShowCompose(false);
              loadMessages(activeFilter, debouncedSearchValue, true);
            }}
          />
        </div>
      </>
    );
  }

  // Desktop layout (sidebar, sticky header, etc)
  return (
    <div className="w-full">
      {/* Fixed Header with Compose button and title */}
      <div className="fixed left-0 top-16 z-20 bg-white border-b w-full" style={{ height: HEADER_HEIGHT }}>
        <div className="flex items-center h-full px-0 py-3">
          {/* Compose button */}
          <div className="pl-6" style={{ width: 256 }}>
            <Button
              onClick={() => setShowCompose(true)}
              className="h-10 px-7 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Compose
            </Button>
          </div>
          
          {/* Title */}
          <div className="flex items-center gap-4 pr-10">
            <h1 className="text-2xl font-normal text-gray-900 min-w-fit mr-4">
              {showEmailBranding ? 'Email Branding' : 'Messages'}
            </h1>
          </div>
        </div>
      </div>
      
      {/* Fixed Search bar - positioned to the right of the title */}
      {!showEmailBranding && (
        <div className="fixed left-96 top-20 z-30 pr-10" style={{ right: '2.5rem' }}>
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search mail"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-12 bg-gray-50 border-gray-200 rounded-full h-10 text-sm focus:bg-white focus:shadow-sm transition-all placeholder:text-gray-500 w-full"
            />
          </div>
        </div>
      )}
      
      {/* Spacer to account for fixed header */}
      <div style={{ height: HEADER_HEIGHT }}></div>
      <div className="flex">
        <MessagesSidebar
          activeFilter={activeFilter}
          unreadCount={unreadCount}
          onFilterChange={handleFilterChange}
          onOpenBranding={handleOpenBranding}
          headerHeight={HEADER_HEIGHT}
          showEmailBranding={showEmailBranding}
        />
        <div className="ml-64 w-full">
          {showEmailBranding ? (
            <EmailBrandingPanel onBack={handleCloseBranding} />
          ) : contentLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="text-sm text-gray-500">Loading...</div>
              </div>
            </div>
          ) : selectedMessage ? (
            <GmailMessageDetail
              message={selectedMessage}
              onClose={handleBackToList}
              onReply={handleReply}
              onForward={handleForward}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ) : (
            <GmailMessageList
              messages={visibleMessages}
              selectedMessages={selectedMessages}
              selectedMessage={null}
              onSelectMessage={handleSelectMessage}
              onSelectMessageCheckbox={handleSelectMessageCheckbox}
              onSelectAll={handleSelectAll}
              onArchiveSelected={handleArchiveSelected}
              onDeleteSelected={handleDeleteSelected}
              onToggleStar={handleToggleStar}
            />
          )}
        </div>
      </div>
      {/* Compose Modal */}
      <ComposeModal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        onSend={(messageData) => {
          toast({
            title: "Message sent",
            description: "Your message has been sent successfully.",
          });
          setShowCompose(false);
          loadMessages(activeFilter, debouncedSearchValue, true);
        }}
      />
    </div>
  );
};

export default MessagesPage;
