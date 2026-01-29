
import { useState } from 'react';
import EmojiPickerReact, { EmojiClickData } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onEmojiSelect, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${className}`}
        >
          <Smile className="h-4 w-4 text-muted-foreground hover:text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-0" align="end">
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          autoFocusSearch={false}
          searchPlaceHolder="Buscar emoji..."
          width={320}
          height={400}
        />
      </PopoverContent>
    </Popover>
  );
}
