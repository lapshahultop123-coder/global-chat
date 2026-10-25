import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Gamepad2, Keyboard, Play, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import ArcadeGame, { clearAllGameRecords } from './ArcadeGame';
import { GameCharacterArt } from './GameCharacter';

export type GameId='runner'|'memory'|'reef'|'breaker'|'orbit'|'rune'|'maze'|'garden'|'rail'|'kitchen'|'drums'|'hopper'|'archery'|'solar'|'sorter';
export type GameInfo={id:GameId;title:string;desc:string;controls:string;accent:string;deep:string;avatar:number;genre:string};
export const GAMES:GameInfo[]=[
  {id:'runner',title:'Starfall Sprint',desc:'Run with Nova, jump moon rocks and gather star sparks.',controls:'Space / ↑ to jump · tap Jump on mobile',accent:'#7ce8dc',deep:'#152441',avatar:0,genre:'Reflex'},
  {id:'memory',title:'Moon Memory',desc:'Help Milo find matching moon charms before the board gets harder.',controls:'Tap two cards to match · touch or mouse',accent:'#bea4ff',deep:'#201b43',avatar:1,genre:'Puzzle'},
  {id:'reef',title:'Reef Rescue',desc:'Swim with Bubbles, collect pearls and avoid jellyfish.',controls:'WASD / arrows · drag or use touch arrows',accent:'#56e7ce',deep:'#0d3441',avatar:2,genre:'Arcade'},
  {id:'breaker',title:'Crystal Breaker',desc:'Bounce Nova’s spark and clear every crystal in the wall.',controls:'← / → or drag paddle · Space serves · Shift sparks',accent:'#62dfff',deep:'#142947',avatar:3,genre:'Arcade'},
  {id:'orbit',title:'Orbit Dodge',desc:'Pilot a pocket rocket through meteors and collect starlight.',controls:'WASD / arrows to steer · drag on mobile',accent:'#7da8ff',deep:'#121f42',avatar:4,genre:'Survival'},
  {id:'rune',title:'Rune Defender',desc:'Tap incoming wisps before they reach Astra’s heart crystal.',controls:'Tap a wisp · Space casts at nearest',accent:'#ff8fc5',deep:'#3a193e',avatar:5,genre:'Defense'},
  {id:'maze',title:'Lantern Maze',desc:'Guide Pipkin through a moonlit maze, gather keys and open the exit.',controls:'WASD / arrows · tap a neighboring tile',accent:'#b9ed78',deep:'#1b382d',avatar:6,genre:'Puzzle'},
  {id:'garden',title:'Prism Garden',desc:'Bee clears connected flower groups of matching color.',controls:'Tap a connected group of 3+ flowers',accent:'#ff92c1',deep:'#3c1f39',avatar:7,genre:'Puzzle'},
  {id:'rail',title:'Skyrail Switch',desc:'Switch Bao between cloud tracks to dodge gates and gather stars.',controls:'← / → to switch tracks · tap screen sides',accent:'#ffd777',deep:'#3c2b20',avatar:8,genre:'Reflex'},
  {id:'kitchen',title:'Comet Kitchen',desc:'Catch ingredients in recipe order before they fall past the counter.',controls:'A / S / D choose a lane · tap a lane',accent:'#ffab78',deep:'#422819',avatar:9,genre:'Arcade'},
  {id:'drums',title:'Echo Drummer',desc:'Keep Ribbit’s festival rhythm by hitting each glowing lane on time.',controls:'A / S / D / F · tap a lane at the ring',accent:'#b5a4ff',deep:'#252049',avatar:10,genre:'Rhythm'},
  {id:'hopper',title:'Cloud Hopper',desc:'Bounce Pogo up floating clouds and reach the moon lantern.',controls:'← / → move · Space / ↑ jump · tap Jump',accent:'#a7d9ff',deep:'#1a2e50',avatar:11,genre:'Platform'},
  {id:'archery',title:'Lumen Archery',desc:'Aim with Aria and hit moving light targets before they fade.',controls:'Tap target or click to aim · Space fires',accent:'#ffe27d',deep:'#38321d',avatar:12,genre:'Aim'},
  {id:'solar',title:'Solar Defense',desc:'Move Sol across the star lane and protect the tiny sun from drones.',controls:'A / D or ← / → move · Space / Shoot',accent:'#ffae78',deep:'#40251f',avatar:13,genre:'Shooter'},
  {id:'sorter',title:'Astro Sorter',desc:'Sort falling orbit gems into the matching color gates.',controls:'A / S / D or tap a color gate',accent:'#8be1ff',deep:'#142e48',avatar:14,genre:'Puzzle'}
];

