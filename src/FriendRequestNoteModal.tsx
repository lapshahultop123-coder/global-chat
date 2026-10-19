import { useEffect, useRef, type KeyboardEvent } from 'react';
import { UserRoundPlus, X } from 'lucide-react';

type Props = {
  targetName: string;
  note: string;
  error?: string;
  busy?: boolean;
  idPrefix: string;
  onNoteChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
};

export default function FriendRequestNoteModal({ targetName, note, error = '', busy = false, idPrefix, onNoteChange, onSend, onClose }: Props) {
  const titleId = `${idPrefix}-title`;
  const noteId = `${idPrefix}-note`;
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !busy) { onClose(); return; }
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div className="feature-modal-backdrop friend-request-note-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialogRef} className="feature-modal friend-request-note-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={handleDialogKeyDown}>
      <header>
        <div>
          <b id={titleId}><UserRoundPlus size={18} aria-hidden="true"/> Add a note to your request</b>
          <small>Sending to {targetName} · optional · maximum 200 characters</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Close request note" disabled={busy}><X size={18}/></button>
      </header>
      <form onSubmit={event => { event.preventDefault(); if (!busy) onSend(); }}>
        <label htmlFor={noteId}>Note <span>(optional)</span></label>
        <textarea id={noteId} maxLength={200} rows={4} value={note} onChange={event => onNoteChange(event.target.value)} placeholder="Write a short note to introduce yourself" disabled={busy}/>
        <div className="friend-request-note-meta"><small>Keep it friendly and share only what you want.</small><output htmlFor={noteId} aria-live="polite">{note.length}/200</output></div>
        {error && <p className="feature-modal-error friend-request-note-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="friend-request-note-cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Sending request…' : 'Send request'}</button>
        </footer>
      </form>
    </section>
  </div>;
}
