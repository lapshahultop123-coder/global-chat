import { useId, useState, type ReactNode } from 'react';
import { ExternalLink, ShieldAlert, X } from 'lucide-react';

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)}\]]+$/;
const INLINE_FORMAT_PATTERN = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|_[^_\n]+_)/g;
const NUMBERED_LINE_PATTERN = /^\s*(\d+)[.)]\s+(.*)$/;

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
  const renderInline = (value: string, keyPrefix: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    for (const match of value.matchAll(INLINE_FORMAT_PATTERN)) {
      const raw = match[0];
      const index = match.index ?? 0;
      if (index > lastIndex) nodes.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{renderText(value.slice(lastIndex, index))}</span>);
      if (raw.startsWith('**')) nodes.push(<strong key={`${keyPrefix}-format-${index}`}>{renderText(raw.slice(2, -2))}</strong>);
      else nodes.push(<em key={`${keyPrefix}-format-${index}`}>{renderText(raw.startsWith('*') ? raw.slice(1, -1) : raw.slice(1, -1))}</em>);
      lastIndex = index + raw.length;
    }
    if (lastIndex < value.length || nodes.length === 0) nodes.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{renderText(value.slice(lastIndex))}</span>);
    return nodes;
  };
  const renderLine = (line: string, keyPrefix: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    for (const match of line.matchAll(URL_PATTERN)) {
      const raw = match[0];
      const index = match.index ?? 0;
      const parsed = splitUrl(raw);
      if (!parsed) continue;
      if (index > lastIndex) nodes.push(...renderInline(line.slice(lastIndex, index), `${keyPrefix}-${lastIndex}`));
      nodes.push(<span key={`${keyPrefix}-link-${index}`}><a href={parsed.url.href} rel="nofollow noopener noreferrer" onClick={event => { event.preventDefault(); setPending(parsed); }}>{raw.slice(0, raw.length - parsed.suffix.length)}</a>{parsed.suffix}</span>);
      lastIndex = index + raw.length;
    }
    if (lastIndex < line.length || nodes.length === 0) nodes.push(...renderInline(line.slice(lastIndex), `${keyPrefix}-${lastIndex}`));
    return nodes;
  };
  const lines = text.split('\n');
  const formattedLines: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const listMatch = lines[index].match(NUMBERED_LINE_PATTERN);
    if (listMatch) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index].match(NUMBERED_LINE_PATTERN);
        if (!item) break;
        items.push(<span className="formatted-list-item" role="listitem" key={`list-${index}`}><span className="formatted-list-marker">{item[1]}.</span><span>{renderLine(item[2], `list-line-${index}`)}</span></span>);
        index++;
      }
      formattedLines.push(<span className="formatted-numbered-list" role="list" key={`list-group-${index}`}>{items}</span>);
      continue;
    }
    const line = lines[index];
    formattedLines.push(<span className={`formatted-message-line${line.length ? '' : ' is-empty'}`} key={`line-${index}`}>{line.length ? renderLine(line, `line-${index}`) : '\u00a0'}</span>);
    index++;
  }
  return <>
    <span className="safe-message-text">{formattedLines}</span>
    {pending && <span className="link-safety-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPending(null); }}><span className="link-safety-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}><span className="link-safety-heading"><ShieldAlert size={20}/><b id={titleId}>Check this link</b><button type="button" onClick={() => setPending(null)} aria-label="Close link warning"><X size={17}/></button></span><span className="link-safety-url">{pending.url.href}</span><span className="link-safety-message">Links can lead to unsafe or misleading websites. We cannot verify this destination.</span>{pending.reasons.map(reason => <span className="link-safety-reason" key={reason}>{reason}</span>)}<span className="link-safety-actions"><button type="button" onClick={() => setPending(null)}>CANCEL</button><button type="button" onClick={() => { window.open(pending.url.href, '_blank', 'noopener,noreferrer'); setPending(null); }}><ExternalLink size={15}/> OPEN LINK</button></span></span></span>}
  </>;
}
