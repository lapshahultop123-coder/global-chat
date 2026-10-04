export function chatDateKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'invalid';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function chatDateLabel(value: string, now = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (chatDateKey(value) === chatDateKey(today.toISOString())) return 'Today';
  if (chatDateKey(value) === chatDateKey(yesterday.toISOString())) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

export function MessageDateDivider({ timestamp }: { timestamp: string }) {
  return <div className="message-date-divider" role="separator"><span>{chatDateLabel(timestamp)}</span></div>;
}
