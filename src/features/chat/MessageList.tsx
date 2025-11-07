import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { Message } from '@/core/types';
import { useConversationUIStore } from '@/features/chat/conversation-ui-store';
import { RefreshCw, AlertTriangle, Sparkles, Share2, Download } from 'lucide-react';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useWordAnimation } from '@/hooks/useWordAnimation';
import { Button } from '@/components/ui/button';
import { ShareImageModal } from '@/components/chat/ShareImageModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// TypewriterText removed - keeping source field logic for future use
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ⚡ MEMOIZED USER MESSAGE - Only re-renders when message data changes
const UserMessage = React.memo(({ message, isOwn }: { message: Message; isOwn: boolean }) => (
  <div className={`flex items-end gap-3 ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
    <div className={`px-4 py-3 rounded-2xl max-w-[75%] text-black ${
      message.pending ? (isOwn ? 'bg-gray-200 opacity-75' : 'bg-blue-100 opacity-75') : (isOwn ? 'bg-gray-200' : 'bg-blue-100')
    }`}>
      {(!isOwn && message.user_name) && (
        <div className="text-xs font-medium text-blue-700 mb-1">{message.user_name}</div>
      )}
      <p className="text-base font-light leading-relaxed text-left whitespace-pre-wrap selectable-text">
        {message.text || ''}
      </p>
      {message.pending && (
        <div className="text-xs text-gray-500 mt-1 italic">Sending...</div>
      )}
    </div>
  </div>
));
UserMessage.displayName = 'UserMessage';

// ⚡ MEMOIZED ASSISTANT MESSAGE - Only re-renders when message data changes
const AssistantMessage = React.memo(({ message }: { message: Message }) => {
  const { text, pending, source, meta } = message;
  // Only animate fresh WebSocket messages, not loaded/refreshed messages
  const shouldAnimate = source === 'websocket';
  const { animatedText, isAnimating } = useWordAnimation(text || '', shouldAnimate);
  const displayText = isAnimating ? animatedText : text || '';
  const isTogetherModeAnalysis = meta?.together_mode_analysis === true;

  // 🆕 ADD IMAGE DETECTION
  const isImageMessage = meta?.message_type === 'image';
  const imageUrl = meta?.image_url;
  const imagePrompt = meta?.image_prompt;
  const [showShareModal, setShowShareModal] = useState(false);

  // 🆕 RENDER IMAGE IF PRESENT
  if (isImageMessage && imageUrl) {
    const handleShare = () => {
      setShowShareModal(true);
    };

    const handleDownload = async () => {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const imagePath = meta?.image_path || '';
        const filename = imagePath.split('/').pop() || 'image.png';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Image downloaded');
      } catch (error) {
        console.error('Failed to download image:', error);
        toast.error('Failed to download image');
      }
    };

    return (
      <div className="flex justify-center mb-8">
        <div className="relative group inline-block max-w-[80vw] rounded-2xl overflow-hidden shadow-md">
          <img
            src={imageUrl}
            alt={imagePrompt || 'Generated image'}
            className="block max-w-full max-h-[80vh] object-contain cursor-pointer"
            onClick={() => {
              const sidebarButton = document.querySelector('[data-image-gallery-button]') as HTMLButtonElement;
              if (sidebarButton) sidebarButton.click();
            }}
            loading="lazy"
          />
          {/* Bottom bar with icons - gradient from dark to transparent, matches image dimensions */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/0 group-hover:from-black/70 group-hover:to-transparent transition-all duration-200 flex items-end justify-center gap-3 pb-3 pointer-events-none">
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 text-white hover:text-white hover:bg-white/20 rounded-full transition-opacity pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 text-white hover:text-white hover:bg-white/20 rounded-full transition-opacity pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Share Modal */}
        <ShareImageModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          imageUrl={imageUrl}
          imagePrompt={imagePrompt}
        />
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 justify-start mb-8">
      <div className="px-4 py-3 rounded-2xl max-w-2xl lg:max-w-4xl text-black">
        {/* Together Mode Badge */}
        {isTogetherModeAnalysis && (
          <div className="inline-flex items-center gap-1.5 text-xs text-purple-600 mb-2 font-light">
            <Sparkles size={14} />
            <span>Insight</span>
          </div>
        )}
        <div className="text-base font-light leading-relaxed text-left selectable-text prose prose-sm max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              // Customize rendering to match your design system
              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
              strong: ({node, ...props}) => <strong className="font-medium" {...props} />,
              em: ({node, ...props}) => <em className="italic" {...props} />,
              code: ({node, ...props}) => {
                const isInline = !props.className?.includes('language-');
                return isInline ? 
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props} /> :
                  <code className="block bg-gray-100 p-2 rounded text-sm overflow-x-auto" {...props} />;
              },
              ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2" {...props} />,
            }}
          >
            {displayText}
          </ReactMarkdown>
        </div>
        {pending && (
          <div className="text-xs text-gray-500 mt-1 italic">Thinking...</div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render if text, id, source, or image meta changed
  return prevProps.message.id === nextProps.message.id && 
         prevProps.message.text === nextProps.message.text &&
         prevProps.message.pending === nextProps.message.pending &&
         prevProps.message.source === nextProps.message.source &&
         prevProps.message.meta?.together_mode_analysis === nextProps.message.meta?.together_mode_analysis &&
         prevProps.message.meta?.message_type === nextProps.message.meta?.message_type &&
         prevProps.message.meta?.image_url === nextProps.message.meta?.image_url &&
         prevProps.message.meta?.status === nextProps.message.meta?.status;
});
AssistantMessage.displayName = 'AssistantMessage';

// Image skeleton component
const ImageSkeleton = ({ prompt }: { prompt: string }) => (
  <div className="flex items-end gap-3 justify-start mb-8">
    <div className="relative rounded-xl w-96 overflow-hidden">
      <div className="w-full aspect-square bg-gray-100 animate-pulse">
        <div className="w-full h-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-gray-400 text-sm px-4 text-center">{prompt}</p>
      </div>
    </div>
  </div>
);

// Simple message rendering - no complex turn grouping needed with message_number ordering
const renderMessages = (messages: Message[], currentUserId?: string) => {
  const elements: React.ReactNode[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Skip context-injected system messages
    if (message.role === 'system' && message.context_injected) {
      continue;
    }
    
    // Render user messages (own vs other user)
    if (message.role === 'user') {
      // Skip user message only if the next message is a COMPLETED image (hide the prompt)
      // Don't hide if it's still generating (placeholder) - user needs to see their message
      const nextMessage = messages[i + 1];
      const nextIsCompletedImage = nextMessage?.role === 'assistant' && 
                                    nextMessage?.meta?.message_type === 'image' &&
                                    nextMessage?.meta?.image_url; // Only hide if image is ready
      
      if (nextIsCompletedImage) {
        continue; // Skip rendering the user's image generation prompt
      }
      
      // Treat missing user_id as own message to avoid mis-coloring older rows
      const isOwn = message.user_id ? (currentUserId === message.user_id) : true;
      // Use client_msg_id as key if available to prevent glitch when optimistic message is replaced
      const messageKey = message.client_msg_id || message.id;
      elements.push(
        <UserMessage key={messageKey} message={message} isOwn={isOwn} />
      );
    }
    
    // Render assistant messages
    if (message.role === 'assistant') {
      // Debug log for ALL assistant messages
      console.log('[renderMessages] 🔍 Assistant message:', {
        id: message.id,
        role: message.role,
        text: message.text?.substring(0, 30),
        status: message.meta?.status,
        message_type: message.meta?.message_type,
        has_image_url: !!message.meta?.image_url,
        meta: message.meta
      });
      
      // Check if this is a generating image placeholder (skeleton)
      // Show skeleton if status is 'generating' OR if it's an image message without image_url yet
      const isGenerating = message.meta?.status === 'generating' && message.meta?.message_type === 'image';
      const isImageWithoutUrl = message.meta?.message_type === 'image' && !message.meta?.image_url;
      
      if (isGenerating || isImageWithoutUrl) {
        console.log('[renderMessages] ✅ Rendering skeleton for generating image:', {
          id: message.id,
          status: message.meta?.status,
          message_type: message.meta?.message_type,
          has_image_url: !!message.meta?.image_url,
          prompt: message.meta?.image_prompt
        });
        // Use client_msg_id as key if available to prevent glitch when optimistic message is replaced
        const messageKey = message.client_msg_id || message.id;
        elements.push(
          <ImageSkeleton 
            key={messageKey} 
            prompt={message.meta?.image_prompt || 'Generating image...'} 
          />
        );
        continue; // Skip normal rendering
      }
      // Use client_msg_id as key if available to prevent glitch when optimistic message is replaced
      const messageKey = message.client_msg_id || message.id;
      elements.push(
        <AssistantMessage key={messageKey} message={message} />
      );
    }
    
    // Render system messages as assistant messages
    if (message.role === 'system') {
      // Use client_msg_id as key if available to prevent glitch when optimistic message is replaced
      const messageKey = message.client_msg_id || message.id;
      elements.push(
        <AssistantMessage key={messageKey} message={message} />
      );
    }
  }
  
  // Unified store handles all messages - no need for direct assistant message logic
  
  return elements;
};

export const MessageList = () => {
  const chat_id = useChatStore((state) => state.chat_id);
  
  // ⚡ OPTIMIZED: Use selective subscriptions to prevent unnecessary re-renders
  // Each selector only triggers re-render when its specific value changes
  const messages = useMessageStore((state) => state.messages);
  const windowError = useMessageStore((state) => state.error);
  const loadOlder = useMessageStore((state) => state.loadOlder);
  
  // Unified store handles all messages via real-time subscriptions
  
  // Auth detection
  const { user } = useAuth();
  
  const { containerRef, bottomRef, onContentChange } = useAutoScroll();
  const [initialMessageCount, setInitialMessageCount] = useState<number | null>(null);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const navigate = useNavigate();
  
  // Removed generatingImages state - using database message.meta.status === 'generating' instead
  
  // Set chat ID when it changes
  // Removed redundant setChatId call - chat switching already handles this
  // useEffect(() => {
  //   if (chat_id) {
  //     setChatId(chat_id);
  //   }
  // }, [chat_id, setChatId]);

  // Track initial message count to determine which messages are from history
  React.useEffect(() => {
    if (initialMessageCount === null && messages.length > 0) {
      setInitialMessageCount(messages.length);
    }
  }, [messages.length, initialMessageCount]);

  // ⚡ OPTIMIZED: Check if user has sent a message - early exit to avoid redundant work
  React.useEffect(() => {
    if (hasUserSentMessage) return; // Already found a user message, skip
    const hasUser = messages.some(m => m.role === 'user');
    if (hasUser) {
      setHasUserSentMessage(true);
    }
  }, [messages, hasUserSentMessage]);

  // Removed all broadcast event listeners - using database INSERT/UPDATE instead

  // Auto-scroll when content grows
  React.useEffect(() => {
    onContentChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Auto-scroll handled by messages.length changes

  // ⚡ OPTIMIZED: Memoize rendered messages - prevents recreating JSX for unchanged messages
  const renderedMessages = useMemo(() => 
    renderMessages(messages, user?.id),
    [messages, user?.id]
  );

  // Render messages directly in message_number order - no complex turn grouping needed

  return (
    <>
    <div 
      className="chat-scroll-container h-full flex flex-col overflow-y-auto"
      style={{ 
        scrollBehavior: 'smooth',
        overflowAnchor: 'none'
      }}
      ref={containerRef}
      id="chat-scroll-container"
    >
      {/* Error state for message loading (window-based) */}
      {windowError && messages.length === 0 && (
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <AlertTriangle className="h-8 w-8 text-orange-500 mb-2" />
          <p className="text-gray-600 text-center mb-4">
            Failed to load conversation
          </p>
          <p className="text-gray-500 text-sm text-center mb-4">
            {windowError}
          </p>
          <Button 
            onClick={loadOlder}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}

      {/* Empty state or content */}
      {!windowError && (
        <>
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col justify-end">
            </div>
          ) : (
            <div className="flex flex-col p-4 max-w-3xl mx-auto w-full">
              {/* 🚀 LAZY LOAD: No loading indicators - messages load silently */}

              {renderedMessages}
              
              {/* Bottom padding to prevent content from being hidden behind fixed elements */}
              <div style={{ height: '80px' }} />
              
              {/* Sentinel element for auto-scroll */}
              <div ref={bottomRef} />
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
};
