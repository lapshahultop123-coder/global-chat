import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

export default function PrivateEventComposer({ onClose, onCreate, busy = false, error = '' }: { onClose: () => void; onCreate: (title: string, startsAt: string) => void; busy?: boolean; error?: string }) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const validTime = Boolean(startsAt) && new Date(startsAt).getTime() > Date.now();
  return <div className="feature-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="event-create-title"><section className="feature-modal"><header><div><b id="event-create-title"><CalendarDays size={16}/> Create room event</b><small>Room members can RSVP Going, Maybe, or No.</small></div><button type="button" onClick={onClose} aria-label="Close event form"><X size={19}/></button></header><label htmlFor="private-event-title">Event name</label><input id="private-event-title" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Group call" autoFocus/><label htmlFor="private-event-time">Date and time</label><input id="private-event-time" type="datetime-local" min={min} value={startsAt} onChange={event => setStartsAt(event.target.value)}/>{error && <div className="feature-modal-error" role="alert">{error}</div>}<div className="feature-modal-actions"><button type="button" className="private-modal-cancel" onClick={onClose} disabled={busy}>CANCEL</button><button type="button" className="primary-btn" disabled={busy || title.trim().length < 2 || !validTime} onClick={() => onCreate(title.trim(), new Date(startsAt).toISOString())}>{busy ? 'CREATING…' : 'CREATE EVENT'}</button></div></section></div>;
}
