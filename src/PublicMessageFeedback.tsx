import { useEffect, useState } from 'react';
import { Check, CircleHelp, Clock3 } from 'lucide-react';
import { supabase } from './lib/supabase';

const tags = [['helpful', 'Helpful'], ['needs_answer', 'Needs answer'], ['outdated', 'Outdated']] as const;
type FeedbackRow = { user_id: string; feedback_tag: string };
type CacheEntry = { rows: FeedbackRow[]; expiresAt: number };
type Subscriber = (rows: FeedbackRow[]) => void;

// Each rendered message subscribes independently, but all visible messages are
// fetched in one batched request instead of producing one request per bubble.
const feedbackCache = new Map<string, CacheEntry>();
const pendingFeedback = new Map<string, Set<Subscriber>>();
const activeFeedback = new Map<string, Set<Subscriber>>();
const feedbackVersions = new Map<string, number>();
let flushTimer: number | undefined;
let refreshTimer: number | undefined;

function scheduleFlush() {
  if (flushTimer === undefined) flushTimer = window.setTimeout(() => void flushFeedback(), 0);
}

function cacheRows(messageId: string, rows: FeedbackRow[]) {
  feedbackCache.delete(messageId);
  feedbackCache.set(messageId, { rows, expiresAt: Date.now() + 15_000 });
  for (const [key, entry] of feedbackCache) {
    if (entry.expiresAt <= Date.now() || feedbackCache.size > 250) feedbackCache.delete(key);
  }
}

function subscribeToFeedback(messageId: string, subscriber: Subscriber) {
  const active = activeFeedback.get(messageId) || new Set<Subscriber>();
  active.add(subscriber);
  activeFeedback.set(messageId, active);
  if (refreshTimer === undefined) {
    refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      for (const [id, listeners] of activeFeedback) pendingFeedback.set(id, new Set(listeners));
      scheduleFlush();
    }, 15_000);
  }

  const cached = feedbackCache.get(messageId);
  let cachedTimer: number | undefined;
  if (cached && cached.expiresAt > Date.now()) cachedTimer = window.setTimeout(() => subscriber(cached.rows), 0);
  else {
    const subscribers = pendingFeedback.get(messageId) || new Set<Subscriber>();
    subscribers.add(subscriber);
    pendingFeedback.set(messageId, subscribers);
    scheduleFlush();
  }

  return () => {
    if (cachedTimer !== undefined) window.clearTimeout(cachedTimer);
    const activeSubscribers = activeFeedback.get(messageId);
    activeSubscribers?.delete(subscriber);
    if (activeSubscribers?.size === 0) activeFeedback.delete(messageId);
    const current = pendingFeedback.get(messageId);
    current?.delete(subscriber);
    if (current?.size === 0) pendingFeedback.delete(messageId);
    if (activeFeedback.size === 0 && refreshTimer !== undefined) {
      window.clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
  };
}

async function flushFeedback() {
  flushTimer = undefined;
  const batch = [...pendingFeedback.entries()];
  pendingFeedback.clear();
  for (let start = 0; start < batch.length; start += 100) {
    const entries = batch.slice(start, start + 100);
    const ids = entries.map(([id]) => id);
    const versions = new Map(ids.map(id => [id, feedbackVersions.get(id) || 0]));
    try {
      const { data, error } = await supabase.from('public_message_feedback')
        .select('message_id,user_id,feedback_tag').in('message_id', ids);
      const rows = (error ? [] : (data || [])) as (FeedbackRow & { message_id: string })[];
      for (const [id, subscribers] of entries) {
        const newer = (feedbackVersions.get(id) || 0) !== versions.get(id);
        const current = feedbackCache.get(id);
        const result = newer && current ? current.rows : rows.filter(row => row.message_id === id);
        if (!error && !newer) cacheRows(id, result);
        const currentSubscribers = activeFeedback.get(id);
        subscribers.forEach(subscriber => {
          if (currentSubscribers?.has(subscriber)) subscriber(result);
        });
      }
    } catch {
      entries.forEach(([id, subscribers]) => {
        const currentSubscribers = activeFeedback.get(id);
        subscribers.forEach(subscriber => {
          if (currentSubscribers?.has(subscriber)) subscriber([]);
        });
      });
    }
  }
}

export default function PublicMessageFeedback({ messageId, userId }: { messageId: string; userId: string }) {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => subscribeToFeedback(messageId, setRows), [messageId]);

  const toggle = async (tag: string) => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const { data, error: saveError } = await supabase.rpc('toggle_public_message_feedback', {
        p_message_id: messageId,
        p_feedback_tag: tag,
      });
      if (saveError) throw saveError;
      const next = data
        ? [...rows.filter(row => !(row.user_id === userId && row.feedback_tag === tag)), { user_id: userId, feedback_tag: tag }]
        : rows.filter(row => !(row.user_id === userId && row.feedback_tag === tag));
      feedbackVersions.set(messageId, (feedbackVersions.get(messageId) || 0) + 1);
      cacheRows(messageId, next);
      setRows(next);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return <div className="public-message-feedback" aria-label="Message feedback tags">
    {tags.map(([key, label]) => {
      const count = rows.filter(row => row.feedback_tag === key).length;
      const active = rows.some(row => row.user_id === userId && row.feedback_tag === key);
      const Icon = key === 'helpful' ? Check : key === 'needs_answer' ? CircleHelp : Clock3;
      return <button type="button" key={key} className={active ? 'active' : ''} aria-pressed={active} disabled={busy} onClick={() => void toggle(key)}>
        <Icon size={12}/><span>{label}</span>{count > 0 && <small>{count}</small>}
      </button>;
    })}
    {error && <small className="public-feedback-error" role="alert">Could not save feedback. Please try again.</small>}
  </div>;
}
