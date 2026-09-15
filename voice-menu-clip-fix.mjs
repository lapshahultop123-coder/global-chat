import fs from 'fs';

const cssPath = 'src/styles.css';
if (!fs.existsSync(cssPath)) {
  console.error('Run this from the GLOBAL CHAT project root.');
  process.exit(1);
}

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* Voice menu containment fix: allow menu to escape message paint containment */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.message-list{contain:layout}\n.message-row{content-visibility:visible;contain:layout style}\n.voice-bubble{overflow:visible}\n.voice-menu{position:absolute;z-index:9999;overflow:visible;max-height:none}\n`;
  fs.writeFileSync(cssPath, css);
}
console.log('Voice menu clipping fix applied.');
