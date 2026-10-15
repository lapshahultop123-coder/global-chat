import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Avatar, Style } from '@dicebear/core';
import { renderChibiPopSvg, renderMoodglowSvg } from './custom-avatar-styles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const stylesDir = path.dirname(require.resolve('@dicebear/styles/initials.json'));
const outputDir = path.join(root, 'public', 'avatars');
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pickerVariantCount = 35;
const addedPickerStyles = ['clay', 'constellation', 'gaze', 'voxel-art', 'sprouts', 'voxel-bot', 'adventurer'];
const customPickerStyles = ['heartglass', 'moodglow'];
const legacyCustomStyles = ['chibi-pop'];
const pickerSlugs = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'avatar-picker-style-slugs.json'), 'utf8'));
const definitions = fs.readdirSync(stylesDir)
  .filter(file => file.endsWith('.json'))
  .map(file => {
    const slug = path.basename(file, '.min.json');
    const words = slug.split('-').map(word => word[0].toUpperCase() + word.slice(1));
    return { slug, name: words.join(' '), definition: JSON.parse(fs.readFileSync(path.join(stylesDir, file), 'utf8')) };
  })
  .filter(item => item.definition.meta?.source?.name && item.definition.meta?.license)
  .sort((a, b) => a.slug === 'initials' ? -1 : b.slug === 'initials' ? 1 : a.name.localeCompare(b.name));

if (definitions.length !== 61) throw new Error(`Expected 61 DiceBear styles, found ${definitions.length}.`);
if (pickerSlugs.length !== 34 || !pickerSlugs.includes('initials')) throw new Error('Expected Initials plus 33 illustrated avatar styles.');
const definitionBySlug = new Map(definitions.map(item => [item.slug, item]));
const selectedStyles = pickerSlugs.filter(slug => slug !== 'initials');
const selectedDiceBearStyles = selectedStyles.filter(slug => !customPickerStyles.includes(slug));
if (selectedStyles.length !== 33 || ['critters', ...addedPickerStyles, ...customPickerStyles].some(slug => !selectedStyles.includes(slug)) || legacyCustomStyles.some(slug => selectedStyles.includes(slug)) || selectedDiceBearStyles.some(slug => !definitionBySlug.has(slug))) {
  throw new Error('The selected avatar style list must contain 33 valid illustrated styles and exclude archived styles.');
}
const previouslySelectedStyles = selectedDiceBearStyles.filter(slug => slug !== 'critters' && !addedPickerStyles.includes(slug));

fs.mkdirSync(outputDir, { recursive: true });

const styleCatalog = [];
const seen = new Set();
let id = 0;
const writeUniqueSvg = (svg, label) => {
  const canonicalSvg = svg
    .replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // DiceBear adds this random suffix to SVG ids and also references the ids
    // inside url(#...) values. Normalize both forms so identical artwork is
    // rejected even when only generated clipPath/mask references differ.
    .replace(/-[0-9a-f]{8}\b/g, '-HASH');
  const hash = createHash('sha256').update(canonicalSvg).digest('hex');
  if (seen.has(hash)) return false;
  seen.add(hash);
  id++;
  fs.writeFileSync(path.join(outputDir, `avatar-${id}.svg`), svg, 'utf8');
  if (label) label.id = id;
  return true;
};
const writeUniqueAvatar = (style, seed, label) => writeUniqueSvg(new Avatar(style, { seed, size: 128 }).toString(), label);

