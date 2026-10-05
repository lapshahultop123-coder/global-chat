import { Bookmark, Check, Copy, Circle, Trash2, X } from 'lucide-react';

type BulkMessageActionsProps = {
  active: boolean;
  selectedCount: number;
  totalCount: number;
  canSave: boolean;
  busy?: boolean;
  status?: string;
  onStart: () => void;
  onSelectAll: () => void;
  onCopy: () => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
};

export function BulkMessageActions({ active, selectedCount, totalCount, canSave, busy = false, status = '', onSelectAll, onCopy, onSave, onDelete, onCancel }: BulkMessageActionsProps) {
  if (!active) return status ? <div className="bulk-message-actions-wrap"><small className="bulk-message-status" role="status">{status}</small></div> : null;

  return <div className="bulk-message-actions-wrap">
    <div className={`bulk-message-actions${active ? ' is-active' : ''}`} role="group" aria-label="Bulk message actions">
      <>
        <span className="bulk-message-count" aria-live="polite">{selectedCount} selected</span>
        <button type="button" onClick={onSelectAll} disabled={busy || totalCount === 0}>Select all ({totalCount})</button>
        <button type="button" onClick={onCopy} disabled={busy || selectedCount === 0}><Copy size={15}/> Copy</button>
        <button type="button" onClick={onSave} disabled={busy || !canSave}><Bookmark size={15}/> Save</button>
        <button type="button" className="bulk-message-delete" onClick={onDelete} disabled={busy || selectedCount === 0}><Trash2 size={15}/> Delete for me</button>
        <button type="button" className="bulk-message-cancel" onClick={onCancel} disabled={busy}><X size={15}/> Cancel</button>
      </>
      {busy && <span className="bulk-message-busy" role="status">Working…</span>}
    </div>
    {status && <small className="bulk-message-status" role="status">{status}</small>}
  </div>;
}

export function BulkMessageSelectButton({ active, selected, disabled = false, onToggle }: { active: boolean; selected: boolean; disabled?: boolean; onToggle: () => void }) {
  if (!active) return null;
  return <button type="button" className={`bulk-message-select${selected ? ' selected' : ''}`} disabled={disabled} onClick={onToggle} aria-label={selected ? 'Deselect message' : 'Select message'} aria-pressed={selected} title={selected ? 'Deselect message' : 'Select message'}>
    {selected ? <Check size={15}/> : <Circle size={15}/>}
    <span>{selected ? 'Selected' : 'Select'}</span>
  </button>;
}
