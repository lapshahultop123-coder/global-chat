import { useState } from 'react';
import { CalendarDays, LoaderCircle, Search, X } from 'lucide-react';
import { supabase } from './lib/supabase';

type SearchScope = 'all' | 'public' | 'private' | 'friends';
type Result = { id: string; scope: Exclude<SearchScope, 'all'>; name: string; body: string; created_at: string; room_id?: string };

function escapedLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export default function GlobalMessageSearch({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) { setError('Enter at least 2 characters to search.'); return; }
    setBusy(true); setError(''); setSearched(true);
    const pattern = `%${escapedLike(term)}%`;
    const applyDate = <T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(builder: T) => {
      let next = builder;
      if (from) next = next.gte('created_at', `${from}T00:00:00.000Z`);
      if (to) next = next.lte('created_at', `${to}T23:59:59.999Z`);
      return next;
    };

    try {
      const scopes: Exclude<SearchScope, 'all'>[] = scope === 'all' ? ['public', 'private', 'friends'] : [scope];
      const tasks = scopes.map(async (item): Promise<Result[]> => {
        if (item === 'public') {
          let request = supabase.from('messages').select('id,name,body,created_at').ilike('body', pattern).gt('expires_at', new Date().toISOString());
          request = applyDate(request);
          const { data, error: queryError } = await request.order('created_at', { ascending: false }).limit(100);
          if (queryError) throw queryError;
          return (data || []).map(row => ({ ...row, scope: item }));
        }
        if (item === 'private') {
          let request = supabase.from('private_messages').select('id,room_id,name,body,created_at').ilike('body', pattern).gt('expires_at', new Date().toISOString());
          request = applyDate(request);
          const { data, error: queryError } = await request.order('created_at', { ascending: false }).limit(100);
          if (queryError) throw queryError;
          return (data || []).map(row => ({ ...row, scope: item }));
        }
        let request = supabase.from('friend_messages').select('id,sender_id,body,created_at').ilike('body', pattern).gt('expires_at', new Date().toISOString());
        request = applyDate(request);
        const { data, error: queryError } = await request.order('created_at', { ascending: false }).limit(100);
        if (queryError) throw queryError;
        return (data || []).map(row => ({ ...row, name: row.sender_id, scope: item }));
      });
      const groups = await Promise.all(tasks);
      const merged: Result[] = groups.flat().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 150);
      if (merged.some(row => row.scope === 'friends')) {
        const ids = [...new Set(merged.filter(row => row.scope === 'friends').map(row => row.name))];
        const { data: people } = await supabase.rpc('get_friend_directory', { p_user_ids: ids });
        const peopleRows = (people || []) as Array<{ user_id: string; name: string | null }>;
        const names = new Map<string, string>(peopleRows.map(person => [person.user_id, person.name || 'Friend']));
        merged.forEach(row => { if (row.scope === 'friends') { const senderId = row.name; row.name = senderId === userId ? 'You' : names.get(senderId) || 'Friend'; } });
      }
      setResults(merged);
    } catch {
      setResults([]); setError('Could not search messages. Check your connection and try again.');
    } finally { setBusy(false); }
  };

  return <div className="feature-modal-backdrop global-search-backdrop" role="dialog" aria-modal="true" aria-labelledby="global-search-title" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="feature-modal global-message-search">
      <header><div><h2 id="global-search-title"><Search size={19}/> Search messages</h2><p>Search text in Public, Private, and Friends chats.</p></div><button type="button" onClick={onClose} aria-label="Close search"><X size={19}/></button></header>
      <form onSubmit={event => void runSearch(event)}>
        <label className="global-search-input"><Search size={17}/><input autoFocus value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder="Search by keyword…" aria-label="Search keyword"/></label>
        <div className="global-search-options"><label>Chat<select value={scope} onChange={event => setScope(event.target.value as SearchScope)}><option value="all">All chats</option><option value="public">Public</option><option value="private">Private</option><option value="friends">Friends</option></select></label><label><CalendarDays size={14}/> From<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label><label>To<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label></div>
        <button className="primary-btn" type="submit" disabled={busy || query.trim().length < 2}>{busy ? <><LoaderCircle size={16} className="spinning"/> Searching…</> : 'SEARCH MESSAGES'}</button>
      </form>
      {error && <p className="feature-modal-error" role="alert">{error}</p>}
      {searched && !busy && !error && <div className="global-search-results" aria-live="polite">{results.length ? <><small>{results.length} result{results.length === 1 ? '' : 's'} · newest first</small>{results.map(result => <article key={`${result.scope}:${result.id}`}><div><b>{result.scope === 'public' ? 'Public chat' : result.scope === 'private' ? 'Private chat' : 'Friends chat'}</b><span>{result.name}</span><time>{new Date(result.created_at).toLocaleString()}</time></div><p>{result.body}</p></article>)}</> : <p>No matching text messages found.</p>}</div>}
      <small className="global-search-note">Only messages that are still available under the chat’s retention rules can be found.</small>
    </section>
  </div>;
}
