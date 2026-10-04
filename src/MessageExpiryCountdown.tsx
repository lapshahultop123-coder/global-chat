import { useEffect, useState } from 'react';

const COUNTDOWN_WINDOW_MS = 2 * 60 * 1000;

export default function MessageExpiryCountdown({ expiresAt }: { expiresAt?: string | null }) {
  const expiry = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(expiry)) return;
    let timer = 0;
    const update = () => {
      const current = Date.now();
      const remaining = expiry - current;
      setNow(current);
      if (remaining < -1000) return;
      const delay = remaining > COUNTDOWN_WINDOW_MS ? remaining - COUNTDOWN_WINDOW_MS : 1000 - (current % 1000);
      timer = window.setTimeout(update, Math.max(40, delay));
    };
    update();
    return () => window.clearTimeout(timer);
  }, [expiry]);

  const remaining = expiry - now;
  if (!Number.isFinite(expiry) || remaining > COUNTDOWN_WINDOW_MS || remaining < -1000) return null;
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const label = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return <span className={`message-expiry-countdown${seconds <= 30 ? ' urgent' : ''}`} aria-label={`Expires in ${label}`} title={`Message expires in ${label}`}>{label}</span>;
}
