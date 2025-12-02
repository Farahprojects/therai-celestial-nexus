import { useState, useEffect, useRef } from 'react';

export const useScrollHeader = () => {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const heroSection = document.querySelector('[data-hero-section]');
      
      if (heroSection) {
        const heroHeight = (heroSection as HTMLElement).offsetHeight;
        
        // Hide header when scrolling past hero section
        if (currentScrollY > heroHeight * 0.8) {
          setIsHeaderVisible(false);
        } else {
          setIsHeaderVisible(true);
        }
        
        // Track if we've scrolled at all
        setIsScrolled(currentScrollY > 50);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return { isHeaderVisible, isScrolled };
};
