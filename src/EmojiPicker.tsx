import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { EMOJIS } from './data/catalog';

type Props = {
  className?: string;
  userId?: string;
  onSelect: (emoji: string) => void;
};

function favoriteKey(userId: string) { return `global-chat-emoji-favorites-v1:${userId}`; }

export default function EmojiPicker({ className = '', userId = 'guest', onSelect }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const value = localStorage.getItem(favoriteKey(userId)); const parsed = value ? JSON.parse(value) : []; return Array.isArray(parsed) ? parsed.filter((emoji: unknown) => typeof emoji === 'string') : []; } catch { return []; }
  });
  const [showFavorites, setShowFavorites] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(favoriteKey(userId), JSON.stringify(favorites)); } catch { /* storage may be unavailable */ }
  }, [favorites, userId]);
  const scroll = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' });
  };
  const toggleFavorite = (emoji: string) => setFavorites(current => current.includes(emoji) ? current.filter(item => item !== emoji) : [...current, emoji]);

  return (
    <div className={`emoji-picker ${className}`} role="group" aria-label="Emoji picker">
      <div className="emoji-favorites-heading"><button type="button" aria-expanded={showFavorites} onClick={() => setShowFavorites(value => !value)}><Star size={14}/>{favorites.length ? `Favorites (${favorites.length})` : 'Favorite emojis'}</button><small>Tap ☆ to save</small></div>
      {showFavorites && <div className="emoji-favorites-track">{favorites.length ? favorites.map(emoji => <button type="button" className="emoji-picker-item" key={emoji} onClick={() => onSelect(emoji)} aria-label={`Insert favorite ${emoji}`}>{emoji}</button>) : <small>No favorite emojis yet.</small>}</div>}
      <div className="emoji-picker-strip">
        <button type="button" className="emoji-picker-arrow" onClick={() => scroll(-1)} aria-label="Scroll emojis left" title="Previous emojis">
          <ChevronLeft size={17} />
        </button>
        <div className="emoji-picker-track" ref={trackRef}>
          {EMOJIS.map(emoji => (
            <span className="emoji-picker-choice" key={emoji}><button type="button" className="emoji-picker-item" onClick={() => onSelect(emoji)} aria-label={`Insert emoji ${emoji}`}>{emoji}</button><button type="button" className={`emoji-favorite-toggle ${favorites.includes(emoji) ? 'active' : ''}`} onClick={() => toggleFavorite(emoji)} aria-label={favorites.includes(emoji) ? `Remove ${emoji} from favorites` : `Add ${emoji} to favorites`} title={favorites.includes(emoji) ? 'Remove favorite' : 'Add favorite'}><Star size={11} fill={favorites.includes(emoji) ? 'currentColor' : 'none'}/></button></span>
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
