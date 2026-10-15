const moodPalettes = [
  { name: 'Blush', light: '#ffd7e8', mid: '#fb6c9d', deep: '#9b315e', ring: '#ffb7d2' },
  { name: 'Ocean', light: '#c9e8ff', mid: '#568bff', deep: '#293d8d', ring: '#91baff' },
  { name: 'Sunbeam', light: '#fff0b8', mid: '#e6b644', deep: '#72553e', ring: '#ffe08b' },
  { name: 'Mint', light: '#c7ffe8', mid: '#39dba7', deep: '#176f67', ring: '#82f2cf' },
  { name: 'Lilac', light: '#eadbff', mid: '#9e74ee', deep: '#493477', ring: '#c6aaff' },
  { name: 'Coral', light: '#ffe0ce', mid: '#ff8b70', deep: '#984a45', ring: '#ffc09e' },
  { name: 'Sky', light: '#d8f8ff', mid: '#45c9e6', deep: '#245878', ring: '#91ebf5' },
];

const moodExpressions = [
  '<circle cx="48" cy="59" r="3.5" fill="#202435"/><circle cx="80" cy="59" r="3.5" fill="#202435"/><path d="M51 70q13 13 26 0" fill="none" stroke="#202435" stroke-width="3.6" stroke-linecap="round"/>',
  '<path d="m43 54 8 2m26-2 8 2" stroke="#343246" stroke-width="2.5" stroke-linecap="round"/><circle cx="49" cy="62" r="3" fill="#202435"/><circle cx="79" cy="62" r="3" fill="#202435"/><path d="M55 77q9-8 18 0" fill="none" stroke="#343246" stroke-width="3" stroke-linecap="round"/><path d="M91 69c-5 7-4 11 0 11s5-4 0-11Z" fill="#bdefff" stroke="#fff" stroke-width="1.4"/>',
  '<path d="M42 61q7 7 14 0m16 0q7 7 14 0" fill="none" stroke="#242538" stroke-width="3.5" stroke-linecap="round"/><path d="M58 75h12" stroke="#343246" stroke-width="3" stroke-linecap="round"/>',
  '<path d="M42 61q7-8 14 0m16 0q7-8 14 0" fill="none" stroke="#242538" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="64" cy="76" rx="8" ry="7" fill="#793c59"/><ellipse cx="64" cy="78" rx="4.5" ry="2.5" fill="#ffb0c4"/>',
  '<path d="m43 51 8-3m26 3 8-3" stroke="#343246" stroke-width="2.3" stroke-linecap="round"/><circle cx="49" cy="60" r="4" fill="#202435"/><circle cx="79" cy="60" r="4" fill="#202435"/><circle cx="50" cy="59" r="1.2" fill="#fff"/><circle cx="80" cy="59" r="1.2" fill="#fff"/><circle cx="64" cy="76" r="5.5" fill="#793c59"/>',
];

