import type { CSSProperties } from 'react';

export type CharacterSpec={id:string;title:string;accent:string;deep:string;avatar:number};

const glyphs=[
  '<path d="M90 105l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z"/>',
  '<path d="M90 99c-12 13-11 23 0 31 11-8 12-18 0-31zm0 9v20"/>',
  '<circle cx="90" cy="114" r="10"/><path d="M90 97v-7m0 48v-7m-20-17h7m26 0h7"/>',
  '<path d="M90 101l11 13-11 16-11-16z"/><path d="M90 101v29"/>',
  '<path d="M90 101c-4 8-13 11-13 20 0 8 6 12 13 6 7 6 13 2 13-6 0-9-9-12-13-20z"/>',
  '<path d="M90 102q-18 4-13 18 9 7 13-2 4 9 13 2 5-14-13-18z"/>',
  '<path d="M78 103l12 8 12-8-5 17 5 7-12-5-12 5 5-7z"/>',
  '<path d="M90 101q10 13 0 29-10-16 0-29zm-12 7q-11 13-3 23l12-7m15-16q11 13 3 23l-12-7"/>',
  '<path d="M90 100l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z"/><circle cx="90" cy="117" r="4"/>',
  '<path d="M90 102c-4 5-10 10-7 16 3 5 11 2 7-4-4 6 4 9 7 4 3-6-3-11-7-16z"/>',
  '<circle cx="90" cy="114" r="11"/><path d="M90 95v-8m0 54v-8m-20-19h8m24 0h8"/><circle cx="90" cy="114" r="4"/>',
  '<path d="M90 100l8 10-3 18-5-5-5 5-3-18z"/><path d="M78 108l-8 6 8 6m24-12 8 6-8 6"/>',
  '<path d="M90 99l3 11 11 3-11 3-3 11-3-11-11-3 11-3z"/><circle cx="90" cy="113" r="3"/>',
  '<path d="M90 99l12 13-12 18-12-18z"/><path d="M90 99v31m-12-18h24"/>',
  '<path d="M90 100q-4 11-13 17 10 2 13 10 3-8 13-10-9-6-13-17z"/><circle cx="90" cy="116" r="4"/>',
];

const earShapes=[
  '<path d="M55 63C36 54 30 32 34 17c17 4 28 17 30 37M125 54c2-20 13-33 30-37 4 15-2 37-21 46"/>',
  '<path d="M59 55C43 43 43 24 54 13c12 9 17 23 16 39M121 52c-1-16 4-30 16-39 11 11 11 30-5 42"/>',
  '<path d="M68 49c-8-21-1-35 10-42 10 10 12 23 7 39M112 46c-5-16-3-29 7-39 11 7 18 21 10 42"/>',
  '<path d="M56 60C38 53 31 42 28 28c16 0 29 8 39 23M124 51c10-15 23-23 39-23-3 14-10 25-28 32"/>',
  '<path d="M59 58C44 45 42 28 47 16c14 8 22 20 23 38M121 54c1-18 9-30 23-38 5 12 3 29-12 42"/>',
  '<path d="M55 63Q31 52 29 28q20 1 36 25M125 53q16-24 36-25-2 24-26 35"/><path d="M40 36l17 20m83-20-17 20"/>',
  '<path d="M62 56Q42 30 51 14q19 8 20 38M118 56q20-26 11-42-19 8-20 38"/><path d="M54 31l12 17m60-17-12 17"/>',
  '<path d="M54 60q-17-20-13-38 19 3 31 20m54 18q17-20 13-38-19 3-31 20"/><path d="M46 43l19 12m69-12-19 12"/>',
  '<path d="M58 57q-20-12-18-34 20 4 31 25m51 9q20-12 18-34-20 4-31 25"/><path d="M47 35l17 17m69-17-17 17"/>',
  '<path d="M57 62q-16-24-7-43 18 10 23 34m54 9q16-24 7-43-18 10-23 34"/><path d="M53 35q10 5 14 15m60-15q-10 5-14 15"/>',
  '<path d="M65 58Q42 50 39 30q18-2 32 19m44 9q23-8 26-28-18-2-32 19"/><path d="M47 36l17 16m69-16-17 16"/>',
  '<path d="M54 61Q29 47 34 23q19 4 31 23m60 15q25-14 20-38-19 4-31 23"/><path d="M42 34l20 21m76-21-20 21"/>',
  '<path d="M57 58Q39 39 48 18q18 9 23 31m38 9q18-19 9-40-18 9-23 31"/><path d="M52 31l14 20m62-20-14 20"/>',
  '<path d="M57 59Q37 48 35 27q18 2 31 21m58 11q20-11 22-32-18 2-31 21"/><path d="M43 35l20 18m74-18-20 18"/>',
  '<path d="M63 58Q40 43 48 20q18 6 23 34m38 4q23-15 15-38-18 6-23 34"/><path d="M53 33l13 19m58-19-13 19"/>',
];

