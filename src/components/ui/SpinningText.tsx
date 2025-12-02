import React, { useState, useEffect } from 'react';

interface SpinningTextProps {
  words: string[];
  interval?: number;
  className?: string;
}

export const SpinningText: React.FC<SpinningTextProps> = ({ 
  words, 
  interval = 2000,
  className = ""
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
        setIsVisible(true);
      }, 150); // Half of the transition duration
    }, interval);

    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <span className={`inline-block transition-all duration-300 ${className}`}>
      <span 
        className={`inline-block transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {words[currentIndex]}
      </span>
    </span>
  );
};
