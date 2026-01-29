import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function TrendingTopics() {
  const [, setLocation] = useLocation();
  const [showAll, setShowAll] = useState(false);

  const { data: topics = [] } = useQuery({
    queryKey: ['/api/timeline/trending-tags'],
    staleTime: 30 * 60 * 1000, // 30 minutos (trending tags não mudam rápido)
    gcTime: 60 * 60 * 1000, // 1 hora
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Mostrar no máximo 4 tags (2x2 grid) inicialmente, depois expande em blocos de 4
  const visibleTopics = showAll ? topics : topics.slice(0, 4);
  const hasMore = topics.length > 4;

  return (
    <Card data-testid="card-trending-topics">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          # Tags em Alta
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {topics.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2" data-testid="text-no-topics">
            Nenhum tópico em alta ainda
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleTopics.map((topic: any, index: number) => (
                <button
                  key={index}
                  className="inline-flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-[10px] sm:text-xs font-medium min-h-[32px]"
                  data-testid={`trending-topic-${index}`}
                  onClick={() => setLocation(`/timeline?tag=${topic.name}`)}
                >
                  <span className="font-semibold break-words" data-testid={`text-topic-tag-${index}`}>
                    #{topic.name}
                  </span>
                  <span className="text-muted-foreground text-[9px] flex-shrink-0" data-testid={`text-topic-post-${index}`}>
                    ({topic.postCount})
                  </span>
                </button>
              ))}
            </div>

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="w-full h-7 text-xs hover:bg-muted/50"
                data-testid="button-toggle-topics"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Ver menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Ver mais ({topics.length - 4} tags)
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}