const tools=[
  '<path d="M145 121l19-44 5 2-13 48"/><circle cx="166" cy="73" r="11"/><path d="M159 73h14m-7-7v14"/>',
  '<path d="M145 117l25-48 4 2-19 52"/><circle cx="171" cy="66" r="10"/><path d="M165 66h12"/>',
  '<path d="M145 120l21-45 5 2-15 49"/><path d="M160 67q12-12 20 0-8 12-20 0z"/><circle cx="170" cy="67" r="3"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><path d="M169 65l10 10-10 10-10-10z"/><path d="M169 68v14"/>',
  '<path d="M145 121l20-44 5 2-14 48"/><circle cx="170" cy="70" r="11"/><circle cx="170" cy="70" r="5"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><path d="M165 62q13 1 12 15-9 10-18 0-2-9 6-15z"/><path d="M165 70h10"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><path d="M161 67l13-12 8 11-13 12z"/><circle cx="170" cy="67" r="3"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><path d="M166 58q4 9 13 12-9 4-13 13-4-9-13-13 9-3 13-12z"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><circle cx="170" cy="69" r="11"/><path d="M170 59v20m-10-10h20"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><path d="M164 57q11 6 14 16-12 1-18 9 0-14 4-25z"/><path d="M166 63l9 10"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><circle cx="169" cy="69" r="9"/><path d="M162 57l14 23m0-23-14 23"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><path d="M161 61l17 0-7 17h-12z"/><path d="M168 62v15"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><path d="M167 56q11 8 8 19-9 8-18 0-3-12 10-19z"/><path d="M163 67q7-8 12 0"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><path d="M170 56l11 12-11 12-11-12z"/><circle cx="170" cy="68" r="4"/>',
  '<path d="M145 121l22-45 5 2-16 49"/><circle cx="170" cy="68" r="11"/><path d="M170 57v22m-10-11h20m-17-7 14 14m0-14-14 14"/>',
];

function colorMix(accent:string,deep:string){
  return {accent,deep,light:'#f5fbff',mid:'#9ab4c8',shade:'#111b2d',ink:'#07111e'};
}

