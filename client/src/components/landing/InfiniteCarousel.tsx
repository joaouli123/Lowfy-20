import { useState, useEffect, useMemo, useRef } from 'react';
import { CAROUSEL_LOGOS } from '@/lib/landing-constants';

const InfiniteCarousel: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkDark();
    
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);

  const displayedLogos = useMemo(() => {
    if (isMobile) {
      return CAROUSEL_LOGOS.slice(0, 8);
    }
    return CAROUSEL_LOGOS;
  }, [isMobile]);

  const logoStyles = useMemo(() => {
    const baseFilter = isDark 
      ? { filter: 'brightness(0) invert(1)' } 
      : { filter: 'brightness(0)' };
    
    return displayedLogos.map(item => 
      item.name === 'Social Peta' ? undefined : baseFilter
    );
  }, [isDark, displayedLogos]);

  const logoHeights = useMemo(() => 
    displayedLogos.map(item => {
      if (item.name === 'Sora') return 'h-32';
      if (['HeyGen', 'Adspower', 'Elementor', 'Gamma', 'Leonardo AI'].includes(item.name)) return 'h-20';
      return 'h-12';
    }), 
  [displayedLogos]);

  return (
    <div 
      ref={containerRef}
      className="w-full bg-gray-50 dark:bg-[#0f0f0f] border-y border-gray-200 dark:border-[#333] overflow-hidden relative py-6 [contain:layout_style_paint]"
      style={{ minHeight: '80px' }}
    >
      {!isVisible ? (
        <div className="h-12" />
      ) : (
        <>
          {/* Gradient overlays */}
          <div className="absolute inset-y-0 left-0 w-20 md:w-32 bg-gradient-to-r from-gray-50 dark:from-[#0f0f0f] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-20 md:w-32 bg-gradient-to-l from-gray-50 dark:from-[#0f0f0f] to-transparent z-10 pointer-events-none" />
          
          {/* GPU-accelerated animated track */}
          <div 
            className="flex animate-carousel-scroll"
            style={{ transform: 'translate3d(0,0,0)' }}
          >
            {[0, 1].map((loopIndex) => (
              <div 
                key={loopIndex} 
                className="flex items-center gap-12 md:gap-16 px-6 flex-shrink-0"
              >
                {displayedLogos.map((item, index) => (
                  <div
                    key={`${loopIndex}-${index}`}
                    className={`flex items-center justify-center flex-shrink-0 ${logoHeights[index]}`}
                    data-testid={`logo-${item.name.toLowerCase().replace(/\s+/g, '-')}-${loopIndex + 1}`}
                  >
                    <img 
                      src={item.logo} 
                      alt={item.name} 
                      className="h-full w-auto max-w-[120px] md:max-w-[140px] object-contain"
                      style={logoStyles[index]}
                      loading="lazy"
                      decoding="async"
                      width="120"
                      height="48"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default InfiniteCarousel;
