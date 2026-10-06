import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Globe2, LoaderCircle, X } from 'lucide-react';
import { iso31661 } from 'iso-3166';
import { supabase } from './lib/supabase';

type CountryCount = { country: string; user_count: number };
type PublicMessage = { id: string; name: string; country: string; body: string; created_at: string };
const countryNames = new Map(iso31661.map(country => [country.alpha2, country.name]));
const hotspots: Record<string, [number, number]> = { US: [-98, 39], CA: [-106, 56], MX: [-102, 23], BR: [-52, -10], GB: [-3, 55], FR: [2, 46], DE: [10, 51], IN: [79, 22], JP: [138, 37], AU: [134, -25], ZA: [24, -29], NG: [8, 9], AE: [54, 24], SG: [104, 1], ID: [117, -2], NZ: [172, -41], RU: [90, 60], CN: [104, 35] };

export default function EarthPulseMap({ onClose }: { onClose: () => void }) {
  const [counts, setCounts] = useState<CountryCount[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const countByCountry = useMemo(() => new Map(counts.map(item => [item.country, Number(item.user_count)])), [counts]);
  const refreshCounts = async () => {
    const { data, error: queryError } = await supabase.rpc('get_public_country_activity');
    if (queryError) { setError(queryError.message); return; }
    setCounts((data || []) as CountryCount[]);
  };
  useEffect(() => { let live = true; void supabase.rpc('get_public_country_activity').then(({ data, error: queryError }) => { if (!live) return; if (queryError) setError(queryError.message); else setCounts((data || []) as CountryCount[]); setLoading(false); }); const timer = window.setInterval(() => { if (live) void refreshCounts(); }, 15000); return () => { live = false; window.clearInterval(timer); }; }, []);
  useEffect(() => { let live = true; if (!selected) { setMessages([]); return; } setLoading(true); void supabase.from('messages').select('id,name,country,body,created_at').eq('country', selected).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(40).then(({ data, error: queryError }) => { if (!live) return; if (queryError) setError(queryError.message); else { setError(''); setMessages((data || []) as PublicMessage[]); } setLoading(false); }); return () => { live = false; }; }, [selected]);
  return <div className="feature-modal-backdrop earth-pulse-backdrop" role="dialog" aria-modal="true" aria-labelledby="earth-pulse-title">
    <section className="feature-modal earth-pulse-modal">
      <header><div><b id="earth-pulse-title"><Globe2 size={19}/> EARTH PULSE MAP</b><small>Live public chat activity by profile country. No GPS is used.</small></div><button type="button" onClick={onClose} aria-label="Close Earth Pulse"><X size={19}/></button></header>
      <div className="earth-pulse-map"><img src="/world-countries.svg" alt="World countries map"/>{counts.filter(item => hotspots[item.country]).map(item => { const [longitude, latitude] = hotspots[item.country]; return <button type="button" key={item.country} title={`${countryNames.get(item.country) || item.country}: ${item.user_count} active users`} aria-label={`Open ${countryNames.get(item.country) || item.country}, ${item.user_count} active users`} style={{ left: `${(longitude + 180) / 360 * 100}%`, top: `${(90 - latitude) / 180 * 100}%` }} onClick={() => setSelected(item.country)}><i/><span>{item.user_count}</span></button>; })}</div>
      {error&&<div className="feature-modal-error" role="alert">Could not load some activity data: {error}</div>}
      {selected ? <><div className="earth-pulse-region-head"><button type="button" onClick={() => setSelected('')}><ArrowLeft size={15}/> Countries</button><b>{countryNames.get(selected) || selected}</b><span>{countByCountry.get(selected) || 0} active users</span></div><div className="earth-pulse-messages">{loading?<p><LoaderCircle className="spinning" size={18}/> Loading messages…</p>:messages.length?messages.map(message=><article key={message.id}><b>{message.name}</b><span>{message.body}</span><time>{new Date(message.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</time></article>):<p>No active public messages from this country.</p>}</div></> : <div className="earth-pulse-country-list"><h3>Countries with active users</h3>{loading&&counts.length===0?<p><LoaderCircle className="spinning" size={18}/> Loading activity…</p>:counts.length?counts.slice().sort((a,b)=>Number(b.user_count)-Number(a.user_count)).map(item=><button type="button" key={item.country} onClick={() => setSelected(item.country)}><span>{countryNames.get(item.country) || item.country}</span><b>{item.user_count}</b></button>):<p>No active public users right now.</p>}</div>}
      <small className="earth-pulse-note">Counts show distinct users with unexpired public messages, grouped by each user’s profile country. GPS is not used.</small>
    </section>
  </div>;
}
