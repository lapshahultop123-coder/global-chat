export default function EarthGlobe(){
  return <div className="empty-earth-globe" role="img" aria-label="A slowly rotating Earth with country borders">
    <svg viewBox="0 0 180 180" aria-hidden="true">
      <defs>
        <radialGradient id="earth-ocean" cx="30%" cy="25%" r="82%">
          <stop offset="0" stopColor="#40c9f5"/>
          <stop offset=".42" stopColor="#1264b5"/>
          <stop offset="1" stopColor="#06152f"/>
        </radialGradient>
        <radialGradient id="earth-shade" cx="28%" cy="22%" r="82%">
          <stop offset="0" stopColor="#e8fbff" stopOpacity=".2"/>
          <stop offset=".62" stopColor="#06142c" stopOpacity=".04"/>
          <stop offset="1" stopColor="#020713" stopOpacity=".78"/>
        </radialGradient>
        <linearGradient id="earth-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b6f4ff" stopOpacity=".9"/>
          <stop offset=".48" stopColor="#57d9ed" stopOpacity=".3"/>
          <stop offset="1" stopColor="#8875ff" stopOpacity=".7"/>
        </linearGradient>
        <clipPath id="earth-sphere-clip"><circle cx="90" cy="90" r="76"/></clipPath>
      </defs>
      <circle cx="90" cy="90" r="78" fill="#08162e" opacity=".55"/>
      <g clipPath="url(#earth-sphere-clip)">
        <circle cx="90" cy="90" r="76" fill="url(#earth-ocean)"/>
        <g className="earth-map-layer">
          <image href="/world-countries.svg" x="-360" y="0" width="360" height="180" preserveAspectRatio="none"/>
          <image href="/world-countries.svg" x="0" y="0" width="360" height="180" preserveAspectRatio="none"/>
          <image href="/world-countries.svg" x="360" y="0" width="360" height="180" preserveAspectRatio="none"/>
        </g>
        <circle cx="90" cy="90" r="76" fill="url(#earth-shade)"/>
        <path d="M16 90a74 74 0 0 0 148 0" fill="none" stroke="#c2f6ff" strokeOpacity=".14" strokeWidth="1"/>
      </g>
      <circle cx="90" cy="90" r="76" fill="none" stroke="url(#earth-rim)" strokeWidth="2"/>
      <path d="M33 43a70 70 0 0 1 39-25" fill="none" stroke="#e0fbff" strokeLinecap="round" strokeOpacity=".5" strokeWidth="2"/>
      <circle cx="31" cy="128" r="1.4" fill="#9aeaff" opacity=".8"/>
      <circle cx="151" cy="49" r="1.2" fill="#c3b5fd" opacity=".8"/>
    </svg>
  </div>;
}
