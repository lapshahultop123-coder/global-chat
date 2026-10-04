import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, X } from 'lucide-react';

type ErrorKind = 'network' | 'service' | 'access' | 'input' | 'general' | 'queued';

function getErrorKind(message: string): ErrorKind {
  const text = message.toLowerCase();
  if (text.includes('reconnect queue') || text.includes('will retry when you are online') || text.includes('saved privately')) return 'queued';
  if (/maintenance|service unavailable|temporarily unavailable|\b50[0234]\b/.test(text)) return 'service';
  if (/offline|network|failed to fetch|fetch failed|connection|websocket|timed? out|timeout/.test(text)) return 'network';
  if (/permission|not authorized|unauthorized|\b401\b|\b403\b|jwt|session expired/.test(text)) return 'access';
  if (/invalid|must be|too short|too long|character|\b550\b|not allowed/.test(text)) return 'input';
  return 'general';
}

function simpleReason(message: string, kind: ErrorKind): string {
  if (kind === 'queued') return message.toLowerCase().includes('saved privately') ? 'Message saved privately.' : 'Message saved in the reconnect queue. It will retry when your connection returns.';
  if (kind === 'service') return 'The service is temporarily unavailable, possibly during maintenance. Please try again shortly.';
  if (kind === 'network') return 'Connection interrupted. Check your internet connection and try again.';
  if (kind === 'access') return 'Your account could not complete this action. Sign in again and retry.';
  if (kind === 'input') return 'Please check the information and try again.';
  const text = message.trim();
  const technical = /\b(PGRST|SQLSTATE|Postgres|PostgreSQL|HTTP\s*\d{3}|status code|constraint|schema cache|row level security)\b/i;
  if (text && text.length <= 180 && !technical.test(text) && !text.includes('\n')) return text;
  return 'We could not complete this action. Please try again.';
}

function makeCode(context: string, kind: ErrorKind): string {
  const area = context.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'CHAT';
  const category = kind === 'network' ? 'NET' : kind === 'service' ? 'SVC' : kind === 'access' ? 'AUTH' : kind === 'input' ? 'INPUT' : 'APP';
  return `ZY-${area}-${category}-01`;
}

export default function ClearErrorNotice({ message, context, onDismiss }: { message: string; context: string; onDismiss?: () => void }) {
  const kind = useMemo(() => getErrorKind(message), [message]);
  const reason = useMemo(() => simpleReason(message, kind), [message, kind]);
  const code = useMemo(() => makeCode(context, kind), [context, kind]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (kind !== 'service') return;
    window.dispatchEvent(new Event('zynyro:service-maintenance'));
  }, [kind, message]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return <div className={`clear-error-notice${kind === 'queued' ? ' queued' : ''}`} role={kind === 'queued' ? 'status' : 'alert'}>
    <AlertTriangle size={16} aria-hidden="true"/>
    <div className="clear-error-copy"><strong>{reason}</strong>{kind !== 'queued'&&<span>Support code: <code>{code}</code></span>}</div>
    {kind !== 'queued'&&<button type="button" onClick={()=>void copyCode()} aria-label={copied?'Support code copied':'Copy support code'} title={copied?'Copied':'Copy support code'}><Copy size={14}/><span>{copied?'COPIED':'COPY CODE'}</span></button>}
    {onDismiss&&<button type="button" className="clear-error-dismiss" onClick={onDismiss} aria-label="Dismiss message"><X size={15}/></button>}
  </div>;
}
