import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/core/store';

interface TypewriterTextProps {
  text: string;
  msPerWord?: number;
  onComplete?: () => void;
  onInterrupt?: () => void;
  className?: string;
  showCursor?: boolean;
  cursorChar?: string;
  disabled?: boolean; // Skip animation entirely
  // onAdvance and reserveHeight removed to simplify
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  msPerWord = 64,
  onComplete,
  onInterrupt,
  className = '',
  showCursor = false,
  cursorChar = '|',
  disabled = false
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  
  const currentIndexRef = useRef(0);
  const typeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInterruptedRef = useRef(false);
  const lastTextRef = useRef('');

  // Direct store communication
  const setAssistantTyping = useChatStore(state => state.setAssistantTyping);
  const isAssistantTyping = useChatStore(state => state.isAssistantTyping);

  // Watch for external stop command from store
  useEffect(() => {
    if (!isAssistantTyping && isTyping) {
      // External stop command - immediately show full text
      isInterruptedRef.current = true;
      setIsTyping(false);
      setDisplayedText(text);
      cleanup();
      onComplete?.();
    }
  }, [isAssistantTyping, isTyping, text, onComplete]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (typeTimeoutRef.current) {
      clearTimeout(typeTimeoutRef.current);
      typeTimeoutRef.current = null;
    }
    if (cursorIntervalRef.current) {
      clearInterval(cursorIntervalRef.current);
      cursorIntervalRef.current = null;
    }
  }, []);

  // Cursor blinking effect
  useEffect(() => {
    if (showCursor && (isTyping || displayedText.length > 0)) {
      cursorIntervalRef.current = setInterval(() => {
        setCursorVisible(prev => !prev);
      }, 530);
    } else {
      setCursorVisible(false);
      if (cursorIntervalRef.current) {
        clearInterval(cursorIntervalRef.current);
        cursorIntervalRef.current = null;
      }
    }

    return () => {
      if (cursorIntervalRef.current) {
        clearInterval(cursorIntervalRef.current);
      }
    };
  }, [showCursor, isTyping, displayedText.length]);

  // Main typing logic
  const startTyping = useCallback(() => {
    if (!text || isInterruptedRef.current || disabled) return;

    setIsTyping(true);
    setDisplayedText('');
    currentIndexRef.current = 0;
    setCursorVisible(true);

    // Split text into words, preserving spaces
    const words = text.split(/(\s+)/);

    const typeNextWord = () => {
      if (isInterruptedRef.current) {
        setIsTyping(false);
        setAssistantTyping(false); // Direct store communication - stop typing
        onInterrupt?.();
        return;
      }

      if (currentIndexRef.current < words.length) {
        // Add next word
        const nextWord = words[currentIndexRef.current];
        setDisplayedText(prev => prev + nextWord);
        currentIndexRef.current++;

        // Variable delay for punctuation at end of words
        const delay = /[.!?,:;]$/.test(nextWord) ? msPerWord * 2 : msPerWord;
        typeTimeoutRef.current = setTimeout(typeNextWord, delay);
      } else {
        // Animation complete
        setIsTyping(false);
        setAssistantTyping(false); // Direct store communication - stop typing
        if (showCursor) {
          setCursorVisible(true); // Keep cursor visible after completion
        }
        onComplete?.();
      }
    };

    typeNextWord();
  }, [text, msPerWord, onComplete, onInterrupt, showCursor, disabled, setAssistantTyping]);


  // Reset and start animation when text changes
  useEffect(() => {
    // Skip if disabled or no text
    if (disabled || !text) {
      setDisplayedText(text || '');
      setIsTyping(false);
      return;
    }

    // Skip if text hasn't changed
    if (text === lastTextRef.current) return;
    lastTextRef.current = text;

    // Reset state
    isInterruptedRef.current = false;
    cleanup();
    
    // Start typing after small delay to ensure cleanup
    const startDelay = setTimeout(() => {
      startTyping();
    }, 10);

    return () => {
      clearTimeout(startDelay);
      cleanup();
    };
  }, [text, disabled, startTyping, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isInterruptedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  // Return displayed text with optional cursor
  const displayContent = disabled ? text : displayedText;
  const shouldShowCursor = showCursor && cursorVisible && !disabled;

  return (
    <span className={`inline selectable-text ${className}`}>
      {displayContent}
      {shouldShowCursor && (
        <span className="animate-pulse text-gray-400">
          {cursorChar}
        </span>
      )}
    </span>
  );
};

// Export hook version for complex use cases
export const useTypewriter = (
  text: string,
  options: {
    msPerWord?: number;
    autoStart?: boolean;
    disabled?: boolean;
  } = {}
) => {
  const { msPerWord = 64, autoStart = true, disabled = false } = options;
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const currentIndexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInterruptedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!text || disabled || isInterruptedRef.current) return;

    setIsTyping(true);
    setDisplayedText('');
    currentIndexRef.current = 0;

    // Split text into words, preserving spaces
    const words = text.split(/(\s+)/);

    const typeNext = () => {
      if (isInterruptedRef.current) return;

      if (currentIndexRef.current < words.length) {
        const nextWord = words[currentIndexRef.current];
        setDisplayedText(prev => prev + nextWord);
        currentIndexRef.current++;

        const delay = /[.!?,:;]$/.test(nextWord) ? msPerWord * 2 : msPerWord;
        timeoutRef.current = setTimeout(typeNext, delay);
      } else {
        setIsTyping(false);
      }
    };

    typeNext();
  }, [text, msPerWord, disabled]);

  const stop = useCallback(() => {
    isInterruptedRef.current = true;
    setIsTyping(false);
    cleanup();
  }, [cleanup]);

  const reset = useCallback(() => {
    isInterruptedRef.current = false;
    setDisplayedText('');
    setIsTyping(false);
    currentIndexRef.current = 0;
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (autoStart && text && !disabled) {
      isInterruptedRef.current = false;
      cleanup();
      const startDelay = setTimeout(start, 10);
      return () => clearTimeout(startDelay);
    }
  }, [text, autoStart, disabled, start, cleanup]);

  useEffect(() => {
    return () => {
      isInterruptedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    displayedText: disabled ? text : displayedText,
    isTyping,
    start,
    stop,
    reset
  };
};