export default function EarthGlobe(){
  return <div className="empty-earth-globe" role="img" aria-label="A slowly rotating Earth">
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
        <pattern id="earth-land-pattern" width="180" height="180" patternUnits="userSpaceOnUse">
          <g fill="#61dcae" stroke="#b7f5d5" strokeOpacity=".3" strokeWidth=".7">
            <path d="M16 43 23 33 35 29 44 34 53 33 61 42 57 50 49 54 46 63 38 68 34 78 26 73 23 64 16 61 12 52Z"/>
            <path d="m43 75 10 3 9 9 2 12-5 11-3 13-6 13-5-8-2-12-6-10 2-13-3-9Z"/>
            <path d="m72 41 7-7 8 2 3 7-5 5-8-1Z"/>
            <path d="m81 53 11-4 12 5 5 11-4 13-8 11-5 14-8-4-4-12-6-11 2-12Z"/>
            <path d="m91 37 11-8 19-3 19 6 17 7 8 8-7 9-13-2-9 8-11-3-8 8-8-5-7 4-5-11-9-5Z"/>
            <path d="m111 72 8 4 3 9-5 9-6-6-4-9Z"/>
            <path d="m136 101 10-5 12 4 5 8-8 8-13-2-8-6Z"/>
            <path d="M0 151 Q22 145 45 151 T90 151 T135 151 T180 151 V180 H0Z" opacity=".78"/>
          </g>
          <path d="M19 49q11-8 22 0m44 15q9-6 18 0m15-26q16-7 31 1" fill="none" stroke="#e0fff0" strokeOpacity=".2" strokeWidth="1"/>
        </pattern>
      </defs>
      <circle cx="90" cy="90" r="78" fill="#08162e" opacity=".55"/>
      <g clipPath="url(#earth-sphere-clip)">
        <circle cx="90" cy="90" r="76" fill="url(#earth-ocean)"/>
        <rect className="earth-map-layer" x="-180" y="0" width="540" height="180" fill="url(#earth-land-pattern)"/>
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
