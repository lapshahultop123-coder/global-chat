import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root,'src','App.tsx');
const cssPath = path.join(root,'src','styles.css');
const sendVoicePath = path.join(root,'supabase','functions','send-voice','index.ts');
const deleteVoicePath = path.join(root,'supabase','functions','delete-voice-for-everyone','index.ts');
const sendMessagePath = path.join(root,'supabase','functions','send-message','index.ts');
const migrationDir = path.join(root,'supabase','migrations');
const toggleVoiceDir = path.join(root,'supabase','functions','toggle-voice-reaction');

function read(p){ if(!fs.existsSync(p)) throw new Error(`Missing file: ${p}`); return fs.readFileSync(p,'utf8'); }
function write(p,s){ fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,s,'utf8'); }
function replaceOnce(s,re,repl,label){ const n=s.replace(re,repl); if(n===s) throw new Error(`Could not apply: ${label}`); return n; }

// 1) Fix the already-known delete-for-everyone RPC error handling.
let sv = read(sendVoicePath);
sv = sv.replace("const f=await req.formData(),audio=f.get('audio'),durationMs=Number(f.get('durationMs')||0);","const f=await req.formData(),audio=f.get('audio'),durationMs=Number(f.get('durationMs')||0),replyToVoiceId=String(f.get('replyToVoiceId')||'')||null;");
sv = sv.replace("p_audio_url:publicUrl,p_storage_path:path,p_duration_ms:durationMs,p_file_size:audio.size});","p_audio_url:publicUrl,p_storage_path:path,p_duration_ms:durationMs,p_file_size:audio.size,p_reply_to_voice_id:replyToVoiceId});");
write(sendVoicePath,sv);

let del = read(deleteVoicePath);
del = del.replace('const {data,rowError}=await admin.rpc','const {data,error:rowError}=await admin.rpc');
write(deleteVoicePath,del);