const heartPalettes = [
  { name: 'Rose', light: '#fff1f6', mid: '#f17da5', deep: '#b52c62', accent: '#ffe0eb', glint: '#ffffff' },
  { name: 'Ruby', light: '#fff0ed', mid: '#ed756c', deep: '#a92338', accent: '#ffd6cc', glint: '#fffaf6' },
  { name: 'Honey', light: '#fff7d7', mid: '#f2ba4c', deep: '#b36b17', accent: '#ffe8a6', glint: '#fffdf0' },
  { name: 'Jade', light: '#eafff8', mid: '#62cdb2', deep: '#147c70', accent: '#b8f2dd', glint: '#f4fffc' },
  { name: 'Sapphire', light: '#edf6ff', mid: '#75a9e8', deep: '#315893', accent: '#c9e4ff', glint: '#ffffff' },
  { name: 'Lilac', light: '#fbf2ff', mid: '#c197ea', deep: '#7047a7', accent: '#ead3ff', glint: '#ffffff' },
  { name: 'Silver', light: '#f9fafc', mid: '#a6b0c0', deep: '#454e5d', accent: '#e5e9f0', glint: '#ffffff' },
];
const heartPaths = [
  'M64 109C54 100 14 74 14 44 14 26 26 14 44 14c9 0 16 5 20 14 4-9 11-14 20-14 18 0 30 12 30 30 0 30-40 56-50 65Z',
  'M64 111C53 100 10 74 10 43 10 23 25 12 43 12c10 0 17 6 21 17 4-11 11-17 21-17 18 0 33 11 33 31 0 31-43 57-54 68Z',
  'M64 113C53 101 18 72 18 43 18 24 31 14 45 14c9 0 15 6 19 15 4-9 10-15 19-15 14 0 27 10 27 29 0 29-35 58-46 70Z',
  'M64 110C55 100 12 76 14 43 15 26 27 15 44 15c10 0 16 7 20 18 4-11 11-19 22-19 17 0 29 12 28 30-1 30-39 56-50 66Z',
  'M64 108C52 99 11 76 11 46 11 28 23 16 42 16c11 0 18 6 22 17 4-11 11-17 22-17 19 0 31 12 31 30 0 30-41 53-53 62Z',
];
const heartStar = (x, y, size, color, opacity = 0.78) => `<path d="M${x} ${y-size} ${x+size*.28} ${y-size*.28} ${x+size} ${y} ${x+size*.28} ${y+size*.28} ${x} ${y+size} ${x-size*.28} ${y+size*.28} ${x-size} ${y} ${x-size*.28} ${y-size*.28}Z" fill="${color}" opacity="${opacity}"/>`;
const littleHeart = (x, y, scale, fill, stroke = '#fff') => `<path transform="translate(${x} ${y}) scale(${scale})" d="M0 7C0 2 4 0 8 5c4-5 8-3 8 2 0 6-8 12-8 12S0 13 0 7Z" fill="${fill}" stroke="${stroke}" stroke-opacity=".7" stroke-width="1.2"/>`;
const flowerMark = (x, y, radius, petal, center) => `<g transform="translate(${x} ${y})">${Array.from({length:6},(_,index)=>{const angle=index*Math.PI/3;return `<ellipse cx="${Math.cos(angle)*radius*.64}" cy="${Math.sin(angle)*radius*.64}" rx="${radius*.36}" ry="${radius*.56}" transform="rotate(${index*60} ${Math.cos(angle)*radius*.64} ${Math.sin(angle)*radius*.64})" fill="${petal}" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>`;}).join('')}<circle r="${radius*.3}" fill="${center}" stroke="#fff" stroke-opacity=".72" stroke-width="1"/></g>`;
const heartFinishNames = ['Marble Veil', 'Ribbon Swirl', 'Heart Cameo', 'Petal Glaze', 'Sugar Constellation', 'Caramel Drizzle', 'Prism Mosaic'];
const heartPattern = (family, layout, palette) => {
  if (family === 0) {
    const waves = [
      ['M16 42C31 18 44 66 61 43S91 23 112 43','M14 60C30 38 43 79 61 60S91 43 114 62','M24 80C39 62 48 89 65 79S88 69 104 82'],
      ['M13 48C30 61 39 20 57 39S84 72 113 45','M17 66C33 76 45 42 62 57S88 79 111 62','M28 84C40 90 49 67 64 73S87 88 100 79'],
      ['M18 34C32 53 47 20 63 40S91 57 111 32','M15 55C31 74 47 41 64 59S91 74 114 52','M24 76C39 90 50 63 65 78S87 91 103 72'],
      ['M17 44C31 28 42 62 59 48S87 26 111 48','M14 65C31 46 47 84 64 64S89 48 114 67','M25 83C40 70 51 93 66 82S89 73 103 87'],
      ['M18 40C33 16 46 56 63 37S91 25 110 42','M15 58C32 37 47 75 64 56S91 42 113 61','M24 79C40 59 51 91 66 76S88 68 104 82'],
    ][layout];
    return `<g fill="none" stroke-linecap="round"><path d="${waves[0]}" stroke="${palette.glint}" stroke-width="6" opacity=".78"/><path d="${waves[1]}" stroke="${palette.accent}" stroke-width="3.8" opacity=".94"/><path d="${waves[2]}" stroke="${palette.deep}" stroke-width="2.3" opacity=".43"/><path d="M33 30c10-8 17-8 26-5" stroke="#fff" stroke-width="1.7" opacity=".68"/></g>`;
  }
  if (family === 1) {
    const angles = [-42, -27, -12, 16, 34], gaps = [13, 16, 19, 14, 22], widths = [5, 7, 4, 6, 8];
    const stripeLines = Array.from({length:8},(_,index)=>`<path d="M${-12+index*gaps[layout]} 6v116"/>`).join('');
    return `<g transform="rotate(${angles[layout]} 64 62)" fill="none" stroke-linecap="round">${stripeLines.replaceAll('/>', ` stroke="${palette.glint}" stroke-width="${widths[layout]}" opacity=".82"/>`)}<path d="M${-5+layout*3} 8v110M${47+layout*2} 8v110" stroke="${palette.deep}" stroke-width="2" opacity=".4"/><path d="M8 49c17-12 30-12 46-3" stroke="${palette.accent}" stroke-width="2.2" opacity=".75"/></g>`;
  }
  if (family === 2) {
    const inlays = [
      [[51,42,.72],[65,57,.54],[51,72,.43]],
      [[44,49,.62],[65,41,.5],[68,67,.72]],
      [[57,40,.52],[43,59,.48],[68,57,.62],[56,75,.42]],
      [[45,42,.52],[67,49,.68],[49,70,.56],[73,74,.38]],
      [[52,47,.86],[39,70,.4],[75,70,.4]],
    ][layout];
    return `<g>${inlays.map(([x,y,size],index)=>littleHeart(x,y,size,index%2?palette.accent:palette.glint,palette.deep)).join('')}<path d="M28 53c6-9 11-12 17-13m39 34c5 0 10-3 15-9" fill="none" stroke="${palette.glint}" stroke-width="2" stroke-linecap="round" opacity=".7"/>${heartStar(91-layout*3,38+layout*2,2.8,palette.glint,.9)}</g>`;
  }
  if (family === 3) {
    const flowers = [
      [[43,48,7],[78,67,6]], [[76,45,8],[45,71,5]], [[51,40,5],[76,58,8],[48,78,4]], [[43,60,7],[71,42,5],[79,77,5]], [[62,48,9],[42,75,5],[82,72,4]],
    ][layout];
    return `<g>${flowers.map(([x,y,size],index)=>flowerMark(x,y,size,index%2?palette.glint:palette.accent,index%2?palette.deep:'#fff4be')).join('')}<path d="M31 82q12-9 18-5m25-34q8-8 15-4" fill="none" stroke="${palette.deep}" stroke-width="2" stroke-linecap="round" opacity=".42"/>${heartStar(93,55+layout*3,2.6,palette.glint,.9)}</g>`;
  }
  if (family === 4) {
    const dotSets = [
      [[34,43,2],[47,34,1.5],[82,39,2],[94,52,1.4],[38,62,1.7],[57,73,1.4],[80,79,2],[68,49,1.4],[91,68,1.6]],
      [[31,50,1.5],[43,68,2.2],[53,42,1.3],[71,34,1.8],[87,49,2.3],[97,70,1.5],[67,79,1.6],[46,84,1.3],[78,61,1.4]],
      [[34,39,2.2],[48,50,1.3],[62,35,1.5],[83,43,1.7],[95,59,2],[43,70,1.5],[59,81,2.2],[80,76,1.4],[69,58,1.5]],
      [[30,58,1.5],[42,40,1.8],[55,64,2.2],[72,39,1.4],[91,44,1.7],[84,61,1.3],[46,81,2],[66,85,1.5],[96,78,1.2]],
      [[36,46,1.4],[51,36,2],[66,46,1.3],[85,35,1.7],[95,55,1.4],[37,67,2],[56,77,1.6],[75,67,2.1],[89,84,1.5]],
    ][layout];
    return `<g>${dotSets.map(([x,y,size],index)=>`<circle cx="${x}" cy="${y}" r="${size*1.7}" fill="${index%2?palette.accent:palette.glint}" opacity=".84"/><circle cx="${x-.4}" cy="${y-.6}" r="${size*.6}" fill="#fff" opacity=".9"/>`).join('')}${heartStar(54+layout*4,53,4,palette.glint,.95)}${heartStar(76,82-layout*3,2.6,palette.accent,.92)}</g>`;
  }
  if (family === 5) {
    const drips = [
      'M19 47c12-12 19 12 31-1s19-11 29 1 19 12 31-1',
      'M17 54c9 10 20-16 31-4s19 17 31 1 20-9 33 2',
      'M18 45c12 14 21-5 32 3s15 19 28 8 19-11 32 0',
      'M19 59c12-19 21 8 32-2s20-13 30-1 19 10 30-4',
      'M20 48c10-8 18 4 28 1s18-14 29-4 19 15 31 3',
    ][layout];
    const second = [
      'M27 76c11-8 17 6 27 1s16-10 25-2 16 9 25 1',
      'M28 77c12 5 16-8 27-4s14 13 25 5 16-5 24 2',
      'M27 70c9 10 17-2 27 4s17 7 26-1 15-4 25 3',
      'M25 79c10-12 18 5 28 0s17-11 26-3 16 8 26-2',
      'M28 73c10-5 16 8 26 4s17-7 27-1 15 4 24-2',
    ][layout];
    return `<g fill="none" stroke-linecap="round"><path d="${drips}" stroke="${palette.glint}" stroke-width="6" opacity=".82"/><path d="${drips}" stroke="${palette.accent}" stroke-width="2.2" opacity=".92"/><path d="${second}" stroke="${palette.deep}" stroke-width="2.6" opacity=".42"/><path d="M33 32c7-5 12-6 19-5" stroke="#fff" stroke-width="2" opacity=".75"/></g>${heartStar(43+layout*7,87-layout*3,3,palette.glint,.85)}`;
  }
  const mosaics = [
    ['25,42 43,31 53,51 36,61','43,31 62,37 53,51','62,37 80,30 79,51 53,51','80,30 101,43 79,51','36,61 53,51 61,72 43,80','53,51 79,51 68,71 61,72','79,51 101,43 91,66 68,71','43,80 61,72 66,91 50,85','68,71 91,66 80,86 66,91'],
    ['31,43 48,34 58,52 39,60','48,34 68,31 70,49 58,52','68,31 92,38 82,55 70,49','31,43 39,60 47,76 28,69','58,52 70,49 67,70 47,76','82,55 96,51 90,73 67,70','47,76 67,70 64,93 50,86','67,70 90,73 78,89 64,93'],
    ['24,50 40,36 56,47 43,63','40,36 60,30 70,47 56,47','60,30 84,37 76,54 70,47','84,37 103,51 87,62 76,54','43,63 56,47 66,70 48,78','56,47 76,54 66,70','87,62 101,67 88,81 66,70','48,78 66,70 64,93 50,87','66,70 88,81 76,92 64,93'],
    ['30,39 49,32 53,50 37,57','49,32 67,39 63,53 53,50','67,39 90,32 82,52 63,53','90,32 102,49 82,52','37,57 53,50 62,68 43,75','53,50 63,53 79,66 62,68','82,52 102,49 90,68 79,66','43,75 62,68 66,91 47,84','79,66 90,68 80,89 66,91'],
    ['27,46 42,34 55,48 39,62','42,34 63,30 70,48 55,48','63,30 84,38 78,56 70,48','84,38 101,48 87,64 78,56','39,62 55,48 62,72 46,79','55,48 78,56 68,74 62,72','87,64 99,72 82,84 68,74','46,79 62,72 65,93 49,86','68,74 82,84 75,94 65,93'],
  ][layout];
  return `<g stroke="${palette.glint}" stroke-opacity=".72" stroke-width="1.5" stroke-linejoin="round">${mosaics.map((points,index)=>`<polygon points="${points}" fill="${index%3===0?palette.accent:index%3===1?palette.light:palette.mid}" fill-opacity="${index%2?.62:.82}"/>`).join('')}<path d="M31 34c8-7 16-9 24-8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".86"/></g>`;
};
const createHeartglassSvg = variant => {
  const layout = Math.floor(variant / 7), family = variant % 7;
  const palette = heartPalettes[(variant * 3 + layout * 2) % heartPalettes.length];
  const heartPath = heartPaths[layout];
  const patternMarkup = heartPattern(family, layout, palette);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Heartglass ${palette.name} ${heartFinishNames[family]} heart avatar ${variant+1}"><title>Heartglass ${palette.name} ${heartFinishNames[family]} heart avatar ${variant+1}</title><desc>A polished ${heartFinishNames[family].toLowerCase()} glass candy heart with a distinct silhouette, layered glaze, and hand-finished decoration.</desc><metadata>Original Heartglass vector artwork created for the Zynyro project.</metadata><defs><linearGradient id="heart-body" x1="18%" y1="8%" x2="86%" y2="92%"><stop stop-color="${palette.light}"/><stop offset=".34" stop-color="${palette.mid}"/><stop offset="1" stop-color="${palette.deep}"/></linearGradient><linearGradient id="heart-bevel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.glint}" stop-opacity=".86"/><stop offset=".48" stop-color="${palette.accent}" stop-opacity=".18"/><stop offset="1" stop-color="${palette.deep}" stop-opacity=".68"/></linearGradient><radialGradient id="heart-gloss" cx=".28" cy=".18" r=".8"><stop stop-color="#fff" stop-opacity=".58"/><stop offset=".42" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><filter id="heart-shadow" x="-35%" y="-35%" width="170%" height="190%"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dy="4"/><feComponentTransfer><feFuncA type="linear" slope=".3"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><clipPath id="heart-clip"><path d="${heartPath}"/></clipPath></defs><ellipse cx="64" cy="108" rx="36" ry="6" fill="${palette.deep}" opacity=".19"/><path d="${heartPath}" fill="url(#heart-body)" stroke="${palette.deep}" stroke-opacity=".5" stroke-width="2.4" filter="url(#heart-shadow)"/><g clip-path="url(#heart-clip)"><path d="${heartPath}" fill="url(#heart-gloss)"/>${patternMarkup}<path d="M23 42c1-15 10-23 24-23 8 0 13 3 17 10-10-4-17-2-24 3-6 5-10 10-17 10Z" fill="${palette.glint}" opacity=".5"/><path d="M25 47c0-11 7-18 16-21" fill="none" stroke="${palette.glint}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/></g><path d="${heartPath}" fill="none" stroke="url(#heart-bevel)" stroke-width="3.4" opacity=".9"/><path d="M92 25c7 3 11 9 11 17" fill="none" stroke="${palette.glint}" stroke-width="3" stroke-linecap="round" opacity=".84"/>${heartStar(101,50,3.4,palette.glint,.92)}</svg>`;
};
const customAvatarStyles = [
  { slug: 'heartglass', name: 'Heartglass', render: createHeartglassSvg },
  { slug: 'moodglow', name: 'Moodglow', render: renderMoodglowSvg },
  { slug: 'chibi-pop', name: 'Chibi Pop', render: renderChibiPopSvg },
];
if (customPickerStyles.length + legacyCustomStyles.length !== customAvatarStyles.length || [...customPickerStyles, ...legacyCustomStyles].some((slug, index) => slug !== customAvatarStyles[index].slug)) {
  throw new Error('The custom avatar renderer list must match selected and archived custom styles.');
}

