import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Avatar, Style } from '@dicebear/core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const stylesDir = path.dirname(require.resolve('@dicebear/styles/initials.json'));
const outputDir = path.join(root, 'public', 'avatars');
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pickerVariantCount = 35;
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
if (pickerSlugs.length !== 24 || !pickerSlugs.includes('initials')) throw new Error('Expected Initials plus the 23 selected avatar styles.');
const definitionBySlug = new Map(definitions.map(item => [item.slug, item]));
const selectedStyles = pickerSlugs.filter(slug => slug !== 'initials');
if (selectedStyles.length !== 23 || selectedStyles.some(slug => !definitionBySlug.has(slug))) {
  throw new Error('The selected avatar style list must contain 23 valid non-Initials styles.');
}

fs.mkdirSync(outputDir, { recursive: true });

const styleCatalog = [];
const seen = new Set();
let id = 0;
const writeUniqueAvatar = (style, seed, label) => {
  const svg = new Avatar(style, { seed, size: 128 }).toString();
  const hash = createHash('sha256').update(svg).digest('hex');
  if (seen.has(hash)) return false;
  seen.add(hash);
  id++;
  fs.writeFileSync(path.join(outputDir, `avatar-${id}.svg`), svg, 'utf8');
  if (label) label.id = id;
  return true;
};

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

// Keep the existing variants 9–20 at their original IDs before appending 21–35.
const extraAvatars = [];
const appendPickerVariants = (firstVariant, endVariant) => {
  for (const slug of selectedStyles) {
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
appendPickerVariants(8, 20);
if (id !== 782) throw new Error(`Expected the original 20-choice gallery to end at ID 782, found ${id}.`);
appendPickerVariants(20, pickerVariantCount);

if (extraAvatars.length !== 621 || id !== 1127) throw new Error(`Expected 621 new variants and 1127 total assets; got ${extraAvatars.length} and ${id}.`);

fs.writeFileSync(path.join(root, 'src', 'data', 'avatar-styles.json'), `${JSON.stringify(styleCatalog, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(root, 'src', 'data', 'avatar-extra.json'), `${JSON.stringify(extraAvatars, null, 2)}\n`, 'utf8');
const credits = [
  '# Avatar artwork credits',
  '',
  'Avatar SVGs in `public/avatars/` are generated locally with DiceBear styles. Each SVG embeds its style attribution metadata.',
  'DiceBear style definitions are individually licensed; see each license and source below.',
  '',
  '| Style | Creator | License | Source |',
  '| --- | --- | --- | --- |',
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
console.log(`Generated ${id} globally unique SVGs; ${extraAvatars.length} added across 23 styles, with 35 per style. Initials has A–Z only.`);
