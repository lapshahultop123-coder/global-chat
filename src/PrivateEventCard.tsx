import { CalendarDays, Check } from 'lucide-react';

export type PrivateChatEvent = { id: string; room_id: string; created_by: string; title: string; starts_at: string; created_at: string; responses: { user_id: string; response: 'going' | 'maybe' | 'no' }[] };
const OPTIONS = [{ id: 'going', text: 'Going' }, { id: 'maybe', text: 'Maybe' }, { id: 'no', text: 'No' }] as const;
export default function PrivateEventCard({ event, userId, busy, onRespond }: { event: PrivateChatEvent; userId: string; busy?: boolean; onRespond: (response: 'going' | 'maybe' | 'no') => void }) {
  const own = event.responses?.find(row => row.user_id === userId)?.response;
  return <article className="private-event-card"><div className="private-event-heading"><CalendarDays size={16}/><b>ROOM EVENT</b><time>{new Date(event.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div><h3>{event.title}</h3><div className="private-event-rsvp">{OPTIONS.map(option => { const count = event.responses?.filter(row => row.response === option.id).length || 0; return <button type="button" key={option.id} className={own === option.id ? 'selected' : ''} aria-pressed={own === option.id} disabled={busy || Date.now() > new Date(event.starts_at).getTime()} onClick={() => onRespond(option.id)}>{own === option.id && <Check size={14}/>} {option.text} <small>{count}</small></button>; })}</div></article>;
}
