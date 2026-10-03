import { useState, type MouseEvent } from 'react';
import { Bold, Italic, ListOrdered, Type } from 'lucide-react';

type FormatKind = 'bold' | 'italic' | 'list';

export default function TextFormattingToolbar({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);

  const apply = (kind: FormatKind, event: MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const scope = button.closest('.composer, .friend-compose');
    const field = scope?.querySelector('textarea[data-message-input], input[data-message-input]') as HTMLTextAreaElement | HTMLInputElement | null;
    if (!field) return;

    let start = field.selectionStart ?? value.length;
    let end = field.selectionEnd ?? start;
    let selected = value.slice(start, end);
    let replacement = '';
    let nextStart = start;
    let nextEnd = start;

    if (kind === 'list') {
      let emptyLine = false;
      if (!selected) {
        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = value.indexOf('\n', start);
        const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex;
        start = lineStart;
        end = lineEnd;
        selected = value.slice(start, end);
        emptyLine = !selected.trim();
      }
      let number = 1;
      replacement = emptyLine ? '1. ' : selected.split('\n').map(line => {
        if (!line.trim()) return line;
        const content = line.replace(/^\s*\d+[.)]\s+/, '');
        return `${number++}. ${content}`;
      }).join('\n');
      nextStart = emptyLine ? start + replacement.length : start;
      nextEnd = start + replacement.length;
    } else {
      const marker = kind === 'bold' ? '**' : '*';
      if (selected) {
        replacement = `${marker}${selected}${marker}`;
        nextStart = start + marker.length;
        nextEnd = nextStart + selected.length;
      } else {
        replacement = `${marker}${marker}`;
        nextStart = start + marker.length;
        nextEnd = nextStart;
      }
    }

    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    if (next.length > 500) return;
    onChange(next);
    requestAnimationFrame(() => {
      if (field instanceof HTMLTextAreaElement) {
        field.style.height = 'auto';
        field.style.height = `${Math.min(120, field.scrollHeight)}px`;
      }
      field.focus();
      field.setSelectionRange(nextStart, nextEnd);
    });
  };

  return <div className="text-format-toolbar">
    <button type="button" className="text-format-trigger" aria-label="Text formatting" title="Text formatting" aria-expanded={open} onClick={() => setOpen(current => !current)}><Type size={17}/></button>
    {open && <div className="text-format-menu" role="toolbar" aria-label="Text formatting options">
      <button type="button" onClick={event => apply('bold', event)} aria-label="Bold" title="Bold"><Bold size={16}/></button>
      <button type="button" onClick={event => apply('italic', event)} aria-label="Italic" title="Italic"><Italic size={16}/></button>
      <button type="button" onClick={event => apply('list', event)} aria-label="Numbered list" title="Numbered list"><ListOrdered size={17}/></button>
    </div>}
  </div>;
}
