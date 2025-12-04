
import { useState, useEffect } from 'react';
import { useAstrologyFacts } from '@/components/birth-details/hooks/useAstrologyFacts';

interface TheraLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TheraLoader = ({ 
  message = "Preparing your experience...", 
  size = 'lg' 
}: TheraLoaderProps) => {
  const astroFact = useAstrologyFacts();
  const [displayText, setDisplayText] = useState('');
  const fullText = "Therai";
  
  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayText(fullText.substring(0, currentIndex));
        currentIndex++;
      } else {
        // Clear the interval once typing is complete
        clearInterval(typingInterval);
      }
    }, 250); // Slowed down to 250ms per character (from 150ms)
    
    return () => clearInterval(typingInterval);
  }, []);
  
  // Different styling based on size prop
  const getContainerClasses = () => {
    switch (size) {
      case 'sm':
        return 'p-2 text-center';
      case 'md':
        return 'p-4 text-center';
      case 'lg':
      default:
        return 'min-h-screen bg-white flex items-center justify-center';
    }
  };
  
  const getLogoSize = () => {
    switch (size) {
      case 'sm':
        return 'text-xl';
      case 'md':
        return 'text-2xl sm:text-3xl';
      case 'lg':
      default:
        return 'text-4xl sm:text-5xl';
    }
  };
  
  const getMessageSize = () => {
    switch (size) {
      case 'sm':
        return 'text-sm font-medium';
      case 'md':
        return 'text-lg font-bold';
      case 'lg':
      default:
        return 'text-2xl font-bold';
    }
  };
  
  return (
    <div className={getContainerClasses()}>
      <div className={size === 'lg' ? "max-w-md w-full p-8 text-center" : ""}>
        <div className={size === 'lg' ? "mb-8" : "mb-2"}>
          <div className="flex justify-center items-center">
            <div className="relative">
              <div className="flex items-center justify-center">
                <h1 className={`font-serif tracking-wide ${getLogoSize()}`}>
                  <span className="text-black font-bold">{displayText}</span>
                </h1>
              </div>
            </div>
          </div>
        </div>
        {message && (
          <>
            <h2 className={`${getMessageSize()} mb-2 text-gray-800`}>{message}</h2>
            {size === 'lg' && <p className="text-gray-600 italic mb-4">"{astroFact}"</p>}
          </>
        )}
      </div>
    </div>
  );
};
