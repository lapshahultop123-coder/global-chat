export default function EarthGlobe(){
  return <div className="empty-earth-globe" role="img" aria-label="A softly rotating Earth with country borders">
    <svg viewBox="0 0 180 180" aria-hidden="true">
      <defs>
        <radialGradient id="earth-ocean" cx="30%" cy="25%" r="82%">
          <stop offset="0" stopColor="#37b8dc"/>
          <stop offset=".38" stopColor="#1267a8"/>
          <stop offset=".76" stopColor="#0a3a70"/>
          <stop offset="1" stopColor="#06152b"/>
        </radialGradient>
        <radialGradient id="earth-shade" cx="28%" cy="22%" r="82%">
          <stop offset="0" stopColor="#e8fbff" stopOpacity=".17"/>
          <stop offset=".48" stopColor="#06142c" stopOpacity=".02"/>
          <stop offset="1" stopColor="#020713" stopOpacity=".72"/>
        </radialGradient>
        <linearGradient id="earth-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8f5f1" stopOpacity=".76"/>
          <stop offset=".42" stopColor="#57cfdf" stopOpacity=".4"/>
          <stop offset="1" stopColor="#7199d5" stopOpacity=".58"/>
        </linearGradient>
        <filter id="earth-atmosphere" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4"/>
        </filter>
        <clipPath id="earth-sphere-clip"><circle cx="90" cy="90" r="76"/></clipPath>
      </defs>
      <circle cx="90" cy="90" r="77.5" fill="none" stroke="#5cd5df" strokeOpacity=".23" strokeWidth="3.5" filter="url(#earth-atmosphere)"/>
      <circle cx="90" cy="90" r="76" fill="#06152b"/>
      <g clipPath="url(#earth-sphere-clip)">
        <circle cx="90" cy="90" r="76" fill="url(#earth-ocean)"/>
        <g className="earth-globe-grid" fill="none" aria-hidden="true">
          <ellipse cx="90" cy="90" rx="34" ry="75"/>
          <ellipse cx="90" cy="90" rx="59" ry="75"/>
          <path d="M15 90c36-10 114-10 150 0M21 62c38 12 100 12 138 0M21 118c38-12 100-12 138 0"/>
        </g>
        <g className="earth-map-layer">
          <image className="earth-globe-land" href="/world-countries.svg" x="-360" y="0" width="360" height="180" preserveAspectRatio="none"/>
          <image className="earth-globe-land" href="/world-countries.svg" x="0" y="0" width="360" height="180" preserveAspectRatio="none"/>
          <image className="earth-globe-land" href="/world-countries.svg" x="360" y="0" width="360" height="180" preserveAspectRatio="none"/>
        </g>
        <circle cx="90" cy="90" r="76" fill="url(#earth-shade)"/>
        <path d="M16 90a74 74 0 0 0 148 0" fill="none" stroke="#b4f0ee" strokeOpacity=".1" strokeWidth=".8"/>
      </g>
      <circle cx="90" cy="90" r="76" fill="none" stroke="url(#earth-rim)" strokeWidth="1.35"/>
      <path d="M34 44a70 70 0 0 1 37-25" fill="none" stroke="#e1fffb" strokeLinecap="round" strokeOpacity=".38" strokeWidth="1.35"/>
      <path d="M120 157a70 70 0 0 0 22-17" fill="none" stroke="#86c9ec" strokeLinecap="round" strokeOpacity=".24" strokeWidth="1"/>
    </svg>
  </div>;
}
