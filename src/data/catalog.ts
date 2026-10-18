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
  ['blue-hour','Blue Hour Glow','#080e1c','#101a2d','#1e3a8a','#312e81','linear-gradient(180deg,rgba(7,11,22,.24) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#0a1020 0%,#102d5c 28%,#2464c1 56%,#574fa5 79%,#b45bb5 100%)'],
  ['violet-dawn','Violet Dawn','#10091c','#211330','#7c3aed','#9333ea','linear-gradient(180deg,rgba(7,11,22,.24) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#10091c 0%,#37166d 28%,#772fc0 55%,#b452d0 78%,#ef9ad8 100%)'],
  ['pink-horizon','Pink Horizon','#180b19','#2b1327','#be185d','#a21caf','linear-gradient(180deg,rgba(7,11,22,.24) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#1a0c20 0%,#4e1753 28%,#ad318b 55%,#e653b4 78%,#f8a2ca 100%)'],
  ['rose-cosmos','Rose Cosmos','#1b0a12','#2c121c','#be123c','#c2410c','linear-gradient(180deg,rgba(7,11,22,.24) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#1b0a13 0%,#5b132e 28%,#b92749 55%,#f05a55 78%,#ffc18b 100%)'],
  ['electric-dusk','Electric Dusk','#071517','#0d2525','#0f766e','#166534','linear-gradient(180deg,rgba(7,11,22,.24) 0%,rgba(7,11,22,.5) 100%),linear-gradient(180deg,#071315 0%,#0a3e4a 28%,#057c90 55%,#19a99e 78%,#8bc34a 100%)']
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
