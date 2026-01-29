import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hash, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface TagFiltersProps {
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export function TagFilters({ activeTag, onTagChange }: TagFiltersProps) {
  const [visibleCount, setVisibleCount] = useState(10);

  const { data: trendingTags = [] } = useQuery({
    queryKey: ['/api/timeline/trending-tags'],
  });

  const visibleTags = trendingTags.slice(0, visibleCount);
  const hasMore = trendingTags.length > visibleCount;

  const handleShowMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  const handleShowLess = () => {
    setVisibleCount(10);
  };

  return (
    <div className="space-y-3" data-testid="tag-filters">
      {activeTag && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium w-fit">
          <Hash className="w-3 h-3" />
          {activeTag}
          <button
            onClick={() => onTagChange(null)}
            className="ml-1 hover:bg-primary/80 rounded-full p-0.5"
            aria-label="Remover filtro"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {!activeTag && trendingTags.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground font-medium flex items-center gap-1">
            <Hash className="w-4 h-4" />
            Tags populares:
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            {visibleTags.map((tag: any) => (
              <Button
                key={tag.id}
                variant="outline"
                size="sm"
                onClick={() => onTagChange(tag.name)}
                className="gap-1.5 hover:border-primary"
                data-testid={`tag-filter-${tag.name}`}
              >
                <Hash className="w-3 h-3" />
                {tag.name}
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {tag.postCount || 0}
                </Badge>
              </Button>
            ))}

            {(hasMore || visibleCount > 10) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={hasMore ? handleShowMore : handleShowLess}
                className="gap-1"
                data-testid="button-show-more-tags"
              >
                {hasMore ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Ver mais ({trendingTags.length - visibleCount})
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Ver menos
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}