// 2) Add voice reply/reaction data types and state/UI wiring without replacing the whole app.
let app = read(appPath);
app = app.replace(
  "type ChatMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; body:string; created_at:string; expires_at:string; reply_to_id?:string|null; reply_to_preview?:string|null; reply_to_name?:string|null };\ntype VoiceMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; audio_url:string; storage_path:string; duration_ms:number; created_at:string; expires_at:string };",
  "type ChatMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; body:string; created_at:string; expires_at:string; reply_to_id?:string|null; reply_to_voice_id?:string|null; reply_to_preview?:string|null; reply_to_name?:string|null };\ntype VoiceMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; audio_url:string; storage_path:string; duration_ms:number; created_at:string; expires_at:string; reply_to_message_id?:string|null; reply_to_voice_id?:string|null; reply_to_preview?:string|null; reply_to_name?:string|null };",
  'voice types'
);
app = app.replace(
  "const [online,setOnline]=useState(0); const [reactionCounts,setReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [myReactions,setMyReactions]=useState<Record<string,string[]>>({});",
  "const [online,setOnline]=useState(0); const [reactionCounts,setReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [myReactions,setMyReactions]=useState<Record<string,string[]>>({}); const [voiceReactionCounts,setVoiceReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [voiceMyReactions,setVoiceMyReactions]=useState<Record<string,string[]>>({});",
  'voice reaction state'
);
app = app.replace(
  "const refreshReactions=useCallback(async(ids:string[],userId:string)=>{if(!ids.length)return;const {data}=await supabase.from('message_reactions').select('message_id,user_id,reaction').in('message_id',ids);const counts:Record<string,Record<string,number>>={};const mine:Record<string,string[]>={};(data||[]).forEach((r:any)=>{counts[r.message_id]??={};counts[r.message_id][r.reaction]=(counts[r.message_id][r.reaction]||0)+1;if(r.user_id===userId)(mine[r.message_id]??=[]).push(r.reaction)});setReactionCounts(counts);setMyReactions(mine)},[]);",
  "const refreshReactions=useCallback(async(ids:string[],userId:string)=>{if(!ids.length)return;const {data}=await supabase.from('message_reactions').select('message_id,user_id,reaction').in('message_id',ids);const counts:Record<string,Record<string,number>>={};const mine:Record<string,string[]>={};(data||[]).forEach((r:any)=>{counts[r.message_id]??={};counts[r.message_id][r.reaction]=(counts[r.message_id][r.reaction]||0)+1;if(r.user_id===userId)(mine[r.message_id]??=[]).push(r.reaction)});setReactionCounts(counts);setMyReactions(mine)},[]);\n  const refreshVoiceReactions=useCallback(async(ids:string[],userId:string)=>{if(!ids.length)return;const {data}=await supabase.from('voice_reactions').select('voice_id,user_id,reaction').in('voice_id',ids);const counts:Record<string,Record<string,number>>={};const mine:Record<string,string[]>={};(data||[]).forEach((r:any)=>{counts[r.voice_id]??={};counts[r.voice_id][r.reaction]=(counts[r.voice_id][r.reaction]||0)+1;if(r.user_id===userId)(mine[r.voice_id]??=[]).push(r.reaction)});setVoiceReactionCounts(counts);setVoiceMyReactions(mine)},[]);",
  'voice reaction refresh'
);
app = app.replace(
  "if(!vr.error&&vr.data)setVoiceMessages((vr.data as VoiceMessage[]).filter(v=>!voiceLocalDeleted[v.id]));},[localDeleted,voiceLocalDeleted]);",
  "if(!vr.error&&vr.data)setVoiceMessages((vr.data as VoiceMessage[]).filter(v=>!voiceLocalDeleted[v.id]));},[localDeleted,voiceLocalDeleted]);",
  'refresh unchanged'
);
app = app.replace(
  "const messageIds=useMemo(()=>messages.map(m=>m.id).join(','),[messages]);\n  useEffect(()=>{if(authUserId&&messageIds)refreshReactions(messageIds.split(',').filter(Boolean),authUserId)},[messageIds,authUserId,refreshReactions]);",
  "const messageIds=useMemo(()=>messages.map(m=>m.id).join(','),[messages]);\n  const voiceIds=useMemo(()=>voiceMessages.map(v=>v.id).join(','),[voiceMessages]);\n  useEffect(()=>{if(authUserId&&messageIds)refreshReactions(messageIds.split(',').filter(Boolean),authUserId)},[messageIds,authUserId,refreshReactions]);\n  useEffect(()=>{if(authUserId&&voiceIds)refreshVoiceReactions(voiceIds.split(',').filter(Boolean),authUserId)},[voiceIds,authUserId,refreshVoiceReactions]);",
  'voice reaction effects'
);
// Realtime voice reaction refresh.
app = replaceOnce(app,
  /\.on\('postgres_changes',\{event:'\*',schema:'public',table:'message_reactions'\},\(\)=>refreshReactions\(messageIdsRef\.current,selfId\)\)/,
  ".on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},()=>refreshReactions(messageIdsRef.current,selfId))\n        .on('postgres_changes',{event:'*',schema:'public',table:'voice_reactions'},()=>refreshVoiceReactions(voiceMessages.map(v=>v.id),selfId))",
  'voice reaction realtime'
);
// Mic: reuse one granted stream instead of requesting permission twice.
app = replaceOnce(app,
  /const requestMic=async\(\)=>\{.*?return false\}\};/,
  `const requestMic=async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone recording is not supported in this browser.');const stream=await navigator.mediaDevices.getUserMedia({audio:true});setMicPermission('granted');setMicNotice(false);return stream}catch(e:any){setMicPermission('denied');setMicNotice(true);setError(e?.name==='NotAllowedError'?'Microphone permission was denied. Please allow microphone access in your browser site settings.':(e?.message||'Microphone access is unavailable.'));return null}};`,
  'single mic permission request'
);
app = replaceOnce(app,
  /const startRecording=async\(\)=>\{.*?\n  const uploadVoice=/s,
  `const startRecording=async()=>{if(recording)return;if(!navigator.onLine){setError('You are offline. Please reconnect before recording.');return} const stream=await requestMic();if(!stream)return;try{const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x))||'';const recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:32000}:undefined);mediaRecorderRef.current=recorder;mediaChunksRef.current=[];recordingStartedRef.current=Date.now();setRecordingSeconds(0);setRecording(true);recorder.ondataavailable=e=>{if(e.data.size)mediaChunksRef.current.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(mediaChunksRef.current,{type:recorder.mimeType||'audio/webm'});const duration=Math.min(60000,Date.now()-recordingStartedRef.current);if(blob.size>350*1024){setError('Voice message is too large. Please record a shorter message.');return}if(duration<500){setError('Voice message is too short.');return}await uploadVoice(blob,duration)};recorder.start(250);recordingTimerRef.current=window.setInterval(()=>{const elapsed=Math.floor((Date.now()-recordingStartedRef.current)/1000);if(elapsed>=60){stopRecording();return}setRecordingSeconds(elapsed)},250)}catch{stream.getTracks().forEach(t=>t.stop());setRecording(false);setError('Could not start microphone recording. Please try again.')}};\n  const uploadVoice=`,
  'start recording'
);
// Upload voice accepts optional reply-to-voice id.
app = replaceOnce(app,
  /const uploadVoice=async\(blob:Blob,duration:number\)=>\{.*?\n  const cancelRecording=/s,
  `const uploadVoice=async(blob:Blob,duration:number,replyToVoiceId:string|null=null)=>{setError('');setSending(true);try{const ext=blob.type.includes('mp4')?'m4a':'webm';const file=new File([blob],\`voice.\${ext}\`,{type:blob.type||'audio/webm'});const form=new FormData();form.append('audio',file);form.append('durationMs',String(duration));if(replyToVoiceId)form.append('replyToVoiceId',replyToVoiceId);const {data,error}=await supabase.functions.invoke('send-voice',{body:form});if(error||data?.error)throw new Error(data?.error||'Unable to send voice message.');if(data?.message)setVoiceMessages(prev=>[...prev.filter(v=>v.id!==data.message.id),data.message as VoiceMessage].sort((a,b)=>a.created_at.localeCompare(b.created_at)));play('send')}catch(e:any){setError(e.message||'Unable to send voice message.')}finally{setSending(false)}};\n  const cancelRecording=`,
  'voice upload'
);
app = app.replace(
  "await uploadVoice(blob,duration)};recorder.start",
  "await uploadVoice(blob,duration,replyTarget?.reply_to_voice_id||null);setReplyTarget(null)};recorder.start"
);
// Add voice reply helper.
app = replaceOnce(app,
  "const beginReply=(m:ChatMessage)=>{if(m.id.startsWith('optimistic-'))return;setReplyTarget(m);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())};",
  "const beginReply=(m:ChatMessage)=>{if(m.id.startsWith('optimistic-'))return;setReplyTarget(m);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())};\n  const beginVoiceReply=(v:VoiceMessage)=>{const target:ChatMessage={id:`voice-reply-${v.id}`,user_id:v.user_id,name:v.name,country:v.country,subdivision:v.subdivision,avatar_id:v.avatar_id,body:'🎙️ Voice message',created_at:v.created_at,expires_at:v.expires_at,reply_to_voice_id:v.id};setReplyTarget(target);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())};",
  'voice reply helper'
);
// send(): include reply_to_voice_id.
app = app.replace(
  "reply_to_id:replyTarget?.id||null,reply_to_preview:replyTarget?.body||null,reply_to_name:replyTarget?.name||null",
  "reply_to_id:replyTarget?.reply_to_voice_id?null:replyTarget?.id||null,reply_to_voice_id:replyTarget?.reply_to_voice_id||null,reply_to_preview:replyTarget?.body||null,reply_to_name:replyTarget?.name||null"
);
app = app.replace(
  "replyToId:sentReply&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null",
  "replyToId:sentReply&&!sentReply.reply_to_voice_id&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,replyToVoiceId:sentReply?.reply_to_voice_id||null"
);
app = app.replace(
  "reply_to_id:sentReply&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,reply_to_preview:sentReply?.body||null",
  "reply_to_id:sentReply&&!sentReply.reply_to_voice_id&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,reply_to_voice_id:sentReply?.reply_to_voice_id||null,reply_to_preview:sentReply?.body||null"
);
// Voice delete-for-everyone: do not use local-delete, let realtime delete it; close playback too.
app = app.replace(
  "if(error||data?.error){setError(data?.error||'Could not delete this voice message.');return}deleteVoiceForMe(v)};",
  "if(error||data?.error){setError(data?.error||'Could not delete this voice message.');return}setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id));setVoiceLocalDeleted(prev=>{const next={...prev,[v.id]:Date.now()+3*60*1000};persistVoiceLocalDeleted(next);return next});if(playingVoiceId===v.id){voiceAudioRef.current?.pause();setPlayingVoiceId(null)}};"
);
// Voice JSX: replace component with reactions/reply/delete menu and visible timestamp.
const oldVoice = /function VoiceBubble\(\{v,current,playing,onPlay,onDeleteForMe,onDeleteForEveryone,timeFormat\}:\{.*?\n\nfunction SettingsPanel/s;
const newVoice = `function VoiceBubble({v,current,playing,onPlay,onDeleteForMe,onDeleteForEveryone,onReply,timeFormat,counts,mine,onToggleReaction}:{v:VoiceMessage;current:boolean;playing:boolean;onPlay:()=>void;onDeleteForMe:()=>void;onDeleteForEveryone:()=>void;onReply:()=>void;timeFormat:TimeFormat;counts:Record<string,number>;mine:string[];onToggleReaction:(r:string)=>Promise<void>}){const [menu,setMenu]=useState(false);const countryName=iso31661.find(c=>c.alpha2===v.country)?.name??v.country;const subdivisionName=iso31662.find(s=>s.code===v.subdivision)?.name??v.subdivision.split('-').pop()??v.subdivision;const mins=Math.floor(v.duration_ms/60000);const secs=Math.floor(v.duration_ms/1000)%60;return <article className={\`message-row voice-row \${current?'mine':''}\`}><div className="message-content"><div className="message-top"><div className="message-identity"><div className="message-avatar">{AVATARS.find(a=>a.id===v.avatar_id)?.emoji??'🌍'}</div><div><strong>{v.name}</strong><span>{flag(v.country)} {subdivisionName}, {countryName}</span></div></div></div>{v.reply_to_voice_id&&<button className="reply-preview voice-reply-preview" onClick={onReply}><ReplyIcon size={13}/><span><b>{v.reply_to_name||'User'}</b>{v.reply_to_preview||'🎙️ Voice message'}</span></button>}<div className={\`voice-bubble \${playing?'voice-playing':''}\`}><button className="voice-play-btn" onClick={onPlay} aria-label={playing?'Pause voice':'Play voice'}>{playing?<Pause size={17}/>:<Play size={17}/>}</button><div className="voice-wave" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{height:\`\${7+(i%7)*2}px\`}} className={playing?'active':''}></i>)}</div><span className="voice-duration">{mins}:{String(secs).padStart(2,'0')}</span><button className="voice-menu-btn" onClick={()=>setMenu(x=>!x)} aria-label="Voice message options"><span>⋮</span></button>{menu&&<div className="voice-menu"><button onClick={()=>{onReply();setMenu(false)}}><ReplyIcon size={14}/> Reply</button><button onClick={()=>{onDeleteForMe();setMenu(false)}}><Trash2 size={14}/> Delete for me</button>{current&&<button className="danger" onClick={()=>{onDeleteForEveryone();setMenu(false)}}><Trash2 size={14}/> Delete for everyone</button>}</div>}</div><time className="message-time voice-message-time">{formatMessageTime(v.created_at,timeFormat)}</time><div className="reaction-row voice-reactions">{REACTIONS.map(r=><button key={r} className={mine.includes(r)?'reacted':''} onClick={()=>onToggleReaction(r)}>{r}{counts[r]?<small>{counts[r]}</small>:null}</button>)}</div></div></article>}

function SettingsPanel`;
app = replaceOnce(app,oldVoice,newVoice,'voice bubble component');
// Update VoiceBubble invocation.
app = replaceOnce(app,
  /<VoiceBubble key=\{`voice-\$\{item\.data\.id\}`\} v=\{item\.data\} current=\{item\.data\.user_id===authUserId\} playing=\{playingVoiceId===item\.data\.id\} onPlay=\{\(\)=>toggleVoicePlayback\(item\.data\)\} onDeleteForMe=\{\(\)=>deleteVoiceForMe\(item\.data\)\} onDeleteForEveryone=\{\(\)=>void deleteVoiceForEveryone\(item\.data\)\} timeFormat=\{settings\.timeFormat\|\|'12h'\}/,
  `<VoiceBubble key={\`voice-\${item.data.id}\`} v={item.data} current={item.data.user_id===authUserId} playing={playingVoiceId===item.data.id} onPlay={()=>toggleVoicePlayback(item.data)} onDeleteForMe={()=>deleteVoiceForMe(item.data)} onDeleteForEveryone={()=>void deleteVoiceForEveryone(item.data)} onReply={()=>beginVoiceReply(item.data)} timeFormat={settings.timeFormat||'12h'} counts={voiceReactionCounts[item.data.id]||{}} mine={voiceMyReactions[item.data.id]||[]} onToggleReaction={async(r)=>{const {error}=await supabase.functions.invoke('toggle-voice-reaction',{body:{voiceId:item.data.id,reaction:r}});if(!error)refreshVoiceReactions(voiceMessages.map(v=>v.id),authUserId)}}/>`,
  'voice bubble invocation'
);
write(appPath,app);

// 3) Fix server-side send-message reply-to-voice support by passing the new RPC arg.
let sm=read(sendMessagePath);
sm=sm.replace("const {text,profile,replyToId}=await req.json();","const {text,profile,replyToId,replyToVoiceId}=await req.json();");
sm=sm.replace("p_reply_to_id:replyId});","p_reply_to_id:replyId,p_reply_to_voice_id:typeof replyToVoiceId==='string'&&replyToVoiceId?replyToVoiceId:null});");
sm=sm.replace("const map:any={rate_limited:","const map:any={rate_limited:");
write(sendMessagePath,sm);

// 4) New DB migration: voice reactions + voice reply metadata + secure RPCs.
const migration = `create extension if not exists pgcrypto;\n\nalter table public.voice_messages add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;\nalter table public.voice_messages add column if not exists reply_to_voice_id uuid references public.voice_messages(id) on delete set null;\nalter table public.voice_messages add column if not exists reply_to_preview text;\nalter table public.voice_messages add column if not exists reply_to_name text;\n\ncreate table if not exists public.voice_reactions (\n  voice_id uuid not null references public.voice_messages(id) on delete cascade,\n  user_id uuid not null references auth.users(id) on delete cascade,\n  reaction text not null check (reaction in ('👍','❤️','😂','😮','😢','😡','🎉','🙏')),\n  created_at timestamptz not null default now(),\n  primary key (voice_id,user_id,reaction)\n);\n\nalter table public.voice_reactions enable row level security;\ndrop policy if exists voice_reactions_select on public.voice_reactions;\ncreate policy voice_reactions_select on public.voice_reactions for select to authenticated using (true);\ngrant select on public.voice_reactions to authenticated;\ngrant select,insert,update,delete on public.voice_reactions to service_role;\n\ncreate or replace function public.toggle_voice_reaction(p_user_id uuid,p_voice_id uuid,p_reaction text)\nreturns boolean\nlanguage plpgsql\nsecurity definer\nset search_path=public\nas $$\ndeclare\n  existed boolean;\nbegin\n  if p_user_id is null then raise exception 'unauthorized'; end if;\n  if p_reaction not in ('👍','❤️','😂','😮','😢','😡','🎉','🙏') then raise exception 'invalid_reaction'; end if;\n  if not exists(select 1 from public.voice_messages where id=p_voice_id and expires_at>now()) then raise exception 'voice_not_found'; end if;\n  select exists(select 1 from public.voice_reactions where voice_id=p_voice_id and user_id=p_user_id and reaction=p_reaction) into existed;\n  if existed then\n    delete from public.voice_reactions where voice_id=p_voice_id and user_id=p_user_id and reaction=p_reaction;\n    return false;\n  end if;\n  insert into public.voice_reactions(voice_id,user_id,reaction) values(p_voice_id,p_user_id,p_reaction);\n  return true;\nend;\n$$;\nrevoke all on function public.toggle_voice_reaction(uuid,uuid,text) from public;\ngrant execute on function public.toggle_voice_reaction(uuid,uuid,text) to service_role;\n\ncreate or replace function public.accept_global_message(\n  p_user_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_body text,p_reply_to_id uuid,p_reply_to_voice_id uuid\n) returns public.messages\nlanguage plpgsql security definer set search_path=public\nas $$\ndeclare v public.messages;\nbegin\n  v:=public.accept_global_message(p_user_id,p_name,p_country,p_subdivision,p_avatar_id,p_body,p_reply_to_id);\n  if p_reply_to_voice_id is not null then\n    if not exists(select 1 from public.voice_messages where id=p_reply_to_voice_id and expires_at>now()) then raise exception 'reply_target_invalid'; end if;\n    update public.messages set reply_to_voice_id=p_reply_to_voice_id,reply_to_id=null,reply_to_preview='🎙️ Voice message',reply_to_name=(select name from public.voice_messages where id=p_reply_to_voice_id) where id=v.id returning * into v;\n  end if;\n  return v;\nend;\n$$;\nrevoke all on function public.accept_global_message(uuid,text,text,text,integer,text,uuid,uuid) from public;\ngrant execute on function public.accept_global_message(uuid,text,text,text,integer,text,uuid,uuid) to service_role;\n\ncreate or replace function public.accept_voice_message(\n  p_user_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_audio_url text,p_storage_path text,p_duration_ms integer,p_file_size integer,p_reply_to_voice_id uuid default null\n) returns public.voice_messages\nlanguage plpgsql security definer set search_path=public\nas $$\ndeclare v public.voice_messages; recent_count integer;\nbegin\n  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,190914));\n  select count(*) into recent_count from public.voice_messages where user_id=p_user_id and created_at>now()-interval '10 seconds';\n  if recent_count>=3 then raise exception 'rate_limited'; end if;\n  if char_length(trim(p_name)) not between 2 and 32 then raise exception 'invalid_name'; end if;\n  if p_avatar_id not between 1 and 100 then raise exception 'invalid_avatar'; end if;\n  if p_duration_ms<500 or p_duration_ms>60000 then raise exception 'duration_invalid'; end if;\n  if p_file_size<1 or p_file_size>358400 then raise exception 'file_too_large'; end if;\n  if p_reply_to_voice_id is not null and not exists(select 1 from public.voice_messages where id=p_reply_to_voice_id and expires_at>now()) then raise exception 'reply_target_invalid'; end if;\n  insert into public.voice_messages(user_id,name,country,subdivision,avatar_id,audio_url,storage_path,duration_ms,file_size,reply_to_voice_id,reply_to_preview,reply_to_name)\n  values(p_user_id,trim(p_name),p_country,p_subdivision,p_avatar_id,p_audio_url,p_storage_path,p_duration_ms,p_file_size,p_reply_to_voice_id,case when p_reply_to_voice_id is not null then '🎙️ Voice message' end,case when p_reply_to_voice_id is not null then (select name from public.voice_messages where id=p_reply_to_voice_id) end)\n  returning * into v;\n  return v;\nend;\n$$;\nrevoke all on function public.accept_voice_message(uuid,text,text,text,integer,text,text,integer,integer,uuid) from public;\ngrant execute on function public.accept_voice_message(uuid,text,text,text,integer,text,text,integer,integer,uuid) to service_role;\n`;
write(path.join(migrationDir,'20260915120000_voice_reactions_replies_accessibility.sql'),migration);

// 5) New voice-reaction Edge Function.
const toggleVoice = `import { createClient } from 'npm:@supabase/supabase-js@2';\nconst K=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!);\nconst admin=createClient(Deno.env.get('SUPABASE_URL')!,K.default,{auth:{persistSession:false,autoRefreshToken:false}});\nconst C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};\nconst json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...C,'Content-Type':'application/json'}});\nDeno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:C});try{if(req.method!=='POST')return json({error:'Method not allowed.'},405);const token=(req.headers.get('Authorization')||'').replace(/^Bearer\\s+/i,'');const {data:{user},error:u}=await admin.auth.getUser(token);if(u||!user?.is_anonymous)return json({error:'Session expired. Please re-enter the chat.'},401);const {voiceId,reaction}=await req.json();const {data,error}=await admin.rpc('toggle_voice_reaction',{p_user_id:user.id,p_voice_id:voiceId,p_reaction:reaction});if(error)return json({error:error.message==='invalid_reaction'?'Invalid reaction.':error.message==='voice_not_found'?'Voice message no longer exists.':'Could not update reaction.'},400);return json({reacted:data});}catch{return json({error:'Could not update reaction.'},500)}});\n`;
write(path.join(toggleVoiceDir,'index.ts'),toggleVoice);

// 6) CSS accessibility / voice controls.
let css=read(cssPath);
css += `\n/* Voice final UX/accessibility pass */\n.voice-message-time{display:block;margin-top:5px;font-size:.68rem;color:color-mix(in srgb,#fff 72%,var(--accent));opacity:.95}\n.voice-reactions{margin-top:6px}\n.voice-reactions button{display:inline-flex;align-items:center;gap:2px}\n.voice-reactions button small{font-size:10px}\n.voice-menu button{display:flex;align-items:center;gap:7px;white-space:nowrap}\n.voice-reply-preview{margin-bottom:5px}\n.voice-menu{min-width:185px}\n.bubble,.voice-bubble,.message-head strong,.message-head span,.message-time,.composer textarea,.composer-meta,.reply-composer,.delete-modal,.settings-panel{color-scheme:dark}\n/* Keep all theme text readable even when theme surfaces are bright or low-contrast. */\n.message-head strong,.top-brand b,.empty h2,.voice-duration,.voice-rec-left strong,.settings-panel,.settings-panel label{color:#f8fafc}\n.message-head span,.message-time,.voice-message-time,.composer-meta,.top-brand span,.brand p{color:rgba(226,232,240,.82)}\n.bubble{color:#f8fafc}\n.bubble span{color:#f8fafc}\n.voice-bubble{color:#f8fafc}\n.voice-menu{color:#f8fafc;background:color-mix(in srgb,var(--surface) 88%,#05070d)}\n@media(max-width:520px){.voice-menu{min-width:170px}.voice-message-time{font-size:.62rem}.voice-reactions button{min-height:27px;padding:3px 6px}}\n`;
write(cssPath,css);

console.log('Voice final fix applied. Files changed:');
for (const p of [appPath,cssPath,sendVoicePath,deleteVoicePath,sendMessagePath,path.join(migrationDir,'20260915120000_voice_reactions_replies_accessibility.sql'),path.join(toggleVoiceDir,'index.ts')]) console.log(' - '+path.relative(root,p));
