import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea"> & { 
    onEmojiSelect?: (emoji: string) => void;
    showEmojiPicker?: boolean;
  }
>(({ className, onEmojiSelect, showEmojiPicker = false, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-gray-100 ring-offset-background placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          showEmojiPicker && "pr-10",
          className
        )}
        ref={ref}
        {...props}
      />
      {showEmojiPicker && onEmojiSelect && (
        <div className="absolute bottom-2 right-2">
          <EmojiPickerButton onEmojiSelect={onEmojiSelect} />
        </div>
      )}
    </div>
  )
})
Textarea.displayName = "Textarea"

// Componente interno do botão de emoji
const EmojiPickerButton = ({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) => {
  const [open, setOpen] = React.useState(false);
  
  // Importação dinâmica para evitar SSR issues
  const [EmojiPicker, setEmojiPicker] = React.useState<any>(null);
  
  React.useEffect(() => {
    import('emoji-picker-react').then((mod) => {
      setEmojiPicker(() => mod.default);
    });
  }, []);

  const handleEmojiClick = (emojiData: any) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  if (!EmojiPicker) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" x2="9.01" y1="9" y2="9" />
          <line x1="15" x2="15.01" y1="9" y2="9" />
        </svg>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full mb-2 right-0 z-50 shadow-lg rounded-lg border border-border">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              autoFocusSearch={false}
              searchPlaceHolder="Buscar emoji..."
              width={320}
              height={400}
            />
          </div>
        </>
      )}
    </>
  );
};

export { Textarea }
