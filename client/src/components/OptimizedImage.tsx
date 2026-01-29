import { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  quality?: number;
  priority?: boolean;
  onLoad?: () => void;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  quality = 95,
  priority = false,
  onLoad,
  objectFit = 'contain',
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const convertToOptimizedFormat = (url: string): string => {
    if (!url) return '';
    
    // Se é um path relativo (começa com /), retorna diretamente
    if (url.startsWith('/')) {
      return url;
    }
    
    // Se não começa com http, pode ser uma URL relativa sem protocolo
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url;
    }
    
    try {
      const urlObj = new URL(url);
      
      if (urlObj.hostname.includes('cloudinary.com')) {
        const parts = urlObj.pathname.split('/upload/');
        if (parts.length === 2) {
          const transforms = [
            `f_auto`,
            `q_${quality}`,
            width ? `w_${width}` : '',
            height ? `h_${height}` : '',
            'c_limit',
            'fl_progressive',
            'fl_preserve_transparency'
          ].filter(Boolean).join(',');
          
          return `${urlObj.origin}/upload/${transforms}/${parts[1]}`;
        }
      }
      
      if (urlObj.hostname.includes('imgur.com')) {
        return url.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
      }
      
      return url;
    } catch {
      return url;
    }
  };

  const loadImage = () => {
    const optimizedSrc = convertToOptimizedFormat(src);
    setImageSrc(optimizedSrc);
  };

  useEffect(() => {
    if (priority) {
      loadImage();
      return;
    }

    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage();
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current);
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src, priority]);

  const handleLoad = () => {
    setImageLoaded(true);
    setError(false);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    setImageLoaded(true);
  };

  if (error) {
    return (
      <div 
        ref={imgRef}
        className={`${className} flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50`}
        style={{ width: width || '100%', height: height || '100%' }}
      >
        <div className="text-center p-4">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-gray-400">Imagem indisponível</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={imgRef} className="relative w-full h-full">
      {!imageLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 to-gray-50">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          </div>
        </div>
      )}
      
      {imageSrc && (
        <picture>
          <source srcSet={imageSrc.replace(/\.(jpg|jpeg|png)$/i, '.avif')} type="image/avif" />
          <source srcSet={imageSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp')} type="image/webp" />
          <img
            src={imageSrc}
            alt={alt}
            className={`${className} transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ objectFit }}
            width={width}
            height={height}
            onLoad={handleLoad}
            onError={handleError}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
          />
        </picture>
      )}
    </div>
  );
}
