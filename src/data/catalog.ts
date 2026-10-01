import avatarStyleData from './avatar-styles.json';
export const AVATAR_STYLES = avatarStyleData;
export const AVATAR_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let nextAvatarId = 0;
export const AVATARS = AVATAR_STYLES.flatMap(style => Array.from({length:style.count},(_,variant)=> {
  const id = ++nextAvatarId;
  return {id,src:`/avatars/avatar-${id}.svg`,style:style.name,slug:style.slug,variant,letter:style.slug==='initials'?AVATAR_LETTERS[variant]:undefined};
}));
export const AVATAR_PICKER_STYLE_SLUGS = new Set([
  'initials','adventurer-neutral','blobs','bottts','bottts-neutral','fun-emoji','glyphs','icons','identicon','initial-face','landscape','marbles','moods','patchwork','pixel-art','pixelbot','planets','rings','shadows','shape-grid','slice','stripes','thumbs','waves'
]);
export const AVATAR_PICKER_STYLES = AVATAR_STYLES.filter(style => AVATAR_PICKER_STYLE_SLUGS.has(style.slug));
export const AVATAR_PICKER_AVATARS = AVATARS.filter(avatar => AVATAR_PICKER_STYLE_SLUGS.has(avatar.slug));

export const THEMES = [
  ['midnight','Midnight Neon','#080b16','#10172b','#7c3aed','#22d3ee'],
  ['ocean','Ocean Blue','#07111f','#0b2035','#1687e8','#38bdf8'],
  ['sunset','Sunset Glow','#1b0d13','#32151e','#f97316','#fb7185'],
  ['forest','Forest','#08140f','#10231a','#16a34a','#84cc16'],
  ['galaxy','Galaxy Purple','#0d0820','#1b1034','#8b5cf6','#c084fc'],
  ['arctic','Arctic','#07141a','#102832','#0ea5e9','#67e8f9'],
  ['pink','Pink Dream','#1b0b16','#301326','#ec4899','#f9a8d4'],
  ['carbon','Carbon Black','#080808','#151515','#a3a3a3','#f5f5f5'],
  ['aurora','Aurora','#061311','#0c2521','#14b8a6','#a3e635'],
  ['gold','Golden Light','#161108','#29200b','#d4a72c','#fde68a'],
  ['crimson','Crimson Night','#18080b','#2a1015','#ef4444','#fb7185'],
  ['mint','Mint Glass','#061311','#0b211d','#10b981','#5eead4'],
  ['royal','Royal Blue','#070c1a','#111d3a','#2563eb','#818cf8'],
  ['lavender','Lavender Mist','#100b1a','#20152f','#a78bfa','#ddd6fe'],
  ['coffee','Coffee House','#130d09','#241711','#a16207','#fbbf24'],
  ['coral','Coral Reef','#170b0b','#2b1512','#f97316','#fb7185'],
  ['slate','Slate',' #090d12'.trim(),'#151c24','#64748b','#cbd5e1'],
  ['emerald','Emerald','#06120e','#0d2419','#059669','#34d399'],
  ['violet','Violet Pulse','#100719','#21102e','#7c3aed','#e879f9'],
  ['sky','Skyline','#07121c','#10283a','#0ea5e9','#bae6fd'],
  ['sand','Desert Sand','#171107','#2a2110','#ca8a04','#fde68a'],
  ['rose','Rose Quartz','#170b11','#2a121d','#e11d48','#fda4af'],
  ['teal','Deep Teal','#061214','#0c2427','#0d9488','#67e8f9'],
  ['indigo','Indigo Glass','#080b18','#121936','#4f46e5','#818cf8'],
  ['mono','Monochrome','#0c0c0c','#1b1b1b','#d4d4d4','#fafafa']
].map(([id,name,bg,surface,primary,accent]) => ({id,name,bg,surface,primary,accent}));

export const EMOJIS = ['👍','❤️','😂','😮','😢','😡','🎉','🙏','👋','😊','🔥','⭐'];
export const REACTIONS = ['👍','❤️','😂','😮','😢','😡','🎉','🙏'];
export const TEXT_SIZES = { small: 14, medium: 16, large: 18, xl: 20 } as const;
export type TextSize = keyof typeof TEXT_SIZES;
