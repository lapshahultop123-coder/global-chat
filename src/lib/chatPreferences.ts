export type ChatListSort = 'recent' | 'name' | 'unread';
export type ChatScrollPoint = number;

function snoozeKey(userId: string) { return `global-chat-chat-snoozes-v1:${userId}`; }
function scrollKey(userId: string, chatId: string) { return `global-chat-scroll-position-v1:${userId}:${chatId}`; }

export function getChatSnoozeUntil(userId: string, chatId: string): number {
  try {
    const saved = JSON.parse(localStorage.getItem(snoozeKey(userId)) || '{}') as Record<string, number>;
    const until = Number(saved[chatId]) || 0;
    if (until && until <= Date.now()) {
      delete saved[chatId];
      localStorage.setItem(snoozeKey(userId), JSON.stringify(saved));
      return 0;
    }
    return until;
  } catch { return 0; }
}

export function setChatSnooze(userId: string, chatId: string, durationMs: number | null): number {
  if (!userId || !chatId) return 0;
  try {
    const saved = JSON.parse(localStorage.getItem(snoozeKey(userId)) || '{}') as Record<string, number>;
    const until = durationMs === null ? 0 : Date.now() + durationMs;
    if (until) saved[chatId] = until; else delete saved[chatId];
    localStorage.setItem(snoozeKey(userId), JSON.stringify(saved));
    return until;
  } catch { return 0; }
}

export function isChatSnoozed(userId: string, chatId: string): boolean {
  return getChatSnoozeUntil(userId, chatId) > Date.now();
}

export function readChatScrollPosition(userId: string, chatId: string): ChatScrollPoint | null {
  try {
    const value = Number(localStorage.getItem(scrollKey(userId, chatId)));
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch { return null; }
}

export function saveChatScrollPosition(userId: string, chatId: string, value: number) {
  if (!userId || !chatId || !Number.isFinite(value) || value < 0) return;
  try { localStorage.setItem(scrollKey(userId, chatId), String(Math.round(value))); } catch { /* storage may be unavailable */ }
}
