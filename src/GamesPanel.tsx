import { useEffect, useRef } from 'react';
import { Gamepad2, X } from 'lucide-react';

export default function GamesPanel({onClose}:{onClose:()=>void}){
  const previousFocus=useRef<HTMLElement|null>(null);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;

  useEffect(()=>{
    previousFocus.current=document.activeElement as HTMLElement|null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')onCloseRef.current()};
    window.addEventListener('keydown',onKeyDown);
    return()=>{
      window.removeEventListener('keydown',onKeyDown);
      document.body.style.overflow=previousOverflow;
      if(previousFocus.current?.isConnected)previousFocus.current.focus();
    };
  },[]);

  return <div className="games-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="games-panel" role="dialog" aria-modal="true" aria-labelledby="games-title">
      <header className="games-header">
        <div className="games-heading-icon"><Gamepad2 size={21}/></div>
        <div className="games-heading-copy"><h2 id="games-title">Games</h2><p>Game area</p></div>
        <button className="games-close" type="button" onClick={onClose} aria-label="Close games" autoFocus><X size={19}/></button>
      </header>
      <div className="games-empty-state">
        <div className="games-empty-art"><Gamepad2 size={37}/></div>
        <h3>No games right now</h3>
        <p>The Games option stays in the menu. No playable games are included at the moment.</p>
      </div>
    </section>
  </div>;
}
