import fs from 'fs';

const appPath = 'src/App.tsx';
const cssPath = 'src/styles.css';

if (!fs.existsSync(appPath) || !fs.existsSync(cssPath)) {
  console.error('Run this from the GLOBAL CHAT project root.');
  process.exit(1);
}

let app = fs.readFileSync(appPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

// 1) Faster voice upload: 32 kbps -> 24 kbps Opus where the current recorder sets it.
if (app.includes('audioBitsPerSecond:32000')) {
  app = app.replace(/audioBitsPerSecond:32000/g, 'audioBitsPerSecond:24000');
} else if (app.includes('audioBitsPerSecond: 32000')) {
  app = app.replace(/audioBitsPerSecond:\s*32000/g, 'audioBitsPerSecond:24000');
}

// 2) Dynamic voice-menu placement.
// The first/top voice menu must open downward when there is not enough room above.
const jsMarker = '/* GLOBAL CHAT voice final polish runtime */';
if (!app.includes(jsMarker)) {
  app += `

${jsMarker}
if (typeof window !== 'undefined') {
  const placeVoiceMenus = () => {
    document.querySelectorAll<HTMLElement>('.voice-menu').forEach((menu) => {
      const rect = menu.getBoundingClientRect();
      const row = menu.closest('.message-row') as HTMLElement | null;
      const bubble = menu.closest('.voice-bubble') as HTMLElement | null;
      if (!row || !bubble) return;

      const topSpace = rect.top;
      const bottomSpace = window.innerHeight - rect.bottom;
      const needBelow = topSpace < 112 && bottomSpace > rect.height + 16;
      menu.classList.toggle('voice-menu-below', needBelow);
    });
  };

  const voiceMenuObserver = new MutationObserver(() => {
    requestAnimationFrame(placeVoiceMenus);
  });

  const startVoiceMenuObserver = () => {
    voiceMenuObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', placeVoiceMenus, { passive: true });
    window.addEventListener('scroll', placeVoiceMenus, { passive: true });
    requestAnimationFrame(placeVoiceMenus);
  };

  if (document.body) startVoiceMenuObserver();
  else window.addEventListener('DOMContentLoaded', startVoiceMenuObserver, { once: true });
}

// 3) Lightweight click sound for voice play/pause and voice action/delete buttons.
// Uses Web Audio, so no extra sound file is required.
if (typeof window !== 'undefined') {
  let voiceUiAudioContext: AudioContext | null = null;
  const voiceUiClick = (frequency = 620, duration = 0.045) => {
    try {
      voiceUiAudioContext ??= new AudioContext();
      if (voiceUiAudioContext.state === 'suspended') void voiceUiAudioContext.resume();
      const osc = voiceUiAudioContext.createOscillator();
      const gain = voiceUiAudioContext.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, voiceUiAudioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, voiceUiAudioContext.currentTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, voiceUiAudioContext.currentTime + duration);
      osc.connect(gain);
      gain.connect(voiceUiAudioContext.destination);
      osc.start();
      osc.stop(voiceUiAudioContext.currentTime + duration);
    } catch {}
  };

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button') as HTMLButtonElement | null;
    if (!button || !button.closest('.voice-bubble')) return;

    const text = (button.textContent || '').trim().toLowerCase();
    const isDelete = text.includes('delete');
    const isPlayPause = !!button.querySelector('svg') && !text && !!button.closest('.voice-bubble');
    if (isDelete) voiceUiClick(420, 0.06);
    else if (isPlayPause) voiceUiClick(700, 0.04);
  }, true);
}
`;
}

// 4) CSS for reliable menu placement and clean spacing.
const cssMarker = '/* GLOBAL CHAT voice final polish styles */';
if (!css.includes(cssMarker)) {
  css += `

${cssMarker}
.voice-menu.voice-menu-below{
  top:calc(100% + 8px)!important;
  bottom:auto!important;
}
.voice-menu:not(.voice-menu-below){
  max-height:min(260px,calc(100vh - 24px));
}
.voice-bubble,
.voice-bubble *{
  box-sizing:border-box;
}
.voice-menu{
  z-index:10000!important;
}
@media(max-width:520px){
  .voice-menu.voice-menu-below{
    right:0!important;
    left:auto!important;
  }
}
`;
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);
console.log('Voice final polish applied: smart replay menu + faster voice upload + voice UI click sounds.');
