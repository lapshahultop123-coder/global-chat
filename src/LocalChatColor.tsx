import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

const COLORS = [
  { name: 'Blue', value: '#4d9cff' }, { name: 'Purple', value: '#a16bff' },
  { name: 'Green', value: '#31c48d' }, { name: 'Orange', value: '#ff9f43' },
  { name: 'Pink', value: '#f45da8' }, { name: 'Red', value: '#fa6262' },
];
const KEY = 'global-chat-local-chat-colors-v1';
function load(userId: string, chatKey: string) { try { return JSON.parse(localStorage.getItem(KEY) || '{}')?.[userId]?.[chatKey] || ''; } catch { return ''; } }

export default function LocalChatColor({ userId, chatKey }: { userId: string; chatKey: string }) {
  const [color, setColor] = useState(() => load(userId, chatKey));
  const [open, setOpen] = useState(false);
  useEffect(() => { setColor(load(userId, chatKey)); setOpen(false); }, [userId, chatKey]);
  const choose = (value: string) => {
    setColor(value);
    try { const all = JSON.parse(localStorage.getItem(KEY) || '{}'); all[userId] ||= {}; if (value) all[userId][chatKey] = value; else delete all[userId][chatKey]; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* local preference only */ }
    setOpen(false);
  };
  const selected = COLORS.find(item => item.value === color);
  return <div className="local-chat-color">
    <button type="button" className="local-chat-color-trigger" title="Choose a local chat color" aria-expanded={open} onClick={() => setOpen(value => !value)} style={color ? { borderColor: color, backgroundColor: `${color}18` } : undefined}>
      <i style={{ background: color || 'var(--accent)' }}/><Palette size={14}/><span>{selected?.name || 'Chat color'}</span>
    </button>
    {open && <div className="local-chat-color-options" role="group" aria-label="Choose chat color">
      {COLORS.map(item => <button type="button" key={item.value} style={{ background: item.value }} className={color === item.value ? 'selected' : ''} aria-label={item.name} aria-pressed={color === item.value} title={item.name} onClick={() => choose(item.value)}/>)}
      <button type="button" className="local-chat-color-clear" onClick={() => choose('')}>Default</button>
    </div>}
  </div>;
}