// Keep the original 506 avatar IDs and seeds stable for existing profiles.
for (const item of definitions) {
  const style = new Style(item.definition);
  const count = item.slug === 'initials' ? 26 : 8;
  styleCatalog.push({ name: item.name, slug: item.slug, count });
  let variant = 0;
  let attempt = 0;
  while (variant < count) {
    const seed = item.slug === 'initials' ? letters[variant] : `Zynyro ${item.name} avatar ${attempt + 1}`;
    attempt++;
    if (!writeUniqueAvatar(style, seed)) {
      if (attempt > 2000) throw new Error(`Could not create enough unique ${item.name} avatars.`);
      continue;
    }
    variant++;
  }
}

if (id !== 506) throw new Error(`Expected the stable legacy gallery to end at ID 506, found ${id}.`);
styleCatalog.push(...customAvatarStyles.map(({ name, slug }) => ({ name, slug, count: 0 })));

// Keep the existing variants 9–20 at their original IDs before appending 21–35.
const extraAvatars = [];
const appendPickerVariants = (slugs, firstVariant, endVariant) => {
  for (const slug of slugs) {
    const item = definitionBySlug.get(slug);
    const style = new Style(item.definition);
    for (let variant = firstVariant; variant < endVariant; variant++) {
      let attempt = 0;
      while (true) {
        const record = { style: item.name, slug, variant };
        const seed = slug === 'initial-face'
          ? `${letters[(variant - 8) % letters.length]} Zynyro ${item.name} avatar ${variant + 1} unique attempt ${attempt + 1}`
          : `Zynyro ${item.name} avatar ${variant + 1} unique attempt ${attempt + 1}`;
        attempt++;
        if (writeUniqueAvatar(style, seed, record)) {
          extraAvatars.push({ id: record.id, src: `/avatars/avatar-${record.id}.svg`, style: record.style, slug: record.slug, variant: record.variant });
          break;
        }
        if (attempt > 2000) throw new Error(`Could not create ${pickerVariantCount} unique ${item.name} avatars.`);
      }
    }
  }
};
appendPickerVariants(previouslySelectedStyles, 8, 20);
if (id !== 782) throw new Error(`Expected the original 20-choice gallery to end at ID 782, found ${id}.`);
appendPickerVariants(previouslySelectedStyles, 20, pickerVariantCount);
if (id !== 1127) throw new Error(`Expected the original 23 styles to retain IDs through 1127, found ${id}.`);
appendPickerVariants(['critters'], 8, pickerVariantCount);
if (id !== 1154) throw new Error(`Expected Critters variants to retain IDs through 1154, found ${id}.`);
appendPickerVariants(addedPickerStyles, 8, pickerVariantCount);

