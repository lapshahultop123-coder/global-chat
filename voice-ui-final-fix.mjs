import fs from 'fs';

const appPath = 'src/App.tsx';
const cssPath = 'src/styles.css';

if (!fs.existsSync(appPath) || !fs.existsSync(cssPath)) {
  console.error('Run this from the GLOBAL CHAT project root (the folder containing src/App.tsx).');
  process.exit(1);
}

let app = fs.readFileSync(appPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

const oldDelete = "const deleteVoiceForEveryone=async(v:VoiceMessage)=>{if(v.user_id!==authUserId)return;const {data,error}=await supabase.functions.invoke('delete-voice-for-everyone',{body:{voiceId:v.id}});";
const newDelete = "const deleteVoiceForEveryone=async(v:VoiceMessage)=>{if(v.user_id!==authUserId)return;const session=sessionRef.current;const {data,error}=await supabase.functions.invoke('delete-voice-for-everyone',{body:{voiceId:v.id,userId:authUserId},headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});";
if (app.includes(oldDelete)) app = app.replace(oldDelete, newDelete);
else if (!app.includes("body:{voiceId:v.id,userId:authUserId}")) console.warn('Delete function pattern was not found; review manually.');

const oldRecorder = `<div className="voice-rec-left"><span className="recording-dot"></span><strong>{String(Math.floor(recordingSeconds/60)).padStart(2,'0')}:{String(recordingSeconds%60).padStart(2,'0')}</strong><span>Recording…</span></div>`;
const newRecorder = `<div className="voice-rec-left"><span className="recording-dot"></span><strong>{String(Math.floor(recordingSeconds/60)).padStart(2,'0')}:{String(recordingSeconds%60).padStart(2,'0')}</strong><div className="recording-wave" aria-label="Recording"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
if (app.includes(oldRecorder)) app = app.replace(oldRecorder, newRecorder);
else if (!app.includes('className="recording-wave"')) console.warn('Recording UI pattern was not found; review manually.');

fs.writeFileSync(appPath, app);

const marker = '/* Voice UI final correction: unclipped menu + recording waveform */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.voice-bubble{overflow:visible}\n.voice-menu{z-index:1000;min-width:190px;max-width:min(290px,calc(100vw - 24px));overflow:visible}\n.voice-menu button{min-height:40px;white-space:nowrap}\n.voice-rec-left{gap:12px}\n.recording-wave{display:flex;align-items:center;gap:2px;height:34px;flex:1;min-width:90px;max-width:220px;overflow:hidden}\n.recording-wave i{width:3px;height:7px;border-radius:999px;background:color-mix(in srgb,var(--primary) 62%,#fff 18%);animation:recordingWave 620ms ease-in-out infinite alternate;transform-origin:center}\n.recording-wave i:nth-child(2n){animation-delay:-90ms}.recording-wave i:nth-child(3n){animation-delay:-180ms}.recording-wave i:nth-child(4n){animation-delay:-270ms}.recording-wave i:nth-child(5n){animation-delay:-360ms}\n@keyframes recordingWave{from{height:6px;opacity:.55}to{height:30px;opacity:1}}\n@media(max-width:520px){.voice-recorder{gap:8px;padding-left:10px}.recording-wave{min-width:72px;max-width:150px}.recording-wave i{width:2px}.voice-menu{right:4px;max-width:calc(100vw - 20px)}}\n@media(prefers-reduced-motion:reduce){.recording-wave i{animation:none;height:14px!important;opacity:.85}}\n`;
  fs.writeFileSync(cssPath, css);
}

console.log('Voice UI final fix applied.');
