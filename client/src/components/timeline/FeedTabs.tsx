import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, Users, User } from 'lucide-react';

interface FeedTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3 bg-muted/50 h-9 sm:h-10" data-testid="feed-tabs">
        <TabsTrigger 
          value="feed" 
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-sm px-1 sm:px-3"
          data-testid="tab-feed"
          aria-selected={activeTab === 'feed'}
        >
          <Home className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
          <span className="text-[10px] sm:text-sm">Feed</span>
        </TabsTrigger>
        <TabsTrigger 
          value="following" 
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-sm px-1 sm:px-3"
          data-testid="tab-following"
          aria-selected={activeTab === 'following'}
        >
          <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
          <span className="text-[10px] sm:text-sm">Seguindo</span>
        </TabsTrigger>
        <TabsTrigger 
          value="myposts" 
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-sm px-1 sm:px-3"
          data-testid="tab-myposts"
          aria-selected={activeTab === 'myposts'}
        >
          <User className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-2" />
          <span className="text-[10px] sm:text-sm">Meus</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}