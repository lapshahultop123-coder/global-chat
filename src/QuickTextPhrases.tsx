import { useEffect, useState } from 'react';
import { MessageSquareText, Plus, Trash2 } from 'lucide-react';

type Phrase = { id: string; text: string };
const STORAGE_KEY = 'global-chat-quick-text-phrases-v1';
const SYNC_EVENT = 'global-chat-quick-text-phrases-updated';

function readPhrases(userId: string): Phrase[] {
  if (!userId) return [];
  try {
    const value = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string' && typeof item.text === 'string').slice(0, 30) : [];
  } catch { return []; }
}

export default function QuickTextPhrases({ userId, onInsert }: { userId: string; onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [phrases, setPhrases] = useState<Phrase[]>(() => readPhrases(userId));
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setPhrases(readPhrases(userId)); setDraft(''); setOpen(false);
    const sync = (event: Event) => { if ((event as CustomEvent<{ userId?: string }>).detail?.userId === userId) setPhrases(readPhrases(userId)); };
    const storage = (event: StorageEvent) => { if (event.key === `${STORAGE_KEY}:${userId}`) setPhrases(readPhrases(userId)); };
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(SYNC_EVENT, sync); window.removeEventListener('storage', storage); };
  }, [userId]);

  const persist = (next: Phrase[]) => {
    setPhrases(next);
    try { localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(next)); } catch { /* Keep this feature available for the current session if storage is full. */ }
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { userId } }));
  };

  const savePhrase = () => {
    const text = draft.trim();
    if (!text || !userId || phrases.length >= 30) return;
    persist([...phrases, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: text.slice(0, 500) }]);
    setDraft('');
  };

  return <div className="quick-text-phrases">
    <button type="button" className="quick-text-trigger" aria-label="Quick text phrases" title="Quick text phrases" aria-expanded={open} onClick={() => setOpen(value => !value)}><MessageSquareText size={17}/></button>
    {open && <section className="quick-text-popover" aria-label="Quick text phrases">
      <header><strong>Quick phrases</strong><span>Saved on this device for your account</span></header>
      <div className="quick-text-save">
        <textarea value={draft} maxLength={500} rows={2} onChange={event => setDraft(event.target.value)} placeholder="Write a phrase to save…" aria-label="New quick phrase"/>
        <button type="button" onClick={savePhrase} disabled={!draft.trim() || phrases.length >= 30}><Plus size={15}/> SAVE</button>
      </div>
      {phrases.length ? <div className="quick-text-list">{phrases.map(phrase => <div className="quick-text-row" key={phrase.id}>
        <button type="button" className="quick-text-insert" title="Insert phrase" onClick={() => { onInsert(phrase.text); setOpen(false); }}>{phrase.text}</button>
        <button type="button" className="quick-text-remove" aria-label={`Delete phrase: ${phrase.text.slice(0, 50)}`} title="Delete phrase" onClick={() => persist(phrases.filter(item => item.id !== phrase.id))}><Trash2 size={14}/></button>
      </div>)}</div> : <p className="quick-text-empty">Save a phrase above, then tap it to insert it into your message.</p>}
      {phrases.length >= 30 && <small className="quick-text-limit">You can save up to 30 phrases.</small>}
    </section>}
  </div>;
}
