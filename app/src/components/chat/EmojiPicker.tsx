'use client';

const COMMON_EMOJIS = [
  '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F389}',
  '\u{1F914}', '\u{1F440}', '\u{1F525}', '\u{2705}',
  '\u{274C}', '\u{1F4AF}', '\u{1F64F}', '\u{1F60A}',
  '\u{1F44B}', '\u{1F4AA}', '\u{1F680}', '\u{2B50}',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1 p-2" role="grid" aria-label="Emoji picker">
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg"
          type="button"
          aria-label={`Emoji ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
