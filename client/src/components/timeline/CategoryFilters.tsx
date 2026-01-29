import { Button } from '@/components/ui/button';
import { Sparkles, Palette, Users, GraduationCap, LayoutGrid } from 'lucide-react';

interface CategoryFiltersProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const categories = [
  { id: 'all', label: 'Todos', icon: LayoutGrid },
  { id: 'ia', label: 'IA', icon: Sparkles },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'networking', label: 'Networking', icon: Users },
  { id: 'cursos', label: 'Cursos', icon: GraduationCap },
];

export function CategoryFilters({ activeCategory, onCategoryChange }: CategoryFiltersProps) {
  return (
    <div className="flex gap-2 flex-wrap" data-testid="category-filters">
      {categories.map((category) => {
        const Icon = category.icon;
        const isActive = activeCategory === category.id;
        
        return (
          <Button
            key={category.id}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange(category.id)}
            className={isActive ? '' : 'hover:border-primary'}
            data-testid={`filter-${category.id}`}
            aria-pressed={isActive}
          >
            <Icon className="w-4 h-4 mr-2" />
            {category.label}
          </Button>
        );
      })}
    </div>
  );
}
