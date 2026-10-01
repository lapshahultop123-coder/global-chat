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
fs.mkdirSync(outputDir, { recursive: true });

const styleCatalog = [];
const seen = new Set();
let id = 0;
for (const item of definitions) {
  const name = item.name;
  const count = item.slug === 'initials' ? 26 : 8;
  const style = new Style(item.definition);
  styleCatalog.push({ name, slug: item.slug, count });
  let variant = 0;
  let attempt = 0;
  while (variant < count) {
    const seed = item.slug === 'initials' ? letters[variant] : `Zynyro ${name} avatar ${attempt + 1}`;
    const svg = new Avatar(style, { seed, size: 128 }).toString();
    const hash = createHash('sha256').update(svg).digest('hex');
    attempt++;
    if (seen.has(hash)) {
      if (attempt > 2000) throw new Error(`Could not create enough unique ${name} avatars.`);
      continue;
    }
    seen.add(hash);
    id++;
    fs.writeFileSync(path.join(outputDir, `avatar-${id}.svg`), svg, 'utf8');
    variant++;
  }
}

fs.writeFileSync(path.join(root, 'src', 'data', 'avatar-styles.json'), `${JSON.stringify(styleCatalog, null, 2)}\n`, 'utf8');
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
console.log(`Generated ${id} unique SVG avatars from ${definitions.length} styles (A–Z only in Initials).`);
