
import { useEffect } from 'react';
import { useLocation } from 'wouter';

const Timeline = () => import('@/pages/Timeline');
const Dashboard = () => import('@/pages/Dashboard');
const PLRs = () => import('@/pages/PLRs');
const AITools = () => import('@/pages/AITools');
const Courses = () => import('@/pages/Courses');
const Marketplace = () => import('@/pages/Marketplace');
const Forum = () => import('@/pages/Forum');
const Profile = () => import('@/pages/Profile');

const PRELOAD_PRIORITY = [
  { path: '/', loader: Timeline, priority: 1 },
  { path: '/dashboard', loader: Dashboard, priority: 1 },
  { path: '/plrs', loader: PLRs, priority: 2 },
  { path: '/ai-tools', loader: AITools, priority: 2 },
  { path: '/courses', loader: Courses, priority: 3 },
  { path: '/marketplace', loader: Marketplace, priority: 3 },
  { path: '/forum', loader: Forum, priority: 4 },
  { path: '/profile', loader: Profile, priority: 4 },
];

export function usePreloadPages(isEnabled: boolean = true) {
  const [location] = useLocation();

  useEffect(() => {
    if (!isEnabled) return;
    
    const preloadTimer = setTimeout(() => {
      const pagesToPreload = PRELOAD_PRIORITY
        .filter(page => page.path !== location)
        .sort((a, b) => a.priority - b.priority);

      pagesToPreload.forEach((page, index) => {
        setTimeout(() => {
          page.loader().catch(() => {});
        }, index * 500);
      });
    }, 2000);

    return () => clearTimeout(preloadTimer);
  }, [location]);

  const preloadOnHover = (path: string) => {
    const page = PRELOAD_PRIORITY.find(p => p.path === path);
    if (page) {
      page.loader().catch(() => {});
    }
  };

  return { preloadOnHover };
}
