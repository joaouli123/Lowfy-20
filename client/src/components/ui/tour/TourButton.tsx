import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourButtonProps {
  onClick: () => void;
  label?: string;
  variant?: 'default' | 'ghost' | 'outline';
}

export function TourButton({ onClick, label = 'Conhecer PLRs', variant = 'outline' }: TourButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      className="gap-2 bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
      data-testid="button-start-tour"
    >
      <HelpCircle className="w-4 h-4" />
      {label}
    </Button>
  );
}
