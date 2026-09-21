const offensive = ['fuck','fucking','shit','bitch','bastard','asshole','dick','pussy','cunt','motherfucker','slut','whore'];
const allowedEmoji = new Set(['👍','❤️','😂','😮','😢','😡','🎉','🙏','👋','😊','🔥','⭐']);

export function normalizeForModeration(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[^a-z0-9]+/g,'').replace(/(.)\1+/g,'$1');
}
export function hasOffensiveLanguage(value: string) {
  const normalized = normalizeForModeration(value);
  return offensive.some(word => normalized.includes(word));
}
export function isEnglishOnly(value: string) {
  let i = 0;
  while (i < value.length) {
    let matched = false;
    for (const emoji of allowedEmoji) {
      if (value.startsWith(emoji, i)) { i += emoji.length; matched = true; break; }
    }
    if (matched) continue;
    const cp = value.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    if (/[A-Za-z0-9\s\p{P}\p{S}]/u.test(ch)) { i += ch.length; continue; }
    return false;
  }
  return true;
}
export function validateMessage(value: string) {
  if (!value.trim()) return 'Message cannot be empty.';
  if ([...value].length > 500) return 'Messages can contain up to 500 characters.';
  if (!isEnglishOnly(value)) return 'English only. Please use English letters, numbers, symbols, and approved emojis.';
  if (hasOffensiveLanguage(value)) return 'Please use respectful language. Offensive language is not allowed.';
  return null;
}
