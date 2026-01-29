import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface UiCarouselProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

const UiCarousel: React.FC<UiCarouselProps> = ({ children, className = '', duration = 50 }) => {
  const childrenArray = React.Children.toArray(children);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef<boolean>(false);
  const manualScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    isPausedRef.current = true;
    
    if (manualScrollTimeoutRef.current) {
      clearTimeout(manualScrollTimeoutRef.current);
    }
    
    const scrollAmount = 360;
    const container = scrollContainerRef.current;
    const newScroll = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({
      left: newScroll,
      behavior: 'smooth'
    });
    
    manualScrollTimeoutRef.current = setTimeout(() => {
      isPausedRef.current = false;
    }, 3000);
  }, []);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const autoScroll = (timestamp: number) => {
      if (!isPausedRef.current) {
        const elapsed = timestamp - lastTimeRef.current;
        
        if (elapsed >= 30) {
          lastTimeRef.current = timestamp;
          
          const maxScroll = container.scrollWidth / 2;
          let newScroll = container.scrollLeft + 1;
          
          if (newScroll >= maxScroll) {
            newScroll = 0;
          }
          
          container.scrollLeft = newScroll;
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(autoScroll);
    };

    animationFrameRef.current = requestAnimationFrame(autoScroll);

    const handleMouseEnter = () => { isPausedRef.current = true; };
    const handleMouseLeave = () => { isPausedRef.current = false; };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current);
      }
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className={`w-full relative ${className}`}>
      {/* Gradient Overlays */}
      <div className="absolute inset-y-0 left-0 w-16 md:w-24 bg-gradient-to-r from-white dark:from-[#0f0f0f] to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-16 md:w-24 bg-gradient-to-l from-white dark:from-[#0f0f0f] to-transparent pointer-events-none z-10" />

      {/* Carousel Container */}
      <div ref={scrollContainerRef} className="overflow-x-auto px-4 md:px-8 py-2 scroll-smooth scrollbar-hide">
        <div className="flex gap-4">
          {childrenArray.map((child, index) => (
            <div key={`original-${index}`} className="flex-shrink-0">
              {child}
            </div>
          ))}
          {childrenArray.map((child, index) => (
            <div key={`duplicate-${index}`} className="flex-shrink-0">
              {child}
            </div>
          ))}
        </div>
      </div>
      
      {/* Navigation Buttons - Now properly outside the carousel */}
      <div className="flex gap-3 mt-6 ml-4 relative z-30 pointer-events-auto">
        <button 
          onClick={() => handleScroll('left')}
          className="p-3 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f0f] hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors duration-200 shadow-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex-shrink-0"
          aria-label="Previous"
          data-testid="button-carousel-prev"
          type="button"
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          onClick={() => handleScroll('right')}
          className="p-3 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f0f] hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors duration-200 shadow-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex-shrink-0"
          aria-label="Next"
          data-testid="button-carousel-next"
          type="button"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default UiCarousel;