for (const customStyle of customAvatarStyles) {
  for (let variant = 0; variant < pickerVariantCount; variant++) {
    const record = { style: customStyle.name, slug: customStyle.slug, variant };
    if (!writeUniqueSvg(customStyle.render(variant), record)) throw new Error(`${customStyle.name} avatar ${variant + 1} was not unique.`);
    extraAvatars.push({ id: record.id, src: `/avatars/avatar-${record.id}.svg`, style: record.style, slug: record.slug, variant: record.variant });
  }
}

if (extraAvatars.length !== 942 || id !== 1448) throw new Error(`Expected 942 picker variants and 1448 total assets; got ${extraAvatars.length} and ${id}.`);

fs.writeFileSync(path.join(root, 'src', 'data', 'avatar-styles.json'), `${JSON.stringify(styleCatalog, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(root, 'src', 'data', 'avatar-extra.json'), `${JSON.stringify(extraAvatars, null, 2)}\n`, 'utf8');
const credits = [
  '# Avatar artwork credits',
  '',
  'Avatar SVGs in `public/avatars/` are generated locally with DiceBear styles or original custom vector artwork. Each SVG embeds style attribution metadata.',
  'Chibi Pop is archived and hidden from the picker; its SVGs and IDs are retained so previously saved profiles keep working.',
  'DiceBear style definitions are individually licensed; see each license and source below.',
  '',
  '| Style | Creator | License | Source |',
  '| --- | --- | --- | --- |',
  ...customAvatarStyles.map(({ name }) => `| ${name} | Zynyro project | Original vector artwork | Created for Zynyro |`),
  ...definitions.map(({ definition }) => {
    const { source, creator, license } = definition.meta;
    return `| ${source.name} | [${creator.name}](${creator.url}) | [${license.name}](${license.url}) | [${source.name}](${source.url}) |`;
  }),
  '',
];
fs.writeFileSync(path.join(root, 'THIRD-PARTY-AVATAR-CREDITS.md'), credits.join('\n'), 'utf8');

for (const file of fs.readdirSync(outputDir)) {
  const match = /^avatar-(\d+)\.svg$/.exec(file);
  if (match && Number(match[1]) > id) fs.unlinkSync(path.join(outputDir, file));
}
console.log(`Generated ${id} globally unique SVGs; ${pickerSlugs.length - 1} illustrated picker styles have 35 avatars each (${26 + (pickerSlugs.length - 1) * pickerVariantCount} picker choices including A-Z Initials). Archived styles remain stored for existing profile compatibility.`);
