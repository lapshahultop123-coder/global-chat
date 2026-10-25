import { useEffect, useState } from 'react';
import { Globe2, LoaderCircle, X } from 'lucide-react';
import { iso31661 } from 'iso-3166';
import { supabase } from './lib/supabase';

type CountryCount = { country: string; user_count: number };
type PresenceMeta = { country?: unknown };
const countryNames = new Map(iso31661.map(country => [country.alpha2, country.name]));
const hotspots: Record<string, [number, number]> = { US: [-98, 39], CA: [-106, 56], MX: [-102, 23], BR: [-52, -10], GB: [-3, 55], FR: [2, 46], DE: [10, 51], IN: [79, 22], JP: [138, 37], AU: [134, -25], ZA: [24, -29], NG: [8, 9], AE: [54, 24], SG: [104, 1], ID: [117, -2], NZ: [172, -41], RU: [90, 60], CN: [104, 35] };

function countsFromPresence(state: Record<string, PresenceMeta[]>): CountryCount[] {
  const counts = new Map<string, number>();
  for (const metas of Object.values(state)) {
    const country = metas.map(meta => typeof meta?.country === 'string' ? meta.country.trim().toUpperCase() : '').find(code => countryNames.has(code));
    if (country) counts.set(country, (counts.get(country) || 0) + 1);
  }
  return [...counts.entries()].map(([country, user_count]) => ({ country, user_count })).sort((a,b) => b.user_count - a.user_count || (countryNames.get(a.country) || a.country).localeCompare(countryNames.get(b.country) || b.country));
}

export default function EarthPulseMap({ onClose }: { onClose: () => void }) {
  const [counts, setCounts] = useState<CountryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const onPresenceChange = () => {
      if (!live) return;
      const state = channel.presenceState() as Record<string, PresenceMeta[]>;
      setCounts(countsFromPresence(state));
      setError('');
      setLoading(false);
    };
    const channel = supabase.channel('global-chat', { config: { presence: { key: 'earth-pulse-' + crypto.randomUUID() } } })
      .on('presence', { event: 'sync' }, onPresenceChange)
      .on('presence', { event: 'join' }, onPresenceChange)
      .on('presence', { event: 'leave' }, onPresenceChange)
      .subscribe((status, subscribeError) => {
        if (!live) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError(subscribeError?.message || 'Could not connect to the online user list.');
          setLoading(false);
        }
      });
    return () => { live = false; void supabase.removeChannel(channel); };
  }, []);

  const totalOnline = counts.reduce((total,item) => total + item.user_count, 0);
  return <div className="feature-modal-backdrop earth-pulse-backdrop" role="dialog" aria-modal="true" aria-labelledby="earth-pulse-title">
    <section className="feature-modal earth-pulse-modal">
      <header><div><b id="earth-pulse-title"><Globe2 size={19}/> EARTH PULSE MAP</b><small>People online now, grouped by profile country. GPS is not used.</small></div><button type="button" onClick={onClose} aria-label="Close Earth Pulse"><X size={19}/></button></header>
      <div className="earth-pulse-map"><img src="/world-countries.svg" alt="World countries map"/>{counts.filter(item => hotspots[item.country]).map(item => { const [longitude, latitude] = hotspots[item.country]; const label = countryNames.get(item.country) || item.country; return <div className="earth-pulse-marker" key={item.country} title={label + ': ' + item.user_count + ' online'} aria-label={label + ': ' + item.user_count + ' online'} style={{ left: ((longitude + 180) / 360 * 100) + '%', top: ((90 - latitude) / 180 * 100) + '%' }}><i/><span>{item.user_count}</span></div>; })}</div>
      {error&&<div className="feature-modal-error" role="alert">{error}</div>}
      <div className="earth-pulse-country-list"><h3>Countries with people online <span>{totalOnline} total</span></h3>{loading&&counts.length===0?<p><LoaderCircle className="spinning" size={18}/> Checking who’s online…</p>:counts.length?counts.map(item=><div className="earth-pulse-country-card" key={item.country}><span>{countryNames.get(item.country) || item.country}</span><b><i aria-hidden="true"/>{item.user_count}</b></div>):<p>No users are online right now.</p>}</div>
      <small className="earth-pulse-note">Counts include distinct users connected to chat. Country is shown only when enabled in profile privacy settings.</small>
    </section>
  </div>;
}