export function gameCharacterSvg(game:CharacterSpec,variant=game.avatar){
  const v=((variant%15)+15)%15,c=colorMix(game.accent,game.deep),uid=`char-${game.id.replace(/[^a-z0-9]/gi,'')}-${v}`;
  const ears=earShapes[v%earShapes.length],tool=tools[v%tools.length],glyph=glyphs[v%glyphs.length];
  const antenna=v%3===2?'<path d="M76 40Q70 17 57 20m47 20q6-23 19-20" fill="none" stroke="url(#metal)" stroke-width="5" stroke-linecap="round"/><circle cx="57" cy="19" r="5" fill="url(#glow)"/><circle cx="123" cy="19" r="5" fill="url(#glow)"/>':'';
  const crest=v%3===0?'<path d="M71 50q19-20 38 0l-4 8H75z" fill="url(#metal)" stroke="#dceeff" stroke-opacity=".6" stroke-width="2"/>':v%3===1?'<path d="M73 48q17-17 34 0l-5 11H78z" fill="url(#accentMetal)" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>':'<path d="M77 47l13-16 13 16-5 13H82z" fill="url(#accentMetal)" stroke="#fff" stroke-opacity=".65" stroke-width="2"/>';
  const cloak=v%4===0?'<path d="M66 131q-20 33-11 68l24-12 11 28 11-28 24 12q9-37-11-68z" fill="url(#cape)" stroke="#8ca6bb" stroke-opacity=".6" stroke-width="2"/>':'<path d="M69 133q-15 34-7 58l18-9 10 22 10-22 18 9q8-27-7-58z" fill="url(#cape)" stroke="#8ca6bb" stroke-opacity=".55" stroke-width="2"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="240" viewBox="0 0 190 240" fill="none">
    <defs>
      <linearGradient id="${uid}-skin" x1="48" y1="48" x2="128" y2="130" gradientUnits="userSpaceOnUse"><stop stop-color="${c.light}"/><stop offset=".35" stop-color="${c.accent}"/><stop offset=".72" stop-color="${c.deep}"/><stop offset="1" stop-color="${c.ink}"/></linearGradient>
      <linearGradient id="${uid}-metal" x1="54" y1="127" x2="131" y2="212" gradientUnits="userSpaceOnUse"><stop stop-color="#e7f5ff"/><stop offset=".2" stop-color="#718ca4"/><stop offset=".48" stop-color="#25384e"/><stop offset=".72" stop-color="#101b2b"/><stop offset=".9" stop-color="#738ba0"/><stop offset="1" stop-color="#d7ebf7"/></linearGradient>
      <linearGradient id="${uid}-accentMetal" x1="64" y1="41" x2="113" y2="133" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".25" stop-color="${c.accent}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient>
      <linearGradient id="${uid}-cape" x1="61" y1="132" x2="123" y2="214" gradientUnits="userSpaceOnUse"><stop stop-color="${c.accent}" stop-opacity=".95"/><stop offset=".22" stop-color="${c.deep}"/><stop offset="1" stop-color="#090f1c"/></linearGradient>
      <radialGradient id="${uid}-face" cx="0" cy="0" r="1" gradientTransform="matrix(42 49 -43 37 67 56)" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".22" stop-color="#eff7ff"/><stop offset=".61" stop-color="${c.accent}"/><stop offset="1" stop-color="${c.deep}"/></radialGradient>
      <radialGradient id="${uid}-iris" cx="0" cy="0" r="1" gradientTransform="matrix(8 15 -12 7 75 86)" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".22" stop-color="${c.accent}"/><stop offset=".62" stop-color="#1475b7"/><stop offset="1" stop-color="#050a15"/></radialGradient>
      <radialGradient id="${uid}-glow"><stop stop-color="#fff"/><stop offset=".35" stop-color="${c.accent}"/><stop offset="1" stop-color="${c.deep}"/></radialGradient>
      <filter id="${uid}-shadow" x="8" y="5" width="164" height="231" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="5"/></filter>
      <filter id="${uid}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <ellipse cx="91" cy="226" rx="44" ry="7" fill="${c.accent}" opacity=".24" filter="url(#${uid}-soft)"/>
    <ellipse cx="91" cy="226" rx="32" ry="4" fill="#050914" opacity=".8"/>
    <circle cx="90" cy="105" r="75" fill="${c.accent}" opacity=".12" filter="url(#${uid}-soft)"/>
    <g stroke-linecap="round" stroke-linejoin="round">
      <g stroke="#718ca4" stroke-width="8" fill="url(#${uid}-metal)">${ears}</g>
      <g stroke="#dceeff" stroke-opacity=".58" stroke-width="2">${ears}</g>${antenna}${crest}
      <path d="M65 128q-19 19-25 45l20 9 21-27zm50 0q19 19 25 45l-20 9-21-27z" fill="url(#${uid}-metal)" stroke="#c7dcec" stroke-opacity=".65" stroke-width="3"/>
      <path d="M45 167l-10 18q-1 7 6 9l13-3 9-17m62-7 10 18q1 7-6 9l-13-3-9-17" fill="url(#${uid}-accentMetal)" stroke="#d9efff" stroke-width="2"/>
      ${cloak}
      <path d="M70 134l-8 37 10 14-7 32q12 9 25 1 13 8 25-1l-7-32 10-14-8-37q-24-15-50 0z" fill="url(#${uid}-metal)" stroke="#d8e9f7" stroke-opacity=".7" stroke-width="3"/>
      <path d="M73 137l-6 30 8 12-5 30q10 5 20-1v-73zm34 0 6 30-8 12 5 30q-10 5-20-1v-73z" fill="#101a2a" opacity=".7"/>
      <path d="M73 147l17 9 17-9-3 25-14 9-14-9z" fill="url(#${uid}-accentMetal)" stroke="#e8f4ff" stroke-opacity=".72" stroke-width="2"/>
      <path d="M81 160l9-6 9 6-9 13z" fill="#091424" stroke="${c.accent}" stroke-width="2"/>
      <g fill="url(#${uid}-glow)" stroke="#fff" stroke-width="1.5"><circle cx="90" cy="164" r="6"/><circle cx="72" cy="185" r="3"/><circle cx="108" cy="185" r="3"/></g>
      <path d="M70 190h40m-34 8h28" stroke="#d0e1ee" stroke-opacity=".5" stroke-width="2"/>
      <path d="M75 213l-4 10q8 5 19 1l2-10m13-1 4 10q-8 5-19 1l-2-10" fill="url(#${uid}-metal)" stroke="#d5e7f3" stroke-width="2"/>
      <path d="M68 223q10-4 22 1l-1 8H64q-3-4 4-9zm23 1q12-5 22 0l7 8H90z" fill="#111a28" stroke="#a7bdcd" stroke-width="2"/>
      <path d="M69 227h15m12 0h16" stroke="${c.accent}" stroke-width="2"/>
      <g fill="url(#${uid}-metal)" stroke="#d9e8f4" stroke-width="3"><path d="M62 70q-2-26 28-31 31 4 29 34l-4 35q-5 24-25 29-20-5-25-29z"/></g>
      <path d="M65 80q0-28 25-32 27 4 27 32l-4 28q-4 22-23 27-19-5-23-27z" fill="url(#${uid}-face)" stroke="#fff" stroke-opacity=".76" stroke-width="2.5"/>
      <path d="M65 77q4-20 24-22 23 2 28 22" stroke="#fff" stroke-opacity=".48" stroke-width="3"/>
      <path d="M56 75q6-18 18-25m49 25q-6-18-18-25" stroke="${c.accent}" stroke-width="4" opacity=".88"/>
      <path d="M67 82q8-11 18 0" stroke="#111929" stroke-width="5"/><path d="M95 82q9-11 18 0" stroke="#111929" stroke-width="5"/>
      <ellipse cx="76" cy="91" rx="10" ry="14" fill="#050b14" stroke="#cfeeff" stroke-width="2"/><ellipse cx="104" cy="91" rx="10" ry="14" fill="#050b14" stroke="#cfeeff" stroke-width="2"/>
      <ellipse cx="77" cy="93" rx="6.5" ry="10" fill="url(#${uid}-iris)" stroke="${c.accent}" stroke-width="1.5"/><ellipse cx="103" cy="93" rx="6.5" ry="10" fill="url(#${uid}-iris)" stroke="${c.accent}" stroke-width="1.5"/>
      <ellipse cx="79" cy="89" rx="2.5" ry="3.8" fill="#fff" stroke="none"/><ellipse cx="105" cy="89" rx="2.5" ry="3.8" fill="#fff" stroke="none"/>
      <circle cx="70" cy="105" r="2" fill="#fff" opacity=".7" stroke="none"/><circle cx="111" cy="105" r="2" fill="#fff" opacity=".7" stroke="none"/>
      <path d="M86 107q4-4 8 0-2 4-4 4t-4-4z" fill="#a56d77" stroke="#ffe8e9" stroke-width="1"/>
      <path d="M86 116q4 4 8 0" stroke="#263043" stroke-width="2.4"/><path d="M79 108q-6 4-9 1m41-1q6 4 9 1" stroke="#ffb6bc" stroke-opacity=".8" stroke-width="3"/>
      <path d="M71 69q18-19 39 0" stroke="#fff" stroke-opacity=".48" stroke-width="2"/><path d="M72 122q18 9 36 0" stroke="${c.deep}" stroke-opacity=".6" stroke-width="2"/>
      <path d="M84 61h12" stroke="#fff" stroke-width="2" opacity=".75"/><circle cx="90" cy="62" r="3" fill="${c.accent}" stroke="#fff" stroke-width="1.5"/>
      <path d="M42 91l9 4v14l-9 4m96-22-9 4v14l9 4" fill="url(#${uid}-metal)" stroke="#dcecff" stroke-width="2"/><circle cx="47" cy="102" r="4" fill="url(#${uid}-glow)" stroke="#fff" stroke-width="1.5"/><circle cx="133" cy="102" r="4" fill="url(#${uid}-glow)" stroke="#fff" stroke-width="1.5"/>
      ${tool}
      <g transform="translate(36 75) scale(.6)" fill="${c.accent}" stroke="#fff" stroke-width="1.2" opacity=".95">${glyph}</g>
      <path d="M59 141l-8 17m69-17 8 17M79 180h22" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>
      <circle cx="59" cy="184" r="5" fill="url(#${uid}-glow)" stroke="#fff" stroke-width="1.5"/><circle cx="121" cy="184" r="5" fill="url(#${uid}-glow)" stroke="#fff" stroke-width="1.5"/>
      <path d="M78 198l4 4m20-4-4 4" stroke="#fff" stroke-opacity=".56" stroke-width="2"/>
    </g>
  </svg>`;
}

const sourceCache=new Map<string,string>();
export function gameCharacterSource(game:CharacterSpec,variant=game.avatar){
  const key=game.id+':'+variant;let source=sourceCache.get(key);
  if(!source){source='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(gameCharacterSvg(game,variant));sourceCache.set(key,source)}
  return source;
}

const imageCache=new Map<string,HTMLImageElement>();
export function drawGameCharacter(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,game:CharacterSpec,variant=game.avatar){
  const key=game.id+':'+variant;let image=imageCache.get(key);
  if(!image){image=new Image();image.src=gameCharacterSource(game,variant);imageCache.set(key,image)}
  if(!image.complete||!image.naturalWidth)return;
  const h=Math.min(78,Math.max(32,r*2.75)),w=h*.79;
  ctx.save();ctx.shadowColor=game.accent;ctx.shadowBlur=Math.min(13,r*.42);ctx.drawImage(image,x-w/2,y-h/2,w,h);ctx.restore();
}

export function GameCharacterArt({game,size=64,className='',alt}:{game:CharacterSpec;size?:number;className?:string;alt?:string}){
  const style={'--character-glow':game.accent} as CSSProperties;
  return <img className={'games-mascot '+className} style={style} src={gameCharacterSource(game)} width={Math.round(size*.79)} height={size} alt={alt||game.title+' character'} draggable={false}/>;
}
