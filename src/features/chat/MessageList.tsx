import React, { useState, useMemo } from 'react';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { Message } from '@/core/types';
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
  const metaData = meta as any;
  const isTogetherModeAnalysis = metaData?.together_mode_analysis === true;

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
  const prevMeta = prevProps.message.meta as any;
  const nextMeta = nextProps.message.meta as any;
  return prevProps.message.id === nextProps.message.id && 
         prevProps.message.text === nextProps.message.text &&
         prevProps.message.pending === nextProps.message.pending &&
         prevProps.message.source === nextProps.message.source &&
         prevMeta?.together_mode_analysis === nextMeta?.together_mode_analysis &&
         prevMeta?.message_type === nextMeta?.message_type &&
         prevMeta?.image_url === nextMeta?.image_url &&
         prevMeta?.status === nextMeta?.status;
});
AssistantMessage.displayName = 'AssistantMessage';

// Image component with loading state - uses same structure for smooth transition
const ImageWithLoading = React.memo(({ message }: { message: Message }) => {
  const metaData = message.meta as any;
  const imageUrl = metaData?.image_url;
  const imagePrompt = metaData?.image_prompt;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [blurPhase, setBlurPhase] = useState<0 | 1 | 2>(0); // 0 heavy blur, 1 medium after 3s, 2 none when loaded

  // Reset imageLoaded when imageUrl changes
  React.useEffect(() => {
    if (imageUrl) {
      setImageLoaded(false);
    }
  }, [imageUrl]);

  // Progressive blur while waiting (gives sense of progress)
  React.useEffect(() => {
    if (imageUrl && imageLoaded) {
      setBlurPhase(2);
      return;
    }
    // Start with heavy blur, reduce after 3s
    setBlurPhase(0);
    const t = setTimeout(() => setBlurPhase(1), 3000);
    return () => clearTimeout(t);
  }, [imageUrl, imageLoaded]);

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const imagePath = metaData?.image_path || '';
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
        {/* Placeholder canvas - universal blurred white overlay with subtle animated background */}
        <div className={`w-[512px] h-[512px] flex items-center justify-center transition-opacity duration-500 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}>
          {/* animated neutral background to imply activity */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300 animate-pulse" />
          {/* heavy white blur overlay that eases over time */}
          <div className={`absolute inset-0 ${blurPhase === 0 ? 'backdrop-blur-[16px]' : blurPhase === 1 ? 'backdrop-blur-[8px]' : 'backdrop-blur-0'} bg-white/70 transition-all duration-700`} />
          {/* small centered spinner */}
          <div className="relative z-10">
            <div className="w-6 h-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        
        {/* Actual image - fades in when loaded */}
        {imageUrl && (
          <>
            <img
              src={imageUrl}
              alt={imagePrompt || 'Generated image'}
              className={`absolute inset-0 w-full h-full object-contain cursor-pointer transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => {
                const sidebarButton = document.querySelector('[data-image-gallery-button]') as HTMLButtonElement;
                if (sidebarButton) sidebarButton.click();
              }}
              onLoad={() => setImageLoaded(true)}
              loading="lazy"
            />
            
            {/* Bottom bar with icons - only show when image is loaded */}
            {imageLoaded && (
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
            )}

            {/* Share Modal */}
            <ShareImageModal
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
              imageUrl={imageUrl}
              imagePrompt={imagePrompt}
            />
          </>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render only if image URL or status changes
  const prevMeta = prevProps.message.meta as any;
  const nextMeta = nextProps.message.meta as any;
  return prevMeta?.image_url === nextMeta?.image_url &&
         prevMeta?.status === nextMeta?.status;
});
ImageWithLoading.displayName = 'ImageWithLoading';


// Simple message rendering - no complex turn grouping needed with message_number ordering
const renderMessages = (messages: Message[], currentUserId?: string, chatId?: string) => {
  const elements: React.ReactNode[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Skip context-injected system messages
    if (message.role === 'system' && message.context_injected) {
      continue;
    }
    
    // Sync meme messages render as regular images (no special card component)
    // They're handled by the image message rendering below
    
    // Render user messages (own vs other user)
    if (message.role === 'user') {
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
      const metaData = message.meta as any;
      // Debug log for ALL assistant messages
      console.log('[renderMessages] 🔍 Assistant message:', {
        id: message.id,
        role: message.role,
        text: message.text?.substring(0, 30),
        status: metaData?.status,
        message_type: metaData?.message_type,
        has_image_url: !!metaData?.image_url,
        meta: message.meta
      });
      
      // Check if this is an image message (generating or complete)
      const isImageMessage = metaData?.message_type === 'image';
      
      if (isImageMessage) {
        console.log('[renderMessages] 🖼️  Rendering image message:', {
          id: message.id,
          status: metaData?.status,
          has_image_url: !!metaData?.image_url,
          prompt: metaData?.image_prompt
        });
        // Use client_msg_id as key if available to prevent glitch when optimistic message is replaced
        const messageKey = message.client_msg_id || message.id;
        elements.push(
          <ImageWithLoading 
            key={messageKey} 
            message={message}
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
    renderMessages(messages, user?.id, chat_id),
    [messages, user?.id, chat_id]
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
