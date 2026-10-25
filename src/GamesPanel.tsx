import { useEffect } from 'react';
import { Gamepad2, Sparkles, X } from 'lucide-react';

export default function GamesPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <div className="games-backdrop" role="dialog" aria-modal="true" aria-labelledby="games-title" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="games-panel">
      <header className="games-header">
        <div className="games-heading-icon"><Gamepad2 size={21}/></div>
        <div className="games-heading-copy"><h2 id="games-title">Games</h2><p>Quick games, right in chat</p></div>
        <button className="games-close" type="button" onClick={onClose} aria-label="Close games" autoFocus><X size={19}/></button>
      </header>
      <div className="games-empty-state">
        <div className="games-empty-art"><Gamepad2 size={36}/><span><Sparkles size={15}/></span></div>
        <h3>Games are coming soon</h3>
        <p>This space is ready for a game. Check back soon.</p>
      </div>
    </section>
  </div>;
}
