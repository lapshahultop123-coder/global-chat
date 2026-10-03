import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

export default function PollComposer({ onClose, onCreate, busy = false, error = '' }: {
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
  busy?: boolean;
  error?: string;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const updateOption = (index: number, value: string) => setOptions(current => current.map((option, at) => at === index ? value : option));
  const cleanOptions = options.map(option => option.trim()).filter(Boolean);
  const valid = question.trim().length >= 3 && cleanOptions.length >= 2 && new Set(cleanOptions.map(option => option.toLowerCase())).size === cleanOptions.length;
  return <div className="feature-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="poll-create-title">
    <section className="feature-modal poll-create-modal">
      <header><div><b id="poll-create-title">Create a poll</b><small>Polls are visible to this chat and expire after 24 hours.</small></div><button type="button" onClick={onClose} aria-label="Close poll"><X size={19}/></button></header>
      <label>Question</label><input maxLength={180} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a question…" autoFocus/>
      <label>Options</label>{options.map((option, index) => <div className="poll-option-input" key={index}><input maxLength={100} value={option} onChange={event => updateOption(index, event.target.value)} placeholder={`Option ${index + 1}`}/>{options.length > 2&&<button type="button" onClick={() => setOptions(current => current.filter((_, at) => at !== index))} aria-label={`Remove option ${index + 1}`}><Trash2 size={15}/></button>}</div>)}
      {options.length < 6&&<button type="button" className="poll-add-option" onClick={() => setOptions(current => [...current, ''])}><Plus size={15}/> Add option</button>}
      {error&&<div className="feature-modal-error" role="alert">{error}</div>}
      <div className="feature-modal-actions"><button type="button" className="private-modal-cancel" onClick={onClose} disabled={busy}>CANCEL</button><button type="button" className="primary-btn" disabled={!valid||busy} onClick={() => onCreate(question.trim(), cleanOptions)}>{busy?'CREATING…':'CREATE POLL'}</button></div>
    </section>
  </div>;
}