export const GameMascot=GameCharacterArt;

export default function GamesPanel({onClose}:{onClose:()=>void}){
  const [selected,setSelected]=useState<GameId|null>(null),[query,setQuery]=useState(''),[genre,setGenre]=useState('All'),[confirmReset,setConfirmReset]=useState(false),[resetNotice,setResetNotice]=useState('');
  const previousFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{previousFocus.current=document.activeElement as HTMLElement|null;const old=document.body.style.overflow;document.body.style.overflow='hidden';const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(confirmReset)setConfirmReset(false);else if(selected)setSelected(null);else onClose()}};window.addEventListener('keydown',onKey);return()=>{window.removeEventListener('keydown',onKey);document.body.style.overflow=old;if(previousFocus.current?.isConnected)previousFocus.current.focus()}},[onClose,selected,confirmReset]);
  const genres=['All',...Array.from(new Set(GAMES.map(g=>g.genre)))],filtered=GAMES.filter(g=>(genre==='All'||g.genre===genre)&&(g.title+' '+g.desc).toLowerCase().includes(query.toLowerCase())),active=GAMES.find(g=>g.id===selected);
  return <div className="games-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className={'games-panel'+(selected?' is-playing':'')} role="dialog" aria-modal="true" aria-labelledby="games-title">
      <header className="games-header"><div className="games-heading-icon"><Gamepad2 size={21}/></div><div className="games-heading-copy"><h2 id="games-title">Games Arcade</h2><p>15 quick games · play solo · chat stays ready</p></div><button className="games-close" type="button" onClick={onClose} aria-label="Close games" autoFocus><X size={19}/></button></header>
      {active?<ArcadeGame key={active.id} game={active} onBack={()=>setSelected(null)}/>:<div className="games-library">
        <div className="games-library-intro"><div><span className="games-eyebrow"><Sparkles size={13}/> PICK YOUR NEXT CHALLENGE</span><h3>Choose a little world</h3><p>Keyboard and touch controls · waves grow faster as you score.</p></div><div className="games-library-stat"><b>15</b><small>GAMES</small></div></div>
        <div className="games-filters"><label className="games-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a game" aria-label="Find a game"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search"><X size={14}/></button>}</label><div className="games-genres" role="group" aria-label="Filter by game type">{genres.map(g=><button key={g} type="button" className={genre===g?'active':''} onClick={()=>setGenre(g)}>{g}</button>)}</div></div>
        <div className="games-grid">{filtered.map((g)=><button type="button" key={g.id} className="games-card" style={{'--game-accent':g.accent,'--game-deep':g.deep} as React.CSSProperties} onClick={()=>setSelected(g.id)} aria-label={'Play '+g.title+': '+g.desc}>
          <div className="games-card-top"><span className="games-card-index">{String(GAMES.indexOf(g)+1).padStart(2,'0')}</span><span className="games-card-kind">{g.genre}</span></div><div className="games-card-avatar"><GameMascot game={g} size={92}/><i aria-hidden="true"/></div><div className="games-card-copy"><b>{g.title}</b><span>{g.desc}</span></div><div className="games-card-bottom"><span>{g.controls.split(' · ')[0]}</span><span className="games-card-play"><Play size={13}/></span></div>
        </button>)}</div>
        {!filtered.length&&<div className="games-no-results"><Search size={22}/><b>No matching games</b><span>Try another title or game type.</span></div>}
        <footer className="games-library-foot"><span><Keyboard size={13}/> Keyboard and touch supported</span><span>{resetNotice||'Scores and highest waves save on this device'}</span><button type="button" className="games-reset-trigger" onClick={()=>{setResetNotice('');setConfirmReset(true)}}><RotateCcw size={13}/>Reset records</button></footer>
      </div>}
      {confirmReset&&<div className="games-reset-shade"><section className="games-reset-dialog" role="alertdialog" aria-modal="true" aria-labelledby="games-reset-title" aria-describedby="games-reset-copy"><span className="games-reset-mark"><RotateCcw size={20}/></span><h3 id="games-reset-title">Reset saved records?</h3><p id="games-reset-copy">This removes the saved best scores and highest waves for all 15 games on this device.</p><div><button type="button" className="games-reset-cancel" autoFocus onClick={()=>setConfirmReset(false)}>Keep records</button><button type="button" className="games-reset-confirm" onClick={()=>{clearAllGameRecords(GAMES.map(g=>g.id));setConfirmReset(false);setResetNotice('All game records reset')}}><Check size={15}/>Reset all</button></div></section></div>}
    </section>
  </div>;
}
