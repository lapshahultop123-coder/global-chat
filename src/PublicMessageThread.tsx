import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AVATARS } from './data/catalog';
import { validateMessage } from './lib/validation';
import SafeMessageText from './SafeMessageText';

type PublicMessage = {
  id: string;
  user_id: string;
  name: string;
  country: string;
  subdivision: string;
  avatar_id: number;
  body: string;
  created_at: string;
  expires_at: string;
};
type ThreadReply = PublicMessage & { message_id: string };
type Props = {
  message: PublicMessage;
  profile: { name: string; country: string; subdivision: string; avatarId: number; agreed: boolean };
  onClose: () => void;
  onCountChange: (messageId: string, count: number) => void;
};

const avatar = (id: number) => AVATARS.find(item => item.id === id)?.src || AVATARS[0].src;
const flag = (code: string) => code.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
const time = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export default function PublicMessageThread({ message, profile, onClose, onCountChange }: Props) {
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const replyIdsRef = useRef(new Set<string>());
  const receivedRepliesRef = useRef(new Map<string, ThreadReply>());
  const expired = new Date(message.expires_at).getTime() <= now;

  useEffect(() => {
    let active = true;
    const channel = supabase.channel(`public-message-thread-${message.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'message_thread_replies', filter: `message_id=eq.${message.id}`,
      }, (payload: any) => {
        const reply = payload.new as ThreadReply;
        if (new Date(reply.expires_at).getTime() <= Date.now()) return;
        receivedRepliesRef.current.set(reply.id, reply);
        if (replyIdsRef.current.has(reply.id)) return;
        replyIdsRef.current.add(reply.id);
        setReplies(previous => [...previous, reply].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        onCountChange(message.id, replyIdsRef.current.size);
      })
      .subscribe();

    const load = async () => {
      setLoading(true);
      setReplies([]);
      replyIdsRef.current.clear();
      receivedRepliesRef.current.clear();
      setError('');
      onCountChange(message.id, 0);
      const { data, error: queryError } = await supabase
        .from('message_thread_replies').select('*').eq('message_id', message.id)
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(200);
      if (!active) return;
      if (queryError) setError('Could not load this discussion. Please try again.');
      else {
        const rows = [...new Map([...(data || []), ...receivedRepliesRef.current.values()].map((item: any) => [item.id, item])).values()] as ThreadReply[];
        rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        replyIdsRef.current = new Set(rows.map(item => item.id));
        setReplies(rows);
        onCountChange(message.id, rows.length);
      }
      setLoading(false);
    };
    void load();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(clock);
      void supabase.removeChannel(channel);
    };
  }, [message.id, onCountChange]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (sending || expired) return;
    const value = body.trim();
    const validation = validateMessage(value);
    if (validation) { setError(validation); return; }

    setSending(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-thread-reply', {
        body: { messageId: message.id, text: value, profile },
      });
      if (invokeError || data?.error) {
        setError(data?.error || 'Could not send the reply. Please try again.');
        return;
      }
      const reply = data?.reply as ThreadReply | undefined;
      if (!reply?.id) { setError('The server did not confirm the reply. Please try again.'); return; }
      receivedRepliesRef.current.set(reply.id, reply);
      if (!replyIdsRef.current.has(reply.id)) {
        replyIdsRef.current.add(reply.id);
        setReplies(previous => [...previous, reply].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        onCountChange(message.id, replyIdsRef.current.size);
      }
      setBody('');
    } catch {
      setError('Could not send the reply. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
    if (event.key === 'Escape') onClose();
  };

  return (
    <div className="public-thread-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="public-thread-panel" role="dialog" aria-modal="true" aria-labelledby="public-thread-title">
        <header className="public-thread-header">
          <div><MessageCircle size={20}/><span><strong id="public-thread-title">Message thread</strong><small>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</small></span></div>
          <button type="button" onClick={onClose} aria-label="Close discussion"><X size={19}/></button>
        </header>

        <div className="public-thread-root-label">Original message</div>
        <article className="public-thread-root">
          <img src={avatar(message.avatar_id)} alt=""/>
          <div><div className="public-thread-author"><strong>{message.name}</strong><time>{time(message.created_at)}</time></div><p><SafeMessageText text={message.body}/></p></div>
        </article>

        <div className="public-thread-replies" aria-live="polite">
          {loading ? <div className="public-thread-empty">Loading discussion…</div> : replies.length === 0 ?
            <div className="public-thread-empty">No replies yet. Start the discussion.</div> :
            replies.map(reply => <article className="public-thread-reply" key={reply.id}>
              <img src={avatar(reply.avatar_id)} alt=""/>
              <div><div className="public-thread-author"><strong>{reply.name}</strong><span>{flag(reply.country)} {reply.subdivision}</span><time>{time(reply.created_at)}</time></div><p><SafeMessageText text={reply.body}/></p></div>
            </article>)}
          {expired && <p className="public-thread-expired">This message has expired. Its discussion is closed.</p>}
          {error && <p className="public-thread-error" role="alert">{error}</p>}
        </div>

        <form className="public-thread-composer" onSubmit={event => void send(event)}>
          <textarea value={body} maxLength={500} rows={2} disabled={expired || sending}
            onChange={event => setBody(event.target.value)} onKeyDown={handleKeyDown}
            placeholder={expired ? 'Discussion closed' : 'Write a reply…'} aria-label="Write a thread reply"/>
          <div><small>Replies stay in this thread · Enter to send · Shift+Enter for a new line</small>
            <button type="submit" disabled={expired || sending || !body.trim()} aria-label="Send thread reply" title="Send reply"><Send size={17}/></button>
          </div>
        </form>
      </section>
    </div>
  );
}
