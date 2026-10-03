import type { ReactNode } from 'react';

export function mentionAlias(name: string) {
  return name.normalize('NFKC').replace(/[\s._-]+/g, '').toLocaleLowerCase();
}

export function containsMention(body: string, displayName: string) {
  const alias = mentionAlias(displayName);
  if (!alias) return false;
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@${escaped}(?![\\p{L}\\p{N}_])`, 'iu').test(body);
}

export function renderMentionText(body: string): ReactNode[] {
  const parts = body.split(/(^|[^\p{L}\p{N}_])(@[\p{L}\p{N}_]+)/gu);
  return parts.map((part, index) => part.startsWith('@')
    ? <span className="chat-mention" key={index}>{part}</span>
    : <span key={index}>{part}</span>);
}
