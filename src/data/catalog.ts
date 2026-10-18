import avatarStyleData from './avatar-styles.json';
import avatarPickerStyleSlugData from './avatar-picker-style-slugs.json';
import extraAvatarData from './avatar-extra.json';
export const AVATAR_STYLES = avatarStyleData;
export const AVATAR_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let nextAvatarId = 0;
const originalAvatars = AVATAR_STYLES.flatMap(style => Array.from({length:style.count},(_,variant)=> {
  const id = ++nextAvatarId;
  return {id,src:`/avatars/avatar-${id}.svg`,style:style.name,slug:style.slug,variant,letter:style.slug==='initials'?AVATAR_LETTERS[variant]:undefined};
}));
export const AVATARS = [...originalAvatars,...extraAvatarData.map(avatar=>({...avatar,letter:undefined as string|undefined}))];
export const AVATAR_PICKER_STYLE_SLUGS = new Set(avatarPickerStyleSlugData);
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
  ['slate','Slate','#090d12','#151c24','#64748b','#cbd5e1'],
  ['emerald','Emerald','#06120e','#0d2419','#059669','#34d399'],
  ['violet','Violet Pulse','#100719','#21102e','#7c3aed','#e879f9'],
  ['sky','Skyline','#07121c','#10283a','#0ea5e9','#bae6fd'],
  ['sand','Desert Sand','#171107','#2a2110','#ca8a04','#fde68a'],
  ['rose','Rose Quartz','#170b11','#2a121d','#e11d48','#fda4af'],
  ['teal','Deep Teal','#061214','#0c2427','#0d9488','#67e8f9'],
  ['indigo','Indigo Glass','#080b18','#121936','#4f46e5','#818cf8'],
  ['mono','Monochrome','#0c0c0c','#1b1b1b','#d4d4d4','#fafafa'],
  ['deep-space','Deep Space','#070916','#111a2d','#4c1d95','#075985'],
  ['sapphire','Sapphire','#07111d','#0d2238','#1d4ed8','#0b5f86'],
  ['cobalt','Cobalt','#080d20','#111d3d','#1e40af','#3730a3'],
  ['glacier','Glacier','#07161b','#102b32','#0e7490','#115e59'],
  ['jade','Jade','#07150f','#10251a','#047857','#15803d'],
  ['moss','Moss','#0c150b','#192318','#4d7c0f','#365314'],
  ['plum','Plum','#150a1d','#261233','#7e22ce','#86198f'],
  ['amethyst','Amethyst','#13091b','#241230','#6b21a8','#5b21b6'],
  ['berry','Berry','#180914','#2b1422','#9d174d','#881337'],
  ['ruby','Ruby','#1a090d','#2f141b','#b91c1c','#9f1239'],
  ['copper','Copper','#1a100a','#2c1d13','#9a3412','#7c2d12'],
  ['amber','Amber','#191407','#2a210e','#92400e','#854d0e'],
  ['olive','Olive','#131509','#242710','#556b2f','#3f6212'],
  ['steel','Steel','#0b1016','#18212b','#475569','#334155'],
  ['twilight','Twilight','#10101c','#1d1d31','#4338ca','#6d28d9'],
  ['blue-hour','Blue Hour Glow','#10172b','#17213e','#2563eb','#831843','linear-gradient(180deg,rgba(7,11,22,.22) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#222222 0%,#1b2b4f 28%,#376de0 56%,#9b62e8 79%,#e86ac5 100%)'],
  ['violet-dawn','Violet Dawn','#100d22','#1d1736','#581c87','#701a75','linear-gradient(180deg,rgba(7,11,22,.22) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#222222 0%,#1e284b 29%,#3e63cf 53%,#865be6 76%,#d77adf 100%)'],
  ['pink-horizon','Pink Horizon','#160e23','#241733','#be185d','#a21caf','linear-gradient(180deg,rgba(7,11,22,.22) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#202020 0%,#1e3157 30%,#3d68d9 54%,#bd5bcd 76%,#f472b6 100%)'],
  ['rose-cosmos','Rose Cosmos','#180d21','#29172f','#a31858','#b91c74','linear-gradient(180deg,rgba(7,11,22,.22) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#212121 0%,#253052 28%,#456fe1 53%,#b54fc4 75%,#ff58b0 100%)'],
  ['electric-dusk','Electric Dusk','#0c1426','#16213b','#273c9b','#712e83','linear-gradient(180deg,rgba(7,11,22,.22) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#1f1f1f 0%,#1f3156 30%,#3268de 55%,#8a55dc 78%,#d946ef 100%)']
].map(([id,name,bg,surface,primary,accent,wallpaper]) => ({id,name,bg,surface,primary,accent,wallpaper}));

export const EMOJIS = [
  '👍','❤️','😂','😮','😢','😡','🎉','🙏','👋','😊','🔥','⭐',
  '😍','🥰','😎','🤔','😴','😭','🤗','🤩','🥳','😅',
  '😇','🤫','🤯','🥺','🫠','🥹','😤','🤓','🧐','😋',
  '💯','💕','💖','💗','💙','💜','💚','💛','🧡','🖤',
  '👀','✨','💡','🎯','🏆','⚽','🎮','🎵','🎧','📸',
  '🍕','🍔','🍟','🍩','🍰','☕','🐶','🐱','🐼','🌈'
];
export const REACTIONS = ['👍','❤️','😂','😮','😢','😡','🎉','🙏'];
export const TEXT_SIZES = { small: 14, medium: 16, large: 18, xl: 20 } as const;
export type TextSize = keyof typeof TEXT_SIZES;
