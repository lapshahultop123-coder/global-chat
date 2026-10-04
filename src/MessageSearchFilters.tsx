import { CalendarDays, Filter, Search } from 'lucide-react';
import type { ChangeEvent } from 'react';

export type SearchFilters = {
  senderId: string;
  from: string;
  to: string;
  content: 'all' | 'text' | 'voice' | 'links' | 'files';
};

export const emptySearchFilters: SearchFilters = { senderId: '', from: '', to: '', content: 'all' };

export function matchesMessageSearch(message: any, kind: 'text' | 'voice', query: string, filters: SearchFilters) {
  const body = String(message.body || '');
  const senderId = String(message.user_id || message.sender_id || '');
  const haystack = `${message.name || ''} ${body} ${message.country || ''} ${message.subdivision || ''} ${kind === 'voice' ? 'voice audio file' : ''}`.toLowerCase();
  if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
  if (filters.senderId && senderId !== filters.senderId) return false;
  const timestamp = new Date(message.created_at).getTime();
  if (filters.from && timestamp < new Date(`${filters.from}T00:00:00`).getTime()) return false;
  if (filters.to && timestamp >= new Date(`${filters.to}T00:00:00`).getTime() + 86400000) return false;
  if (filters.content === 'text' && kind !== 'text') return false;
  if (filters.content === 'voice' && kind !== 'voice') return false;
  if (filters.content === 'links' && !/https?:\/\/\S+/i.test(body)) return false;
  if (filters.content === 'files' && kind !== 'voice' && message.kind !== 'file' && !message.storage_path) return false;
  return true;
}

export function MessageSearchFilters({ query, onQueryChange, filters, onFiltersChange, messages, showQuery = true, onSubmitQuery }: {
  query: string;
  onQueryChange: (value: string) => void;
  filters: SearchFilters;
  onFiltersChange: (value: SearchFilters) => void;
  messages: any[];
  showQuery?: boolean;
  onSubmitQuery?: () => void;
}) {
  const senders = [...new Map(messages.map(message => [String(message.user_id || message.sender_id || ''), String(message.name || 'User')])).entries()]
    .filter(([id]) => id)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const update = (key: keyof SearchFilters) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onFiltersChange({ ...filters, [key]: event.target.value });

  return <div className="message-search-controls">
    {showQuery&&<label className="message-search-query"><Search size={16}/><input autoFocus value={query} onChange={event => onQueryChange(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')onSubmitQuery?.()}} placeholder="Search messages..." aria-label="Search messages"/></label>}
    <div className="message-search-filters">
      <label><Filter size={14}/><select value={filters.senderId} onChange={update('senderId')} aria-label="Filter by sender"><option value="">All senders</option>{senders.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label><span>Type</span><select value={filters.content} onChange={update('content')} aria-label="Filter by message type"><option value="all">All content</option><option value="text">Text</option><option value="voice">Voice / audio</option><option value="links">Links</option><option value="files">Files / audio</option></select></label>
      <label><CalendarDays size={14}/><input type="date" value={filters.from} onChange={update('from')} aria-label="From date"/></label>
      <label><span>to</span><input type="date" value={filters.to} onChange={update('to')} aria-label="To date"/></label>
    </div>
  </div>;
}
