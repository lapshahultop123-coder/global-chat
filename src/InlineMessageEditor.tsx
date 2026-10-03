import { useState, type FormEvent } from 'react';

type Props = {
  value: string;
  onSave: (body: string) => Promise<boolean>;
  onCancel: () => void;
};

export default function InlineMessageEditor({ value, onSave, onCancel }: Props) {
  const [body, setBody] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const next = body.trim();
    if (!next || [...next].length > 550 || next === value || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      if (await onSave(next)) onCancel();
      else setSaveError('Could not save the edit. Please try again.');
    } catch {
      setSaveError('Could not save the edit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="message-edit-form" onSubmit={event => void save(event)}>
      <textarea
        autoFocus
        maxLength={550}
        value={body}
        onChange={event => setBody(event.target.value)}
        aria-label="Edit message"
      />
      {saveError && <small className="message-edit-error" role="alert">{saveError}</small>}
      <div className="message-edit-footer">
        <small>{[...body].length}/550 · You can edit for 5 minutes after sending.</small>
        <div>
          <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving || !body.trim() || body.trim() === value}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
