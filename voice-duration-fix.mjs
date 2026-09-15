import fs from 'node:fs';

const path = 'src/App.tsx';
let s = fs.readFileSync(path, 'utf8');

const marker = '/* GLOBAL CHAT voice duration live-time fix v1 */';
if (s.includes(marker)) {
  console.log('Voice duration live-time fix already present.');
  process.exit(0);
}

const stateNeedle = "const [playingVoiceId,setPlayingVoiceId]=useState<string|null>(null);";
if (!s.includes(stateNeedle)) throw new Error('Could not find playingVoiceId state in src/App.tsx.');
s = s.replace(stateNeedle, stateNeedle + " const [playingVoiceElapsed,setPlayingVoiceElapsed]=useState(0);");

const playbackNeedle = "const toggleVoicePlayback=(v:VoiceMessage)=>{if(playingVoiceId===v.id){voiceAudioRef.current?.pause();setPlayingVoiceId(null);return} if(voiceAudioRef.current){voiceAudioRef.current.pause();voiceAudioRef.current=null} const a=new Audio(v.audio_url);voiceAudioRef.current=a;setPlayingVoiceId(v.id);a.onended=()=>setPlayingVoiceId(null);a.onerror=()=>setPlayingVoiceId(null);void a.play().catch(()=>setPlayingVoiceId(null))};";
if (!s.includes(playbackNeedle)) throw new Error('Could not find toggleVoicePlayback in src/App.tsx.');
const playbackReplacement = `const toggleVoicePlayback=(v:VoiceMessage)=>{
    if(playingVoiceId===v.id){
      voiceAudioRef.current?.pause();
      setPlayingVoiceId(null);
      setPlayingVoiceElapsed(0);
      return;
    }
    if(voiceAudioRef.current){
      voiceAudioRef.current.pause();
      voiceAudioRef.current=null;
    }
    setPlayingVoiceElapsed(0);
    const a=new Audio(v.audio_url);
    voiceAudioRef.current=a;
    setPlayingVoiceId(v.id);
    a.ontimeupdate=()=>setPlayingVoiceElapsed(Math.max(0,a.currentTime));
    a.onloadedmetadata=()=>setPlayingVoiceElapsed(Math.max(0,a.currentTime));
    a.onended=()=>{setPlayingVoiceElapsed(0);setPlayingVoiceId(null)};
    a.onerror=()=>{setPlayingVoiceElapsed(0);setPlayingVoiceId(null)};
    void a.play().catch(()=>{setPlayingVoiceElapsed(0);setPlayingVoiceId(null)});
  };`;
s = s.replace(playbackNeedle, playbackReplacement);

const bubbleCallNeedle = "playing={playingVoiceId===item.data.id} onPlay={()=>toggleVoicePlayback(item.data)}";
if (!s.includes(bubbleCallNeedle)) throw new Error('Could not find VoiceBubble call in src/App.tsx.');
s = s.replace(bubbleCallNeedle, "playing={playingVoiceId===item.data.id} elapsedSeconds={playingVoiceId===item.data.id?playingVoiceElapsed:0} onPlay={()=>toggleVoicePlayback(item.data)}");

const bubbleSigNeedle = "function VoiceBubble({v,current,playing,onPlay,onDeleteForMe,onDeleteForEveryone,onReply,timeFormat,counts,mine,onToggleReaction}:{v:VoiceMessage;current:boolean;playing:boolean;onPlay:()=>void;";
if (!s.includes(bubbleSigNeedle)) throw new Error('Could not find VoiceBubble signature in src/App.tsx.');
s = s.replace(bubbleSigNeedle, "function VoiceBubble({v,current,playing,elapsedSeconds,onPlay,onDeleteForMe,onDeleteForEveryone,onReply,timeFormat,counts,mine,onToggleReaction}:{v:VoiceMessage;current:boolean;playing:boolean;elapsedSeconds:number;onPlay:()=>void;");

const durationNeedle = "const mins=Math.floor(v.duration_ms/60000);const secs=Math.floor(v.duration_ms/1000)%60;";
if (!s.includes(durationNeedle)) throw new Error('Could not find voice duration calculation in VoiceBubble.');
s = s.replace(durationNeedle, "const durationSeconds=playing?elapsedSeconds:Math.max(0,v.duration_ms/1000);const mins=Math.floor(durationSeconds/60);const secs=Math.floor(durationSeconds%60);");

s += `\n\n${marker}\n`;
fs.writeFileSync(path, s);
console.log('Voice duration live-time fix applied to src/App.tsx.');
