import fs from 'node:fs';

const path = 'src/App.tsx';
let s = fs.readFileSync(path, 'utf8');

const start = s.indexOf('// 3) Lightweight click sound for voice play/pause and voice action/delete buttons.');
if (start < 0) {
  throw new Error('Existing voice click-sound block was not found.');
}

const endMarker = '\n}\n';
const end = s.indexOf(endMarker, start);
if (end < 0) {
  throw new Error('Could not find end of existing voice click-sound block.');
}
const blockEnd = end + endMarker.length;

const replacement = `// 3) Reliable UI click sound for voice controls.
// Uses Web Audio and runs directly from the user click event.
// Respects the GLOBAL CHAT Sound ON/OFF setting.
if (typeof window !== 'undefined') {
  let voiceUiAudioContext: AudioContext | null = null;

  const voiceUiClick = (frequency = 620, duration = 0.05) => {
    try {
      let soundOn = true;
      try {
        const raw = localStorage.getItem('global-chat-settings-v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.sound === false) soundOn = false;
        }
      } catch {}

      if (!soundOn) return;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      voiceUiAudioContext ??= new AudioContextCtor();
      if (voiceUiAudioContext.state === 'suspended') {
        void voiceUiAudioContext.resume();
      }

      const now = voiceUiAudioContext.currentTime;
      const osc = voiceUiAudioContext.createOscillator();
      const gain = voiceUiAudioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(voiceUiAudioContext.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  };

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button') as HTMLButtonElement | null;
    if (!button) return;

    // Microphone / recording controls.
    if (button.matches('.voice-btn')) {
      voiceUiClick(760, 0.055);
      return;
    }

    if (button.matches('.voice-cancel')) {
      voiceUiClick(430, 0.065);
      return;
    }

    if (button.matches('.voice-send')) {
      voiceUiClick(840, 0.055);
      return;
    }

    // Voice playback and options.
    if (button.matches('.voice-play-btn')) {
      voiceUiClick(700, 0.045);
      return;
    }

    if (button.matches('.voice-menu-btn')) {
      voiceUiClick(600, 0.045);
      return;
    }

    // Delete for me / Delete for everyone and Reply inside the voice menu.
    if (button.closest('.voice-menu')) {
      const text = (button.textContent || '').trim().toLowerCase();
      if (text.includes('delete for everyone')) {
        voiceUiClick(420, 0.07);
      } else if (text.includes('delete for me')) {
        voiceUiClick(500, 0.06);
      } else if (text.includes('reply')) {
        voiceUiClick(640, 0.045);
      }
    }
  }, true);
}
`;

s = s.slice(0, start) + replacement + s.slice(blockEnd);
fs.writeFileSync(path, s);
console.log('Voice mic/delete click sound fix applied.');
