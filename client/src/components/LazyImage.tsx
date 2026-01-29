import { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: string;
  height?: string;
  priority?: boolean;
  fallbackText?: string;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  className = '',
  width = '80',
  height = '80',
  priority = false,
  fallbackText,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <div ref={imgRef} className="relative w-full h-full">
      {!isInView && !priority ? (
        <div className="w-full h-full bg-muted animate-pulse rounded" />
      ) : hasError ? (
        <div className="w-full h-full bg-primary/10 rounded-lg flex items-center justify-center">
          <span className="text-xl font-bold text-primary">
            {fallbackText || '?'}
          </span>
        </div>
      ) : (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 w-full h-full bg-muted animate-pulse rounded" />
          )}
          <img
            src={src}
            alt={alt}
            className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
          />
        </>
      )}
    </div>
  );
}
