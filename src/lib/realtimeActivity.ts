export function updateRemoteActivity(
  activeUsers: Set<string>,
  timers: Map<string, number>,
  userId: string,
  active: boolean,
  timeoutMs: number,
  onChange: (userIds: string[]) => void,
) {
  const previous = timers.get(userId);
  if (previous !== undefined) window.clearTimeout(previous);

  if (active) activeUsers.add(userId);
  else activeUsers.delete(userId);
  onChange([...activeUsers]);

  if (active) {
    timers.set(userId, window.setTimeout(() => {
      timers.delete(userId);
      activeUsers.delete(userId);
      onChange([...activeUsers]);
    }, timeoutMs));
  } else {
    timers.delete(userId);
  }
}

export function clearRemoteActivity(
  activeUsers: Set<string>,
  timers: Map<string, number>,
  onChange: (userIds: string[]) => void,
) {
  timers.forEach(timer => window.clearTimeout(timer));
  timers.clear();
  activeUsers.clear();
  onChange([]);
}
