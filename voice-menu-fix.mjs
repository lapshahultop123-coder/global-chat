import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'src', 'styles.css');
if (!fs.existsSync(cssPath)) throw new Error(`Not found: ${cssPath}`);
const css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* Voice menu click-through fix */';
if (css.includes(marker)) { console.log('Voice menu click-through fix already present.'); process.exit(0); }
const patch = `\n\n${marker}\n.message-list .message-row { position: relative; }\n.message-list .message-row:has(.voice-menu) { z-index: 10001 !important; }\n.message-list .message-row:has(.voice-menu) .voice-bubble { position: relative; z-index: 10002 !important; }\n.message-list .message-row:has(.voice-menu) .voice-menu { z-index: 10003 !important; pointer-events: auto !important; }\n.voice-menu button { position: relative; z-index: 10004 !important; pointer-events: auto !important; }\n`;
fs.writeFileSync(cssPath, css + patch, 'utf8');
console.log('Voice menu click-through fix applied to src/styles.css.');
