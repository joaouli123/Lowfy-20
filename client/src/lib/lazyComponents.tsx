import { lazy, Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

const DefaultFallback = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback: React.ReactNode = <DefaultFallback />
) {
  const LazyComponent = lazy(importFn);
  
  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export const LazyDialog = lazy(() => import('@/components/ui/dialog').then(mod => ({ default: mod.Dialog })));
export const LazyInputOTP = lazy(() => import('@/components/ui/input-otp').then(mod => ({ default: mod.InputOTP })));