export function renderMoodglowSvg(variant) {
  const palette = moodPalettes[variant % moodPalettes.length];
  const expression = Math.floor(variant / moodPalettes.length);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Moodglow ${palette.name} face ${variant + 1}"><title>Moodglow ${palette.name} face ${variant + 1}</title><desc>A softly glowing gradient orb with a distinct friendly face and polished rim.</desc><metadata>Original Moodglow vector artwork created for the Zynyro project.</metadata><defs><radialGradient id="orb-fill" cx="31%" cy="25%" r="78%"><stop stop-color="${palette.light}"/><stop offset=".42" stop-color="${palette.mid}"/><stop offset="1" stop-color="${palette.deep}"/></radialGradient><linearGradient id="orb-rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".88"/><stop offset=".54" stop-color="${palette.ring}" stop-opacity=".28"/><stop offset="1" stop-color="${palette.deep}" stop-opacity=".8"/></linearGradient><filter id="orb-shadow" x="-35%" y="-35%" width="170%" height="190%"><feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dy="4"/><feComponentTransfer><feFuncA type="linear" slope=".3"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><ellipse cx="64" cy="111" rx="31" ry="5" fill="${palette.deep}" opacity=".19"/><circle cx="64" cy="61" r="48" fill="url(#orb-fill)" stroke="${palette.deep}" stroke-opacity=".48" stroke-width="2.5" filter="url(#orb-shadow)"/><circle cx="64" cy="61" r="44.5" fill="none" stroke="url(#orb-rim)" stroke-width="3.5"/><path d="M31 43c5-18 20-27 37-25 9 1 17 5 23 12-15-7-29-7-42 0-7 4-12 8-18 13Z" fill="#fff" opacity=".28"/><ellipse cx="47" cy="72" rx="6" ry="3" fill="#ff9bac" opacity=".5"/><ellipse cx="81" cy="72" rx="6" ry="3" fill="#ff9bac" opacity=".5"/>${moodExpressions[expression]}<path d="M37 34c7-8 16-12 25-13" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/><circle cx="91" cy="42" r="2" fill="#fff" opacity=".9"/></svg>`;
}

const skinPalettes = [
  { skin: '#f9c9a8', blush: '#f5948b', background: '#eef0f2' },
  { skin: '#e6a782', blush: '#d88078', background: '#c9f8e8' },
  { skin: '#ffdbb8', blush: '#f3a39a', background: '#ffe0e5' },
  { skin: '#d68f69', blush: '#ba6e69', background: '#d4ffc1' },
  { skin: '#f0b895', blush: '#e58d82', background: '#dce6f7' },
  { skin: '#ac6d4c', blush: '#a55754', background: '#fff0c8' },
  { skin: '#754632', blush: '#8b4b50', background: '#e8ddff' },
];
const hairColors = ['#211a1a', '#3b241d', '#713c28', '#241d35', '#8b4d27', '#262f43', '#5a303d'];
const outfitColors = ['#5ecdb6', '#fac847', '#ec8baa', '#7688e8', '#f29a49'];

const hairBack = [
  '<path d="M31 64c-7-24 2-47 33-47s40 23 33 47v27H31Z"/>',
  '<path d="M31 58c-6-27 5-43 33-43s39 18 34 44l-4 43H34Z"/>',
  '<path d="M30 62c-7-28 7-45 34-45s41 20 34 48l-8 23H38Z"/>',
  '<path d="M31 61c-8-29 7-46 34-46 26 0 39 19 32 45l-2 35H33Z"/>',
  '<path d="M31 61c-8-28 5-45 33-45s41 18 33 46l-5 30H36Z"/>',
];
const hairFront = [
  '<path d="M33 52c-2-21 10-34 31-34 23 0 31 15 30 35-8-4-13-11-16-19-7 9-20 14-45 18Z"/>',
  '<path d="M34 51c-2-19 10-32 30-32 21 0 31 13 30 31-8-6-13-12-16-20-7 12-18 17-44 21Zm-1 7c-7 16-4 30 0 36l7 2V58Zm61-1c7 14 4 28 0 35l-7 2V56Z"/>',
  '<path d="M33 51c-1-20 11-33 31-33 22 0 32 14 31 35-8-2-13-9-16-17-7 9-21 14-46 15Z"/><circle cx="36" cy="36" r="9"/><circle cx="47" cy="24" r="10"/><circle cx="62" cy="19" r="10"/><circle cx="77" cy="23" r="10"/><circle cx="90" cy="34" r="9"/>',
  '<path d="M33 54c-1-23 11-36 32-36 22 0 32 14 30 35-8-1-15-7-20-16-7 10-19 16-42 17Z"/><path d="M84 32c15 3 17 14 10 27-7 12-19 15-25 20 6-15 8-30 15-47Z"/>',
  '<circle cx="38" cy="28" r="12"/><circle cx="90" cy="28" r="12"/><path d="M31 52c-2-22 11-35 33-35s35 14 33 37c-11-3-17-9-21-18-9 10-23 14-45 16Z"/>',
];
const mouthShapes = [
  '<path d="M57 75q7 7 14 0" fill="none" stroke="#6d3840" stroke-width="2.4" stroke-linecap="round"/>',
  '<path d="M55 73q9 12 18 0" fill="#b94b5c"/><path d="M59 77q5 4 10 0" fill="#fff0ec"/>',
  '<path d="M58 75q6 3 12 0" fill="none" stroke="#75433c" stroke-width="2.2" stroke-linecap="round"/>',
  '<path d="M56 74q8 9 16 0" fill="none" stroke="#703747" stroke-width="2.5" stroke-linecap="round"/><path d="M61 78q3 2 6 0" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  '<path d="M59 74q5-5 10 0-5 7-10 0Z" fill="#753c49"/><circle cx="64" cy="74" r="1.3" fill="#ffb1b9"/>',
];

function chibiAccessory(kind, color) {
  if (kind === 0) return '<path d="M45 38q7-7 14 0m10 0q7-7 14 0" fill="none" stroke="#fff4cf" stroke-width="2.3" stroke-linecap="round"/><circle cx="48" cy="38" r="1.7" fill="#f4c44d"/><circle cx="73" cy="38" r="1.7" fill="#f4c44d"/>';
  if (kind === 1) return '<path d="M35 45q29-18 58 0" fill="none" stroke="#fff0c5" stroke-width="3.5" stroke-linecap="round"/><circle cx="64" cy="34" r="3" fill="#fff7dc"/>';
  if (kind === 2) return '<g fill="none" stroke="#493f50" stroke-width="2"><circle cx="50" cy="60" r="8"/><circle cx="78" cy="60" r="8"/><path d="M58 60h12m-28 0-6-2m50 2 6-2"/></g>';
  if (kind === 3) return '<path d="M91 61q7 5 0 10" fill="none" stroke="#f8dd95" stroke-width="2.4"/><circle cx="91" cy="73" r="2.8" fill="#ffd86f"/>';
  return `<path d="M82 37l2.3 5.1 5.7.5-4.3 3.7 1.3 5.6-5-3-4.8 3 1.2-5.6-4.3-3.7 5.7-.5Z" fill="${color}" stroke="#fff5dc" stroke-width="1"/>`;
}

export function renderChibiPopSvg(variant) {
  const tone = variant % skinPalettes.length;
  const hairStyle = Math.floor(variant / skinPalettes.length);
  const palette = skinPalettes[tone];
  const hair = hairColors[(tone * 3 + hairStyle) % hairColors.length];
  const outfit = outfitColors[(hairStyle * 2 + tone) % outfitColors.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Chibi Pop character ${variant + 1}"><title>Chibi Pop character ${variant + 1}</title><desc>A friendly chibi portrait with an original hairstyle, warm expression, and colorful outfit.</desc><metadata>Original Chibi Pop vector artwork created for the Zynyro project.</metadata><defs><linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${outfit}"/><stop offset="1" stop-color="${hair}" stop-opacity=".62"/></linearGradient><linearGradient id="face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4e8" stop-opacity=".5"/><stop offset=".65" stop-color="${palette.skin}"/><stop offset="1" stop-color="${palette.skin}"/></linearGradient><filter id="portrait-shadow" x="-30%" y="-20%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="2"/><feComponentTransfer><feFuncA type="linear" slope=".22"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="64" cy="62" r="55" fill="${palette.background}"/><path d="M17 128c2-21 14-35 34-39l13-3 13 3c20 4 32 18 34 39Z" fill="url(#shirt)"/><path d="M53 83h22v18c-6 8-16 8-22 0Z" fill="${palette.skin}"/><path d="M50 94q14 11 28 0l-6 15H56Z" fill="#fff" opacity=".72"/><g fill="${hair}">${hairBack[hairStyle]}</g><ellipse cx="35" cy="62" rx="5" ry="8" fill="${palette.skin}"/><ellipse cx="93" cy="62" rx="5" ry="8" fill="${palette.skin}"/><path d="M64 27c-17 0-29 12-29 31v10c0 17 13 29 29 29s29-12 29-29V58C93 39 81 27 64 27Z" fill="url(#face)" stroke="${hair}" stroke-opacity=".2" stroke-width="1.5"/><g fill="${hair}">${hairFront[hairStyle]}</g><ellipse cx="48" cy="70" rx="6" ry="3.2" fill="${palette.blush}" opacity=".48"/><ellipse cx="80" cy="70" rx="6" ry="3.2" fill="${palette.blush}" opacity=".48"/><ellipse cx="50" cy="60" rx="4.3" ry="5.5" fill="#2b2631"/><ellipse cx="78" cy="60" rx="4.3" ry="5.5" fill="#2b2631"/><circle cx="51.2" cy="58.2" r="1.6" fill="#fff"/><circle cx="79.2" cy="58.2" r="1.6" fill="#fff"/><path d="M63 64q-3 4 1 5" fill="none" stroke="#bf846d" stroke-width="1.7" stroke-linecap="round"/>${mouthShapes[hairStyle]}${chibiAccessory(tone % 5, outfit)}<path d="M50 101q14 9 28 0l13 27H37Z" fill="url(#shirt)"/><path d="m53 100 11 12 11-12" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 116c7-9 14-13 22-15m54 15c-7-9-14-13-22-15" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="2"/><circle cx="29" cy="47" r="1.8" fill="#fff" opacity=".72"/><circle cx="99" cy="82" r="2" fill="#fff" opacity=".76"/></svg>`;
}
