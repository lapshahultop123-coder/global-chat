import { useId, useState, type ReactNode } from 'react';
import { ExternalLink, ShieldAlert, X } from 'lucide-react';

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)}\]]+$/;

function splitUrl(value: string) {
  const match = value.match(TRAILING_PUNCTUATION);
  const suffix = match?.[0] || '';
  const raw = suffix ? value.slice(0, -suffix.length) : value;
  try {
    const url = new URL(raw.startsWith('www.') ? `https://${raw}` : raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const reasons: string[] = [];
    if (url.protocol === 'http:') reasons.push('This link does not use an encrypted HTTPS connection.');
    if (host.startsWith('xn--') || host.split('.').some(part => part.startsWith('xn--'))) reasons.push('The address contains an internationalized domain name that can resemble another site.');
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')) reasons.push('The address points directly to a numeric network address.');
    if (/^(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly)$/i.test(host)) reasons.push('This is a shortened link, so its destination is hidden.');
    return { url, suffix, reasons };
  } catch { return null; }
}

export default function SafeMessageText({ text, renderText = value => value }: { text: string; renderText?: (value: string) => ReactNode }) {
  const [pending, setPending] = useState<ReturnType<typeof splitUrl> | null>(null);
  const titleId = useId();
  const parts: Array<string | { raw: string; parsed: NonNullable<ReturnType<typeof splitUrl>> }> = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const parsed = splitUrl(raw);
    if (!parsed) continue;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    parts.push({ raw, parsed });
    lastIndex = index + raw.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>
    <span className="safe-message-text">{parts.map((part, index) => typeof part === 'string' ? <span key={index}>{renderText(part)}</span> : <span key={index}><a href={part.parsed.url.href} rel="nofollow noopener noreferrer" onClick={event => { event.preventDefault(); setPending(part.parsed); }}>{part.raw}</a>{part.parsed.suffix}</span>)}</span>
    {pending && <span className="link-safety-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPending(null); }}><span className="link-safety-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}><span className="link-safety-heading"><ShieldAlert size={20}/><b id={titleId}>Check this link</b><button type="button" onClick={() => setPending(null)} aria-label="Close link warning"><X size={17}/></button></span><span className="link-safety-url">{pending.url.href}</span><span className="link-safety-message">Links can lead to unsafe or misleading websites. We cannot verify this destination.</span>{pending.reasons.map(reason => <span className="link-safety-reason" key={reason}>{reason}</span>)}<span className="link-safety-actions"><button type="button" onClick={() => setPending(null)}>CANCEL</button><button type="button" onClick={() => { window.open(pending.url.href, '_blank', 'noopener,noreferrer'); setPending(null); }}><ExternalLink size={15}/> OPEN LINK</button></span></span></span>}
  </>;
}
