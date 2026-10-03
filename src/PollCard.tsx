import { Check, Vote } from 'lucide-react';

export type ChatPoll = { id: string; context: 'private' | 'friend'; room_id: string | null; created_by: string; recipient_id: string | null; question: string; options: string[]; created_at: string; expires_at: string; votes: { user_id: string; option_index: number }[] };

export default function PollCard({ poll, userId, onVote, busy = false }: { poll: ChatPoll; userId: string; onVote: (index: number) => void; busy?: boolean }) {
  const votes = poll.votes || [];
  const myVote = votes.find(vote => vote.user_id === userId)?.option_index;
  const total = votes.length;
  return <article className="chat-poll-card">
    <div className="chat-poll-heading"><Vote size={16}/><span>POLL</span><small>{new Date(poll.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} expiry</small></div>
    <h3>{poll.question}</h3>
    <div className="chat-poll-options">{(poll.options || []).map((option, index) => {
      const count = votes.filter(vote => vote.option_index === index).length;
      const percent = total ? Math.round(count / total * 100) : 0;
      return <button type="button" className={`chat-poll-option ${myVote === index ? 'selected' : ''}`} key={`${index}-${option}`} onClick={() => onVote(index)} disabled={busy||Date.now()>=new Date(poll.expires_at).getTime()} aria-pressed={myVote === index}>
        <span className="chat-poll-progress" style={{ width: `${percent}%` }}/><span className="chat-poll-option-label">{option}</span><b>{count}</b>{myVote === index&&<Check size={14}/>}
      </button>;
    })}</div>
    <small className="chat-poll-total">{total} {total === 1 ? 'vote' : 'votes'} · {myVote === undefined ? 'Choose an option to vote' : 'Your vote is recorded'}</small>
  </article>;
}
