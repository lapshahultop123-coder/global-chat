import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type IntroRow = { user_id: string; profile_intro: string };

/** The RPC applies the viewer's privacy permissions before returning any intro text. */
export function useVisibleProfileIntros(userIds: Array<string | null | undefined>) {
  const key = useMemo(() => [...new Set(userIds.filter((id): id is string => Boolean(id)))].slice(0, 100).sort().join(','), [userIds.join(',')]);
  const [intros, setIntros] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    if (!key) { setIntros({}); return () => { active = false; }; }
    void supabase.rpc('get_visible_profile_intros', { p_user_ids: key.split(',') }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setIntros({}); return; }
      const next: Record<string, string> = {};
      ((data || []) as IntroRow[]).forEach(row => { if (row.profile_intro?.trim()) next[row.user_id] = row.profile_intro.trim(); });
      setIntros(next);
    });
    return () => { active = false; };
  }, [key]);
  return intros;
}
