import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EMOJIS } from './data/catalog';

type Props = {
  className?: string;
  onSelect: (emoji: string) => void;
};

export default function EmojiPicker({ className = '', onSelect }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' });
  };

  return (
    <div className={`emoji-picker ${className}`} role="group" aria-label="Emoji picker">
      <div className="emoji-picker-strip">
        <button type="button" className="emoji-picker-arrow" onClick={() => scroll(-1)} aria-label="Scroll emojis left" title="Previous emojis">
          <ChevronLeft size={17} />
        </button>
        <div className="emoji-picker-track" ref={trackRef}>
          {EMOJIS.map(emoji => (
            <button type="button" className="emoji-picker-item" key={emoji} onClick={() => onSelect(emoji)} aria-label={`Insert emoji ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
        <button type="button" className="emoji-picker-arrow" onClick={() => scroll(1)} aria-label="Scroll emojis right" title="More emojis">
          <ChevronRight size={17} />
        </button>
      </div>
      <small className="emoji-picker-hint">Swipe or use arrows for more</small>
    </div>
  );
}
