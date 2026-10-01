import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'avatars');
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const palettes = [
  ['#111a45','#635bff','#41d9ff','#f7fbff'], ['#063a48','#04a6a6','#b2fff0','#f5fffd'],
  ['#251347','#805cff','#f7aeff','#fffaff'], ['#153a38','#44c4a1','#dcfff3','#f7fffb'],
  ['#21103c','#ef43df','#3de9ff','#fffaff'], ['#10203b','#438bff','#ffd369','#ffffff'],
  ['#133b65','#12a8c9','#8ce8ff','#f3fdff'], ['#46204c','#e16f9d','#ffd39a','#fff9f4'],
  ['#1b2c4b','#6f92ff','#b6f4ff','#f7faff'], ['#32204f','#b589ff','#ff8eab','#ffffff'],
];
const safe = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function art(id, letter, style) {
  const [dark, a, b, ink] = palettes[style];
  const gid = `g${id}`;
  const background = `<rect width="128" height="128" rx="30" fill="url(#${gid})"/>`;
  const motifs = [
    `<circle cx="103" cy="20" r="34" fill="${b}" opacity=".22"/><circle cx="18" cy="111" r="42" fill="${a}" opacity=".32"/><path d="M0 90 Q32 62 64 90 T128 90 V128 H0Z" fill="${b}" opacity=".12"/>`,
    `<path d="M0 79 Q24 57 48 79 T96 79 T144 79 V140 H0Z" fill="${b}" opacity=".34"/><path d="M0 96 Q24 74 48 96 T96 96 T144 96" fill="none" stroke="${ink}" stroke-opacity=".32" stroke-width="4"/><circle cx="98" cy="28" r="13" fill="${ink}" opacity=".62"/>`,
    `<circle cx="64" cy="64" r="48" fill="none" stroke="${b}" stroke-opacity=".5" stroke-width="2"/><ellipse cx="64" cy="64" rx="58" ry="21" fill="none" stroke="${ink}" stroke-opacity=".68" stroke-width="4" transform="rotate(-27 64 64)"/><circle cx="94" cy="42" r="5" fill="${ink}"/>`,
    `<circle cx="38" cy="38" r="29" fill="${ink}" opacity=".1"/><path d="M0 105L105 0h23v23L23 128H0Z" fill="${ink}" opacity=".11"/><rect x="13" y="13" width="102" height="102" rx="25" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width="2"/>`,
    `<circle cx="64" cy="64" r="49" fill="none" stroke="${b}" stroke-width="2" stroke-dasharray="2 7"/><path d="M64 10v9M64 109v9M10 64h9M109 64h9" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><circle cx="102" cy="27" r="5" fill="${b}"/>`,
    `<path d="M25 25h12v12H25zM91 25h12v12H91zM25 91h12v12H25zM91 91h12v12H91z" fill="${ink}" opacity=".7"/><path d="M0 64h18M110 64h18M64 0v18M64 110v18" stroke="${b}" stroke-width="5"/>`,
    `<path d="M0 87 C22 61 43 61 64 87s42 26 64 0v41H0Z" fill="${b}" opacity=".38"/><path d="M0 99 C22 73 43 73 64 99s42 26 64 0" fill="none" stroke="${ink}" stroke-opacity=".48" stroke-width="3"/><circle cx="100" cy="27" r="12" fill="${ink}" opacity=".52"/>`,
    `<path d="M64 13c16 0 29 13 29 29S80 69 64 69 35 58 35 42s13-29 29-29Z" fill="${b}" opacity=".18"/><path d="M64 82c17-20 38-13 38 5 0 15-17 26-38 34-21-8-38-19-38-34 0-18 21-25 38-5Z" fill="${b}" opacity=".24"/>`,
    `<circle cx="64" cy="64" r="52" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width="3"/><circle cx="64" cy="64" r="41" fill="none" stroke="${b}" stroke-opacity=".6" stroke-width="7" stroke-dasharray="170 90" transform="rotate(-30 64 64)"/><circle cx="64" cy="64" r="27" fill="${dark}" opacity=".3"/>`,
    `<path d="M0 0h64L0 64Zm128 0v64L64 0ZM0 128V64l64 64Zm128 0H64l64-64Z" fill="${b}" opacity=".16"/><path d="M0 64h128M64 0v128" stroke="${ink}" stroke-opacity=".23" stroke-width="2"/>`,
  ][style];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${safe(letter)}"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${a}"/></linearGradient><filter id="s${id}" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="3"/></filter></defs>${background}<g>${motifs}</g><text x="65" y="70" text-anchor="middle" dominant-baseline="central" font-family="Inter,Arial,sans-serif" font-size="72" font-weight="850" letter-spacing="-3" fill="${dark}" opacity=".5" transform="translate(0 3)">${safe(letter)}</text><text x="64" y="67" text-anchor="middle" dominant-baseline="central" font-family="Inter,Arial,sans-serif" font-size="72" font-weight="850" letter-spacing="-3" fill="${ink}" stroke="${dark}" stroke-opacity=".13" stroke-width="1">${safe(letter)}</text><rect x="1.5" y="1.5" width="125" height="125" rx="29" fill="none" stroke="${ink}" stroke-opacity=".25" stroke-width="3"/></svg>`;
}

fs.mkdirSync(out, { recursive: true });
for (let style = 0; style < palettes.length; style++) {
  for (let i = 0; i < letters.length; i++) {
    const id = style * 26 + i + 1;
    fs.writeFileSync(path.join(out, `avatar-${id}.svg`), art(id, letters[i], style), 'utf8');
  }
}
for (const file of fs.readdirSync(out)) {
  const match = /^avatar-(\d+)\.svg$/.exec(file);
  if (match && Number(match[1]) > 260) fs.unlinkSync(path.join(out, file));
}
