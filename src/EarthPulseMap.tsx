import { Globe2, X } from 'lucide-react';
import { iso31661 } from 'iso-3166';

type CountryCount = { country: string; user_count: number };
const countryNames = new Map(iso31661.map(country => [country.alpha2, country.name]));
const hotspots: Record<string, [number, number]> = { US: [-98, 39], CA: [-106, 56], MX: [-102, 23], BR: [-52, -10], GB: [-3, 55], FR: [2, 46], DE: [10, 51], IN: [79, 22], JP: [138, 37], AU: [134, -25], ZA: [24, -29], NG: [8, 9], AE: [54, 24], SG: [104, 1], ID: [117, -2], NZ: [172, -41], RU: [90, 60], CN: [104, 35] };

export default function EarthPulseMap({ counts, onlineCount, onClose }: { counts: CountryCount[]; onlineCount: number; onClose: () => void }) {
  return <div className="feature-modal-backdrop earth-pulse-backdrop" role="dialog" aria-modal="true" aria-labelledby="earth-pulse-title">
    <section className="feature-modal earth-pulse-modal">
      <header><div><b id="earth-pulse-title"><Globe2 size={19}/> EARTH PULSE MAP</b><small>People online now, grouped by profile country. GPS is not used.</small></div><button type="button" onClick={onClose} aria-label="Close Earth Pulse"><X size={19}/></button></header>
      <div className="earth-pulse-map"><img src="/world-countries.svg" alt="World countries map"/>{counts.filter(item => hotspots[item.country]).map(item => { const [longitude, latitude] = hotspots[item.country]; const label = countryNames.get(item.country) || item.country; return <div className="earth-pulse-marker" key={item.country} title={label + ': ' + item.user_count + ' online'} aria-label={label + ': ' + item.user_count + ' online'} style={{ left: ((longitude + 180) / 360 * 100) + '%', top: ((90 - latitude) / 180 * 100) + '%' }}><i/><span>{item.user_count}</span></div>; })}</div>
      <div className="earth-pulse-country-list"><h3>Countries with people online <span>{onlineCount} online</span></h3>{counts.length?counts.map(item=><div className="earth-pulse-country-card" key={item.country}><span>{countryNames.get(item.country) || item.country}</span><b><i aria-hidden="true"/>{item.user_count}</b></div>):onlineCount>0?<p>Online users have hidden their country.</p>:<p>No users are online right now.</p>}</div>
      <small className="earth-pulse-note">Only profile countries enabled in privacy settings are shown. GPS is never used.</small>
    </section>
  </div>;
}
