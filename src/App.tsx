import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { iso31661, iso31662 } from 'iso-3166';
import { ArrowDown, Check, ChevronDown, Copy, Gamepad2, Mic, MicOff, Pause, Play, Reply as ReplyIcon, Search, Send, Settings, Smile, Trash2, Volume2, Wifi, WifiOff, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AVATARS, REACTIONS, THEMES, TEXT_SIZES, type TextSize } from './data/catalog';

const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','👍','👎','👏','🙌','🙏','👋','💪','🔥','❤️','💯'];
import { validateMessage } from './lib/validation';
import './styles.css';

type Profile = { name:string; country:string; subdivision:string; avatarId:number; themeId:string; agreed:boolean };
type TimeFormat = '12h' | '24h';
type ChatMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; body:string; created_at:string; expires_at:string; reply_to_id?:string|null; reply_to_voice_id?:string|null; reply_to_preview?:string|null; reply_to_name?:string|null };
type VoiceMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; audio_url:string; storage_path:string; duration_ms:number; created_at:string; expires_at:string; reply_to_message_id?:string|null; reply_to_voice_id?:string|null; reply_to_preview?:string|null; reply_to_name?:string|null };
const VOICE_LOCAL_DELETED_KEY='global-chat-voice-local-deleted-v1';
const PROFILE_KEY='global-chat-profile-v1';
const SETTINGS_KEY='global-chat-settings-v1';
const LOCAL_DELETED_KEY='global-chat-local-deleted-v1';

function flag(code:string){return code.toUpperCase().replace(/./g,c=>String.fromCodePoint(c.charCodeAt(0)+127397));}
function readJSON<T>(key:string, fallback:T):T { try { const x=localStorage.getItem(key); return x ? JSON.parse(x) as T : fallback; } catch { return fallback; } }

export default function App(){
  const [profile,setProfile]=useState<Profile|null>(()=>readJSON<Profile|null>(PROFILE_KEY,null));
  const [settings,setSettings]=useState(()=>readJSON(SETTINGS_KEY,{textSize:'medium' as TextSize,sound:true,timeFormat:'12h' as TimeFormat}));
  const [authReady,setAuthReady]=useState(false); const [bootError,setBootError]=useState('');
  useEffect(()=>{ (async()=>{ try { const {data,error}=await supabase.auth.getSession(); if(error) throw error; if(!data.session){ const {error:signInError}=await supabase.auth.signInAnonymously(); if(signInError) throw signInError; } setAuthReady(true); } catch { setBootError('Unable to connect securely. Please refresh and try again.'); } })(); },[]);
  const saveProfile=(p:Profile)=>{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));setProfile(p)};
  if(!authReady) return <div className="boot"><img className="logo-orbit logo-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" /><h1>GLOBAL CHAT</h1><p>{bootError||'Connecting securely…'}</p>{bootError&&<button className="primary-btn boot-retry" onClick={()=>location.reload()}>TRY AGAIN</button>}</div>;
  return profile ? <Chat profile={profile} settings={settings} onSettings={setSettings} onProfile={saveProfile}/> : <ProfileSetup onEnter={saveProfile}/>;
}

function ProfileSetup({onEnter}:{onEnter:(p:Profile)=>void}){
  const [name,setName]=useState(''); const [country,setCountry]=useState(''); const [subdivision,setSubdivision]=useState(''); const [avatarId,setAvatarId]=useState(1); const [themeId,setThemeId]=useState('midnight'); const [agreed,setAgreed]=useState(false); const [countryQuery,setCountryQuery]=useState(''); const [subQuery,setSubQuery]=useState(''); const [countryOpen,setCountryOpen]=useState(false); const [subOpen,setSubOpen]=useState(false);
  useEffect(()=>{const t=THEMES.find(x=>x.id===themeId)||THEMES[0]; document.documentElement.style.setProperty('--bg',t.bg);document.documentElement.style.setProperty('--surface',t.surface);document.documentElement.style.setProperty('--primary',t.primary);document.documentElement.style.setProperty('--accent',t.accent);document.documentElement.dataset.theme=t.id;},[themeId]);
  const countries=useMemo(()=>iso31661.filter(c=>c.state==='assigned').sort((a,b)=>a.name.localeCompare(b.name)),[]);
  const subdivisions=useMemo(()=>iso31662.filter(s=>s.code.startsWith(country+'-')).sort((a,b)=>a.name.localeCompare(b.name)),[country]);
  const filteredCountries=useMemo(()=>countries.filter(c=>(c.name+' '+c.alpha2+' '+c.alpha3).toLowerCase().includes(countryQuery.toLowerCase())),[countries,countryQuery]);
  const filteredSubs=useMemo(()=>subdivisions.filter(s=>(s.name+' '+s.code).toLowerCase().includes(subQuery.toLowerCase())).slice(0,120),[subdivisions,subQuery]);
  const selectedCountry=countries.find(c=>c.alpha2===country); const selectedSub=subdivisions.find(s=>s.code===subdivision);
  const valid=name.trim().length>=2 && name.trim().length<=32 && !!selectedCountry && !!selectedSub && agreed;
  const enter=async()=>{if(!valid)return; const p={name:name.trim().replace(/\s+/g,' '),country,subdivision,avatarId,themeId,agreed}; try { const {error}=await supabase.functions.invoke('save-profile',{body:p}); if(error) throw error; onEnter(p); } catch { alert('We could not save your profile. Please check your connection and try again.'); }};
  return <div className="setup-page"><div className="setup-shell">
    <div className="brand"><img className="brand-mark brand-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" /><div><h1>GLOBAL CHAT</h1><p>Create Your Profile</p></div></div>
    <div className="setup-grid">
      <section className="card profile-card">
        <label>Name / Nickname</label><input maxLength={32} value={name} onChange={e=>setName(e.target.value)} placeholder="Enter a nickname…" autoComplete="nickname"/>
        <label>Country</label><div className="select-wrap" onClick={()=>setCountryOpen(true)}><input value={countryQuery || (selectedCountry ? `${flag(selectedCountry.alpha2)} ${selectedCountry.name} · ${selectedCountry.alpha2}`:'')} onFocus={()=>setCountryOpen(true)} onChange={e=>{setCountryQuery(e.target.value);setCountry('');setSubdivision('');setCountryOpen(true)}} placeholder="Search countries…"/><ChevronDown size={18}/></div>
        {countryOpen && <div className="option-list">{filteredCountries.map(c=><button key={c.alpha2} onClick={()=>{setCountry(c.alpha2);setCountryQuery('');setSubdivision('');setCountryOpen(false);setSubOpen(false)}}>{flag(c.alpha2)} {c.name}<span>{c.alpha2}</span></button>)}</div>}
        {selectedCountry && <div className="selected-chip">{flag(selectedCountry.alpha2)} {selectedCountry.name}<b>{selectedCountry.alpha2}</b><button onClick={()=>{setCountry('');setSubdivision('');setCountryOpen(false)}}><X size={14}/></button></div>}
        <label>State / Province / Region</label><div className="select-wrap" onClick={()=>{if(selectedCountry)setSubOpen(true)}}><input disabled={!selectedCountry} value={subQuery || (selectedSub ? `${selectedSub.name} · ${selectedSub.code}`:'')} onFocus={()=>selectedCountry&&setSubOpen(true)} onChange={e=>{setSubQuery(e.target.value);setSubdivision('');setSubOpen(true)}} placeholder={selectedCountry?'Search subdivisions…':'Select a country first'}/><ChevronDown size={18}/></div>
        {selectedCountry && subOpen && <div className="option-list">{filteredSubs.map(s=><button key={s.code} onClick={()=>{setSubdivision(s.code);setSubQuery('');setSubOpen(false)}}>{s.name}<span>{s.code}</span></button>)}</div>}
        {selectedSub && <div className="selected-chip">{selectedSub.name}<b>{selectedSub.code}</b><button onClick={()=>setSubdivision('')}><X size={14}/></button></div>}
        <label>Choose Your Avatar</label><div className="avatar-grid">{AVATARS.map(a=><button className={`avatar ${avatarId===a.id?'selected':''}`} key={a.id} onClick={()=>setAvatarId(a.id)} aria-label={`Avatar ${a.id}`}>{a.emoji}</button>)}</div>
      </section>
      <section className="card theme-card"><label>Choose Your Theme</label><div className="theme-grid">{THEMES.map(t=><button key={t.id} className={`theme-tile ${themeId===t.id?'selected':''}`} style={{background:t.bg,borderColor:t.primary}} onClick={()=>setThemeId(t.id)}><span style={{background:t.primary}}></span><strong>{t.name}</strong><small>Instant preview</small></button>)}</div>
        <div className="rules"><h3>📜 GLOBAL CHAT RULES</h3><ul><li>English only.</li><li>No bad words or offensive content.</li><li>Max 500 characters per message.</li><li>Max 3 messages every 10 seconds.</li><li>Be respectful. No spam.</li><li>Messages disappear after 5 minutes.</li><li>No photo or file uploads. Voice recording is allowed.</li><li>Enjoy the chat responsibly! 🌍</li></ul><label className="agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I agree to the rules</span></label></div>
        <button className="primary-btn" disabled={!valid} onClick={enter}>ENTER CHAT <span>→</span></button>
      </section>
    </div>
  </div></div>
}

function readVoiceLocalDeleted():Record<string,number>{const raw=readJSON<Record<string,number>>(VOICE_LOCAL_DELETED_KEY,{});const now=Date.now();const clean=Object.fromEntries(Object.entries(raw).filter(([,expires])=>expires>now));if(Object.keys(clean).length!==Object.keys(raw).length)try{localStorage.setItem(VOICE_LOCAL_DELETED_KEY,JSON.stringify(clean))}catch{}return clean}
function persistVoiceLocalDeleted(next:Record<string,number>){try{localStorage.setItem(VOICE_LOCAL_DELETED_KEY,JSON.stringify(next))}catch{}}

function readLocalDeleted():Record<string,number>{const raw=readJSON<Record<string,number>>(LOCAL_DELETED_KEY,{});const now=Date.now();const clean=Object.fromEntries(Object.entries(raw).filter(([,expires])=>expires>now));if(Object.keys(clean).length!==Object.keys(raw).length)try{localStorage.setItem(LOCAL_DELETED_KEY,JSON.stringify(clean))}catch{}return clean}
function localMessageKey(m:Pick<ChatMessage,'id'|'user_id'|'body'|'created_at'>){return m.id.startsWith('optimistic-')?`${m.user_id}|${m.created_at}|${m.body}`:m.id}
function canLocalDelete(m:ChatMessage){return new Date(m.expires_at).getTime()-Date.now()>0}

function Chat({profile,settings,onSettings,onProfile}:{profile:Profile;settings:{textSize:TextSize;sound:boolean;timeFormat?:TimeFormat};onSettings:(x:any)=>void;onProfile:(x:Profile)=>void}){
  const [messages,setMessages]=useState<ChatMessage[]>([]); const [voiceMessages,setVoiceMessages]=useState<VoiceMessage[]>([]); const [voiceLocalDeleted,setVoiceLocalDeleted]=useState<Record<string,number>>(()=>readVoiceLocalDeleted()); const [recording,setRecording]=useState(false); const [recordingSeconds,setRecordingSeconds]=useState(0); const [micPermission,setMicPermission]=useState<'unknown'|'prompt'|'granted'|'denied'>('unknown'); const [micNotice,setMicNotice]=useState(false); const mediaRecorderRef=useRef<MediaRecorder|null>(null); const mediaChunksRef=useRef<Blob[]>([]); const recordingTimerRef=useRef<number|undefined>(undefined); const recordingStartedRef=useRef<number>(0); const [localDeleted,setLocalDeleted]=useState<Record<string,number>>(()=>readLocalDeleted()); const messagesRef=useRef<ChatMessage[]>([]); const messageIdsRef=useRef<string[]>([]); const [online,setOnline]=useState(0); const [reactionCounts,setReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [myReactions,setMyReactions]=useState<Record<string,string[]>>({}); const [voiceReactionCounts,setVoiceReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [voiceMyReactions,setVoiceMyReactions]=useState<Record<string,string[]>>({}); const [authUserId,setAuthUserId]=useState(''); const [text,setText]=useState(''); const [error,setError]=useState(''); const [settingsOpen,setSettingsOpen]=useState(false); const [clearConfirmOpen,setClearConfirmOpen]=useState(false); const [deleteConfirmMessage,setDeleteConfirmMessage]=useState<ChatMessage|null>(null); const [deletingForEveryone,setDeletingForEveryone]=useState(false); const [emojiOpen,setEmojiOpen]=useState(false); const [connected,setConnected]=useState(false); const [connectionState,setConnectionState]=useState<'connected'|'reconnecting'|'offline'>('reconnecting'); const [sending,setSending]=useState(false); const [typingUsers,setTypingUsers]=useState<string[]>([]); const [showJump,setShowJump]=useState(false); const [replyTarget,setReplyTarget]=useState<ChatMessage|null>(null); const [offlineGameOpen,setOfflineGameOpen]=useState(false); const [searchOpen,setSearchOpen]=useState(false); const [searchQuery,setSearchQuery]=useState(''); const [newMessageCount,setNewMessageCount]=useState(0); const [highlightedMessageId,setHighlightedMessageId]=useState<string|null>(null); const [copiedId,setCopiedId]=useState<string|null>(null); const [playingVoiceId,setPlayingVoiceId]=useState<string|null>(null); const [playingVoiceElapsed,setPlayingVoiceElapsed]=useState(0); const voiceAudioRef=useRef<HTMLAudioElement|null>(null); const typingStopRef=useRef<number|undefined>(undefined); const replyMetaRef=useRef<Record<string,{replyToId:string;replyToPreview:string;replyToName:string}>>({}); const channelRef=useRef<any>(null); const listRef=useRef<HTMLDivElement>(null); const audioRef=useRef<{send:HTMLAudioElement;receive:HTMLAudioElement}|null>(null); const sessionRef=useRef<any>(null); const pendingRef=useRef<Record<string,{tempId:string;body:string;createdAt:string}>>({}); const sendLockRef=useRef(false);
  const theme=THEMES.find(t=>t.id===profile.themeId) ?? THEMES[0];
  useEffect(()=>{document.documentElement.style.setProperty('--bg',theme.bg);document.documentElement.style.setProperty('--surface',theme.surface);document.documentElement.style.setProperty('--primary',theme.primary);document.documentElement.style.setProperty('--accent',theme.accent);document.documentElement.style.setProperty('--font-size',`${TEXT_SIZES[settings.textSize]}px`);document.documentElement.dataset.theme=theme.id;},[theme,settings.textSize]);
  const isNearBottom=useCallback(()=>{const el=listRef.current;if(!el)return true;return el.scrollHeight-el.scrollTop-el.clientHeight<120},[]);
  const copyMessage=useCallback(async(m:ChatMessage)=>{try{await navigator.clipboard.writeText(m.body);setCopiedId(m.id);window.setTimeout(()=>setCopiedId(id=>id===m.id?null:id),1200)}catch{}},[]);
  const activeSearch=searchQuery.trim().toLowerCase();
  const displayedMessages=useMemo(()=>activeSearch?messages.filter(m=>`${m.name} ${m.body} ${m.country} ${m.subdivision}`.toLowerCase().includes(activeSearch)):messages,[messages,activeSearch]);
  useEffect(()=>{if(!searchOpen)setSearchQuery('')},[searchOpen]);
  useEffect(()=>{if(highlightedMessageId){const t=window.setTimeout(()=>setHighlightedMessageId(null),1500);return()=>window.clearTimeout(t)}},[highlightedMessageId]);

  useEffect(()=>{const vv=window.visualViewport;if(!vv)return;const apply=()=>document.documentElement.style.setProperty('--app-height',`${vv.height}px`);apply();vv.addEventListener('resize',apply);vv.addEventListener('scroll',apply);return()=>{vv.removeEventListener('resize',apply);vv.removeEventListener('scroll',apply)}},[]);
  useEffect(()=>{if(!navigator.onLine){setConnectionState('offline');setOfflineGameOpen(true)}},[]);
  useEffect(()=>{audioRef.current={send:new Audio('/sounds/send.wav'),receive:new Audio('/sounds/receive.wav')};},[]);
  const play=(which:'send'|'receive')=>{if(!settings.sound||!audioRef.current)return;const a=audioRef.current[which];a.currentTime=0;a.play().catch(()=>{});};
  const refresh=useCallback(async()=>{const {data,error}=await supabase.from('messages').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100);if(!error&&data){const rawServer=(data as ChatMessage[]).filter(m=>!localDeleted[localMessageKey(m)]);const server=rawServer.map(m=>{const target=rawServer.find(x=>x.id===m.reply_to_id);return target?{...m,reply_to_preview:target.body,reply_to_name:target.name}:m});setMessages(prev=>{const pending=prev.filter(m=>m.id.startsWith('optimistic-')&&pendingRef.current[m.id]&&!localDeleted[localMessageKey(m)]);const merged=[...server,...pending.filter(p=>!server.some(m=>m.user_id===p.user_id&&m.body===p.body&&Math.abs(new Date(m.created_at).getTime()-new Date(p.created_at).getTime())<15000))];return merged.sort((a,b)=>a.created_at.localeCompare(b.created_at))})} const vr=await supabase.from('voice_messages').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100); if(!vr.error&&vr.data)setVoiceMessages((vr.data as VoiceMessage[]).filter(v=>!voiceLocalDeleted[v.id]));},[localDeleted,voiceLocalDeleted]); const refreshReactions=useCallback(async(ids:string[],userId:string)=>{if(!ids.length)return;const {data}=await supabase.from('message_reactions').select('message_id,user_id,reaction').in('message_id',ids);const counts:Record<string,Record<string,number>>={};const mine:Record<string,string[]>={};(data||[]).forEach((r:any)=>{counts[r.message_id]??={};counts[r.message_id][r.reaction]=(counts[r.message_id][r.reaction]||0)+1;if(r.user_id===userId)(mine[r.message_id]??=[]).push(r.reaction)});setReactionCounts(counts);setMyReactions(mine)},[]);
  const refreshVoiceReactions=useCallback(async(ids:string[],userId:string)=>{if(!ids.length)return;const {data}=await supabase.from('voice_reactions').select('voice_id,user_id,reaction').in('voice_id',ids);const counts:Record<string,Record<string,number>>={};const mine:Record<string,string[]>={};(data||[]).forEach((r:any)=>{counts[r.voice_id]??={};counts[r.voice_id][r.reaction]=(counts[r.voice_id][r.reaction]||0)+1;if(r.user_id===userId)(mine[r.voice_id]??=[]).push(r.reaction)});setVoiceReactionCounts(counts);setVoiceMyReactions(mine)},[]);
  useEffect(()=>{
    let mounted=true;
    let channel:any;
    let refreshTimer:number|undefined;
    const removeExpired=()=>setMessages(prev=>{
      const now=Date.now();
      const next=prev.filter(m=>new Date(m.expires_at).getTime()>now);
      return next.length===prev.length?prev:next;
    });
    const refreshNow=async()=>{await refresh();removeExpired()};
    const onVisibility=()=>{if(document.visibilityState==='visible')void refreshNow()};
    const onOnline=()=>{if(!mounted)return;setConnectionState('reconnecting');setConnected(false);setOfflineGameOpen(false);void supabase.realtime.connect();void refreshNow()};
    const onOffline=()=>{if(!mounted)return;setConnected(false);setConnectionState('offline');setOfflineGameOpen(true)};
    const presenceUsers=()=>{
      if(!channel)return;
      const state=channel.presenceState() as Record<string,any[]>;
      const ids=Object.entries(state)
        .filter(([id,metas])=>id!==(sessionRef.current?.user?.id||authUserId)&&Array.isArray(metas)&&metas.some(meta=>meta?.typing===true))
        .map(([id])=>id);
      if(mounted)setTypingUsers(ids);
      if(mounted)setOnline(Object.keys(state).length);
    };
    (async()=>{
      await refreshNow();
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.user||!mounted)return;
      sessionRef.current=session;
      const selfId=session.user.id;
      setAuthUserId(selfId);
      await supabase.realtime.setAuth(session.access_token);
      channel=supabase.channel('global-chat',{config:{presence:{key:selfId}}});
      channelRef.current=channel;
      channel
        .on('presence',{event:'sync'},presenceUsers)
        .on('presence',{event:'join'},presenceUsers)
        .on('presence',{event:'leave'},presenceUsers)
        .on('broadcast',{event:'typing',config:{self:false}},({payload}:any)=>{
          const id=payload?.userId;
          if(!id||id===selfId)return;
          setTypingUsers(prev=>prev.includes(id)?prev:[...prev,id]);
          window.setTimeout(()=>setTypingUsers(prev=>prev.filter(x=>x!==id)),1800);
        })
        .on('broadcast',{event:'message-meta'},({payload}:any)=>{
          const messageId=payload?.messageId;
          const replyToId=payload?.replyToId;
          if(!messageId||!replyToId)return;
          const target=messagesRef.current.find(m=>m.id===replyToId);
          const meta={replyToId,replyToPreview:payload.replyToPreview||target?.body||'',replyToName:payload.replyToName||target?.name||'User'};
          replyMetaRef.current[messageId]=meta;
          if(mounted)setMessages(prev=>prev.map(m=>m.id===messageId?{...m,reply_to_id:meta.replyToId,reply_to_preview:meta.replyToPreview,reply_to_name:meta.replyToName}:m));
        })
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},(payload:any)=>{
          if(!mounted)return;
          const raw=payload.new as ChatMessage;
          const replyTargetMessage=raw.reply_to_id?messagesRef.current.find(x=>x.id===raw.reply_to_id):undefined;
          const meta=replyMetaRef.current[raw.id] || (replyTargetMessage?{replyToId:raw.reply_to_id!,replyToPreview:replyTargetMessage.body,replyToName:replyTargetMessage.name}:undefined);
          const m=meta?{...raw,reply_to_id:meta.replyToId,reply_to_preview:meta.replyToPreview,reply_to_name:meta.replyToName}:raw;
          if(localDeleted[localMessageKey(m)]||new Date(m.expires_at).getTime()<=Date.now())return;
          const wasNearBottom=isNearBottom();
          setMessages(prev=>{
            if(prev.some(x=>x.id===m.id))return prev;
            if(m.user_id===selfId){
              const match=prev.find(x=>x.id.startsWith('optimistic-')&&x.user_id===selfId&&x.body===m.body&&Math.abs(new Date(x.created_at).getTime()-new Date(m.created_at).getTime())<15000);
              if(match){delete pendingRef.current[match.id];return prev.map(x=>x.id===match.id?m:x).sort((a,b)=>a.created_at.localeCompare(b.created_at))}
            }
            return [...prev,m].sort((a,b)=>a.created_at.localeCompare(b.created_at));
          });
          if(m.user_id!==selfId){play('receive'); if(!wasNearBottom)setNewMessageCount(c=>Math.min(c+1,99));}
          else if(wasNearBottom)setNewMessageCount(0);
        })
        .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},(payload:any)=>setMessages(prev=>prev.filter(m=>m.id!==payload.old.id)))
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'voice_messages'},(payload:any)=>{const v=payload.new as VoiceMessage;if(v.expires_at&&new Date(v.expires_at).getTime()>Date.now()&&!voiceLocalDeleted[v.id])setVoiceMessages(prev=>prev.some(x=>x.id===v.id)?prev:[...prev,v].sort((a,b)=>a.created_at.localeCompare(b.created_at)))})
        .on('postgres_changes',{event:'DELETE',schema:'public',table:'voice_messages'},(payload:any)=>{setVoiceMessages(prev=>prev.filter(v=>v.id!==payload.old.id));if(playingVoiceId===payload.old.id){voiceAudioRef.current?.pause();setPlayingVoiceId(null)}})
        .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},()=>refreshReactions(messageIdsRef.current,selfId))
        .on('postgres_changes',{event:'*',schema:'public',table:'voice_reactions'},()=>refreshVoiceReactions(voiceMessages.map(v=>v.id),selfId))
        .subscribe(async (status:any)=>{
          if(status==='SUBSCRIBED'){
            setConnected(true);
            setConnectionState('connected');
            await channel.track({online_at:new Date().toISOString(),typing:false});
            presenceUsers();
          }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
            setConnected(false);
            setConnectionState('reconnecting');
          }
        });
      refreshTimer=window.setInterval(()=>void refreshNow(),15000);
      window.addEventListener('online',onOnline);
      window.addEventListener('offline',onOffline);
      document.addEventListener('visibilitychange',onVisibility);
    })();
    return()=>{
      mounted=false;
      if(refreshTimer)window.clearInterval(refreshTimer);
      window.removeEventListener('online',onOnline);
      window.removeEventListener('offline',onOffline);
      document.removeEventListener('visibilitychange',onVisibility);
      if(typingStopRef.current)window.clearTimeout(typingStopRef.current);
      if(channel){channel.untrack();supabase.removeChannel(channel)}
      channelRef.current=null;
    };
  },[refresh,localDeleted]);
  useEffect(()=>{const timers: number[]=[]; const now=Date.now(); messages.forEach(m=>{const delay=new Date(m.expires_at).getTime()-now; if(delay>0&&delay<2147483647)timers.push(window.setTimeout(()=>setMessages(prev=>prev.filter(x=>x.id!==m.id)),delay+50));}); voiceMessages.forEach(v=>{const delay=new Date(v.expires_at).getTime()-now; if(delay>0&&delay<2147483647)timers.push(window.setTimeout(()=>setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id)),delay+50));}); return()=>timers.forEach(t=>window.clearTimeout(t))},[messages,voiceMessages]);
  useEffect(()=>{messagesRef.current=messages;messageIdsRef.current=messages.map(m=>m.id)},[messages]);
  const messageIds=useMemo(()=>messages.map(m=>m.id).join(','),[messages]);
  const voiceIds=useMemo(()=>voiceMessages.map(v=>v.id).join(','),[voiceMessages]);
  useEffect(()=>{if(authUserId&&messageIds)refreshReactions(messageIds.split(',').filter(Boolean),authUserId)},[messageIds,authUserId,refreshReactions]);
  useEffect(()=>{if(authUserId&&voiceIds)refreshVoiceReactions(voiceIds.split(',').filter(Boolean),authUserId)},[voiceIds,authUserId,refreshVoiceReactions]);
  const shouldStickToBottom=()=>{const el=listRef.current;if(!el)return true;return el.scrollHeight-el.scrollTop-el.clientHeight<120};
  const previousMessageCountRef=useRef(messages.length);
  useEffect(()=>{const el=listRef.current;if(!el)return;const grew=messages.length>previousMessageCountRef.current;const near=shouldStickToBottom();if(grew&&near&&!activeSearch)el.scrollTop=el.scrollHeight;else if(!near&&messages.length)setShowJump(true);previousMessageCountRef.current=messages.length},[messages.length,activeSearch]);
  const handleScroll=()=>{const el=listRef.current;if(!el)return;const near=el.scrollHeight-el.scrollTop-el.clientHeight<120;if(near){setShowJump(false);setNewMessageCount(0)}else setShowJump(messages.length>0)};
  const jumpToLatest=()=>{const el=listRef.current;if(!el)return;el.scrollTop=el.scrollHeight;setShowJump(false);setNewMessageCount(0)};
  const updateTyping=(value:string)=>{
    setText(value);
    if(!channelRef.current||!authUserId)return;
    if(typingStopRef.current)window.clearTimeout(typingStopRef.current);
    if(value.trim()){
      void channelRef.current.send({
        type:'broadcast',
        event:'typing',
        payload:{userId:authUserId}
      });
      typingStopRef.current=window.setTimeout(()=>{
        setTypingUsers(prev=>prev.filter(id=>id!==authUserId));
      },1200);
    }
  };
  const stopRecording=()=>{if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);recordingTimerRef.current=undefined;mediaRecorderRef.current?.stop();setRecording(false);};
  const requestMic=async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone recording is not supported in this browser.');const stream=await navigator.mediaDevices.getUserMedia({audio:true});setMicPermission('granted');setMicNotice(false);return stream}catch(e:any){setMicPermission('denied');setMicNotice(true);setError(e?.name==='NotAllowedError'?'Microphone permission was denied. Please allow microphone access in your browser site settings.':(e?.message||'Microphone access is unavailable.'));return null}};
  const startRecording=async()=>{if(recording)return;if(!navigator.onLine){setError('You are offline. Please reconnect before recording.');return} const stream=await requestMic();if(!stream)return;try{const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x))||'';const recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:24000}:undefined);mediaRecorderRef.current=recorder;mediaChunksRef.current=[];recordingStartedRef.current=Date.now();setRecordingSeconds(0);setRecording(true);recorder.ondataavailable=e=>{if(e.data.size)mediaChunksRef.current.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(mediaChunksRef.current,{type:recorder.mimeType||'audio/webm'});const duration=Math.min(60000,Date.now()-recordingStartedRef.current);if(blob.size>350*1024){setError('Voice message is too large. Please record a shorter message.');return}if(duration<500){setError('Voice message is too short.');return}await uploadVoice(blob,duration,replyTarget?.reply_to_voice_id||null);setReplyTarget(null)};recorder.start(250);recordingTimerRef.current=window.setInterval(()=>{const elapsed=Math.floor((Date.now()-recordingStartedRef.current)/1000);if(elapsed>=60){stopRecording();return}setRecordingSeconds(elapsed)},250)}catch{stream.getTracks().forEach(t=>t.stop());setRecording(false);setError('Could not start microphone recording. Please try again.')}};
  const uploadVoice=async(blob:Blob,duration:number,replyToVoiceId:string|null=null)=>{setError('');setSending(true);try{const ext=blob.type.includes('mp4')?'m4a':'webm';const file=new File([blob],`voice.${ext}`,{type:blob.type||'audio/webm'});const form=new FormData();form.append('audio',file);form.append('durationMs',String(duration));if(replyToVoiceId)form.append('replyToVoiceId',replyToVoiceId);const {data,error}=await supabase.functions.invoke('send-voice',{body:form});if(error||data?.error)throw new Error(data?.error||'Unable to send voice message.');if(data?.message)setVoiceMessages(prev=>[...prev.filter(v=>v.id!==data.message.id),data.message as VoiceMessage].sort((a,b)=>a.created_at.localeCompare(b.created_at)));play('send')}catch(e:any){setError(e.message||'Unable to send voice message.')}finally{setSending(false)}};
  const cancelRecording=()=>{if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);recordingTimerRef.current=undefined;const r=mediaRecorderRef.current;mediaRecorderRef.current=null;if(r){r.onstop=null;r.stop();r.stream.getTracks().forEach(t=>t.stop())}setRecording(false);setRecordingSeconds(0)};
  const toggleVoicePlayback=(v:VoiceMessage)=>{
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
  };
  const deleteVoiceForMe=(v:VoiceMessage)=>{const next={...readVoiceLocalDeleted(),[v.id]:new Date(v.expires_at).getTime()};setVoiceLocalDeleted(next);persistVoiceLocalDeleted(next);setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id))};
  const deleteVoiceForEveryone=async(v:VoiceMessage)=>{if(v.user_id!==authUserId)return;const session=sessionRef.current;const {data,error}=await supabase.functions.invoke('delete-voice-for-everyone',{body:{voiceId:v.id,userId:authUserId},headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});if(error||data?.error){setError(data?.error||'Could not delete this voice message.');return}setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id));setVoiceLocalDeleted(prev=>{const next={...prev,[v.id]:Date.now()+3*60*1000};persistVoiceLocalDeleted(next);return next});if(playingVoiceId===v.id){voiceAudioRef.current?.pause();setPlayingVoiceId(null)}};
  useEffect(()=>()=>{voiceAudioRef.current?.pause();if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);mediaRecorderRef.current?.stream.getTracks().forEach(t=>t.stop())},[]);
  const beginReply=(m:ChatMessage)=>{if(m.id.startsWith('optimistic-'))return;setReplyTarget(m);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())};
  const beginVoiceReply=(v:VoiceMessage)=>{const target:ChatMessage={id:`voice-reply-${v.id}`,user_id:v.user_id,name:v.name,country:v.country,subdivision:v.subdivision,avatar_id:v.avatar_id,body:'🎙️ Voice message',created_at:v.created_at,expires_at:v.expires_at,reply_to_voice_id:v.id};setReplyTarget(target);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())};
  const send=async()=>{if(sendLockRef.current)return;sendLockRef.current=true;setError('');const body=text.trim();const problem=validateMessage(text);if(problem){setError(problem);sendLockRef.current=false;return}const duplicate=messagesRef.current.some(m=>m.user_id===authUserId&&m.body===body&&Date.now()-new Date(m.created_at).getTime()<10000&&!m.id.startsWith('optimistic-'));if(duplicate){setError('Please do not send the same message again so quickly.');sendLockRef.current=false;return}const tempId=`optimistic-${crypto.randomUUID()}`;const createdAt=new Date().toISOString();const optimistic:ChatMessage={id:tempId,user_id:authUserId,name:profile.name,country:profile.country,subdivision:profile.subdivision,avatar_id:profile.avatarId,body,created_at:createdAt,expires_at:new Date(Date.now()+5*60*1000).toISOString(),reply_to_id:replyTarget?.reply_to_voice_id?null:replyTarget?.id||null,reply_to_voice_id:replyTarget?.reply_to_voice_id||null,reply_to_preview:replyTarget?.body||null,reply_to_name:replyTarget?.name||null};pendingRef.current[tempId]={tempId,body,createdAt};setText('');setEmojiOpen(false);const sentReply=replyTarget;setReplyTarget(null);setMessages(prev=>prev.some(m=>m.id===tempId)?prev:[...prev,optimistic]);play('send');setSending(true);try{let session=sessionRef.current;if(!session){const {data}=await supabase.auth.getSession();session=data.session;sessionRef.current=session}const {data,error}=await supabase.functions.invoke('send-message',{body:{text:body,profile,replyToId:sentReply&&!sentReply.reply_to_voice_id&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,replyToVoiceId:sentReply?.reply_to_voice_id||null},headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});if(error||data?.error)throw new Error(data?.error||'Unable to send message.');const serverMessage={...(data?.message||data) as ChatMessage,reply_to_id:sentReply&&!sentReply.reply_to_voice_id&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,reply_to_voice_id:sentReply?.reply_to_voice_id||null,reply_to_preview:sentReply?.body||null,reply_to_name:sentReply?.name||null};setMessages(prev=>{if(serverMessage?.id&&prev.some(m=>m.id===serverMessage.id))return prev;const exists=prev.some(m=>m.id===tempId);return exists&&serverMessage?.id?prev.map(m=>m.id===tempId?serverMessage:m):prev});delete pendingRef.current[tempId];if(sentReply&&!sentReply.id.startsWith('optimistic-')&&serverMessage?.id&&channelRef.current)void channelRef.current.send({type:'broadcast',event:'message-meta',payload:{messageId:serverMessage.id,replyToId:sentReply.id,replyToPreview:sentReply.body,replyToName:sentReply.name}})}catch(e:any){setMessages(prev=>prev.filter(m=>m.id!==tempId));delete pendingRef.current[tempId];setError(e.message||'Unable to send message. Please try again.')}finally{setSending(false);sendLockRef.current=false}};
  const persistLocalDeleted=(next:Record<string,number>)=>{setLocalDeleted(next);try{localStorage.setItem(LOCAL_DELETED_KEY,JSON.stringify(next))}catch{}};
  const deleteLocally=(m:ChatMessage)=>{if(!canLocalDelete(m))return;const key=localMessageKey(m);const next={...readLocalDeleted(),[key]:new Date(m.expires_at).getTime()};persistLocalDeleted(next);setMessages(prev=>prev.filter(x=>localMessageKey(x)!==key))};
  const deleteForEveryone=async(m:ChatMessage)=>{if(!canLocalDelete(m)||m.user_id!==authUserId)return;setDeletingForEveryone(true);setError('');try{const {data,error}=await supabase.rpc('delete_message_for_everyone',{p_message_id:m.id});if(error)throw error;if(data!==true)throw new Error('This message could not be deleted for everyone.');deleteLocally(m);setDeleteConfirmMessage(null)}catch{setError('Could not delete this message for everyone. Please try again.')}finally{setDeletingForEveryone(false)}};
  const clearChatLocally=()=>{const current=readLocalDeleted();const now=Date.now();messages.forEach(m=>{if(new Date(m.expires_at).getTime()>now)current[localMessageKey(m)]=new Date(m.expires_at).getTime()});persistLocalDeleted(current);setMessages([])};
  const onKey=(e:React.KeyboardEvent)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
  return <div className="chat-app"><header className="topbar"><div className="top-brand"><img className="brand-mini brand-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" /><div><b>GLOBAL CHAT</b><span><i className={connected?'online-dot':'offline-dot'}></i>{online} Online</span></div></div><div className="top-actions"><button className={`header-icon ${searchOpen?'active':''}`} onClick={()=>setSearchOpen(v=>!v)} aria-label="Search active messages" title="Search active messages"><Search size={17}/></button><button className="header-icon clear-chat-btn" onClick={()=>setClearConfirmOpen(true)} aria-label="Clear Chat" title="Clear Chat"><Trash2 size={17}/></button><button className="settings-btn" onClick={()=>setSettingsOpen(true)} aria-label="Settings" title="Settings"><Settings size={18}/></button></div></header>
    <div className={`connection-banner ${connectionState}`}><span>{connectionState==='connected'?<Wifi size={13}/>:connectionState==='offline'?<WifiOff size={13}/>:<Wifi size={13}/>}</span>{connectionState==='connected'?'Connected':connectionState==='offline'?'Offline — game mode available':'Reconnecting…'}</div>
    <main className="chat-main">{searchOpen&&<div className="chat-search"><Search size={16}/><input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search active messages..." aria-label="Search active messages"/><span>{displayedMessages.length}/{messages.length}</span></div>}<div className="message-list" ref={listRef} onScroll={handleScroll}>{messages.length===0&&voiceMessages.length===0?<div className="empty"><div className="empty-earth">🌍</div><h2>Talk to the world</h2><p>Say hello. Share ideas. Keep it friendly.</p></div>:<>{[...displayedMessages.map(data=>({kind:'text' as const,data})),...voiceMessages.filter(v=>!activeSearch||`${v.name} voice message`.toLowerCase().includes(activeSearch)).map(data=>({kind:'voice' as const,data}))].sort((a,b)=>a.data.created_at.localeCompare(b.data.created_at)).map(item=>item.kind==='text'?<Message key={item.data.id} m={item.data} current={item.data.user_id===authUserId} timeFormat={settings.timeFormat || '12h'} counts={reactionCounts[item.data.id]||{}} mine={myReactions[item.data.id]||[]} highlighted={highlightedMessageId===item.data.id} copied={copiedId===item.data.id} onCopy={()=>copyMessage(item.data)} onToggle={async(r)=>{const {error}=await supabase.functions.invoke('toggle-reaction',{body:{messageId:item.data.id,reaction:r}});if(!error)refreshReactions(messageIdsRef.current,authUserId)}} onDelete={()=>setDeleteConfirmMessage(item.data)} onReply={()=>beginReply(item.data)} onReplyJump={(id)=>{const el=document.getElementById(`msg-${id}`);el?.scrollIntoView({behavior:'smooth',block:'center'});setHighlightedMessageId(id)}}/>:<VoiceBubble key={`voice-${item.data.id}`} v={item.data} current={item.data.user_id===authUserId} playing={playingVoiceId===item.data.id} elapsedSeconds={playingVoiceId===item.data.id?playingVoiceElapsed:0} onPlay={()=>toggleVoicePlayback(item.data)} onDeleteForMe={()=>deleteVoiceForMe(item.data)} onDeleteForEveryone={()=>void deleteVoiceForEveryone(item.data)} onReply={()=>beginVoiceReply(item.data)} timeFormat={settings.timeFormat||'12h'} counts={voiceReactionCounts[item.data.id]||{}} mine={voiceMyReactions[item.data.id]||[]} onToggleReaction={async(r)=>{const {error}=await supabase.functions.invoke('toggle-voice-reaction',{body:{voiceId:item.data.id,reaction:r}});if(!error)refreshVoiceReactions(voiceMessages.map(v=>v.id),authUserId)}}/> )}</>}</div>{showJump&&<button className="jump-latest" onClick={jumpToLatest}><ArrowDown size={15}/>{newMessageCount>0?`${newMessageCount} NEW MESSAGE${newMessageCount===1?'':'S'}`:'LATEST MESSAGES'}</button>}{typingUsers.length>0&&<div className="typing-indicator">Someone is typing<span className="typing-dots"><i></i><i></i><i></i></span></div>}
      <div className="composer-wrap">{replyTarget&&<div className="reply-composer"><div><b><ReplyIcon size={14}/> Replying to {replyTarget.name}</b><span>{replyTarget.body}</span></div><button onClick={()=>setReplyTarget(null)} aria-label="Cancel reply"><X size={16}/></button></div>}{recording?<div className="voice-recorder"><div className="voice-rec-left"><span className="recording-dot"></span><strong>{String(Math.floor(recordingSeconds/60)).padStart(2,'0')}:{String(recordingSeconds%60).padStart(2,'0')}</strong><div className="recording-wave" aria-label="Recording"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><button className="voice-cancel" onClick={cancelRecording} aria-label="Cancel recording"><Trash2 size={18}/></button><button className="voice-send" onClick={stopRecording} aria-label="Send voice message"><Send size={18}/></button></div>:<div className="composer"><div className="tools"><button className="icon-btn" onClick={()=>setEmojiOpen(v=>!v)} aria-label="Emoji"><Smile size={19}/></button>{emojiOpen&&<div className="emoji-pop">{EMOJIS.map(e=><button key={e} onClick={()=>setText(v=>v+e)}>{e}</button>)}</div>}</div><textarea value={text} maxLength={500} onChange={e=>updateTyping(e.target.value)} onKeyDown={onKey} placeholder="Type your message..." rows={1}/><button className="voice-btn" onClick={()=>void startRecording()} aria-label="Record voice message" title="Record voice message"><Mic size={19}/></button><button className="send-btn" disabled={!text.trim()||sending} onClick={send}><Send size={18}/></button></div>}{micNotice&&<div className="mic-permission-notice"><Mic size={16}/><span>Microphone access is blocked. Allow it in your browser to send voice messages.</span><button onClick={()=>void requestMic()}>ALLOW MICROPHONE</button></div>}<div className="composer-meta"><span>{text.length} / 500</span>{error&&<span className="error-text">{error}</span>}<span className="input-note">English only · 3 messages / 10s</span></div></div>
    </main>{offlineGameOpen&&<OfflineGame onClose={()=>setOfflineGameOpen(false)}/>} {deleteConfirmMessage&&<div className="delete-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"><div className="delete-modal"><div className="delete-modal-icon"><Trash2 size={20}/></div><h3 id="delete-modal-title">Delete Message?</h3><p>Choose where you want to delete this message.</p><div className="delete-modal-actions"><button className="delete-option-btn" onClick={()=>{deleteLocally(deleteConfirmMessage);setDeleteConfirmMessage(null)}} disabled={deletingForEveryone}><span>Delete for me</span><small>Remove only from your chat</small></button>{deleteConfirmMessage.user_id===authUserId&&<button className="delete-option-btn danger" onClick={()=>void deleteForEveryone(deleteConfirmMessage)} disabled={deletingForEveryone}><span>{deletingForEveryone?'Deleting…':'Delete for everyone'}</span><small>Remove from everyone’s chat</small></button>}<button className="clear-cancel-btn" onClick={()=>setDeleteConfirmMessage(null)} disabled={deletingForEveryone}>CANCEL</button></div></div></div>} {clearConfirmOpen&&<div className="clear-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="clear-modal-title"><div className="clear-modal"><div className="clear-modal-icon"><Trash2 size={20}/></div><h3 id="clear-modal-title">Clear Chat?</h3><p>Clear all currently visible messages on this device?</p><span>Messages on other devices will not be deleted.</span><div className="clear-modal-actions"><button className="clear-cancel-btn" onClick={()=>setClearConfirmOpen(false)}>CANCEL</button><button className="clear-confirm-btn" onClick={()=>{clearChatLocally();setClearConfirmOpen(false)}}>CLEAR CHAT</button></div></div></div>}{settingsOpen&&<SettingsPanel profile={profile} settings={settings} onClose={()=>setSettingsOpen(false)} onSave={async(p,s)=>{try{const {error}=await supabase.functions.invoke('save-profile',{body:p});if(error)throw error;onProfile(p);onSettings(s);localStorage.setItem(PROFILE_KEY,JSON.stringify(p));localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));setSettingsOpen(false)}catch{setError('Could not save settings. Please try again.')}}}/>}</div>
}

function formatMessageTime(value:string,format:TimeFormat){return new Intl.DateTimeFormat(undefined,{hour:format==='24h'?'2-digit':'numeric',minute:'2-digit',hour12:format==='12h'}).format(new Date(value))}

const Message=memo(function Message({m,current,counts,mine,onToggle,onDelete,onReply,onCopy,onReplyJump,highlighted,copied,timeFormat}:{m:ChatMessage;current:boolean;counts:Record<string,number>;mine:string[];onToggle:(r:string)=>Promise<void>;onDelete:()=>void;onReply:()=>void;onCopy:()=>void;onReplyJump:(id:string)=>void;highlighted:boolean;copied:boolean;timeFormat:TimeFormat}){const [expanded,setExpanded]=useState(false); const isLong=m.body.length>250; const visibleBody=!isLong||expanded?m.body:m.body.slice(0,250)+'…'; const countryName=iso31661.find(c=>c.alpha2===m.country)?.name??m.country; const subdivisionName=iso31662.find(s=>s.code===m.subdivision)?.name??m.subdivision.split('-').pop()??m.subdivision; const head=<div className="message-head">{<div className="message-identity"><div className="message-avatar">{AVATARS.find(a=>a.id===m.avatar_id)?.emoji??'🌍'}</div><div><strong>{m.name}</strong><span>{flag(m.country)} {subdivisionName}, {countryName}</span></div></div>}</div>; const deletable=canLocalDelete(m); return <article id={`msg-${m.id}`} className={`message-row ${current?'mine':''} ${highlighted?'highlighted':''}`}><div className="message-content"><div className="message-top">{head}</div><div className="bubble-wrap">{m.reply_to_id&&<button className="reply-preview" onClick={()=>onReplyJump(m.reply_to_id!)}><ReplyIcon size={13}/><span><b>{m.reply_to_name||'User'}</b>{m.reply_to_preview||'Reply'}</span></button>}<div className="bubble"><span>{visibleBody}</span>{isLong&&<button type="button" className="read-more-btn" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'Read more'}</button>}</div><time className="message-time" dateTime={m.created_at}>{formatMessageTime(m.created_at,timeFormat)}</time><button className="message-copy" onClick={onCopy} aria-label="Copy message" title={copied?"Copied":"Copy message"}>{copied?<Check size={12}/>:<Copy size={12}/>}</button><button className="message-reply" onClick={onReply} aria-label="Reply" title="Reply"><ReplyIcon size={13}/></button>{deletable&&<button className="message-delete" onClick={onDelete} aria-label="Delete message" title="Delete message"><Trash2 size={13}/></button>}</div><div className="reaction-row">{REACTIONS.map(r=><button key={r} className={mine.includes(r)?'reacted':''} onClick={()=>onToggle(r)}>{r}{counts[r]?<small>{counts[r]}</small>:null}</button>)}</div></div></article>});
function VoiceBubble({v,current,playing,elapsedSeconds,onPlay,onDeleteForMe,onDeleteForEveryone,onReply,timeFormat,counts,mine,onToggleReaction}:{v:VoiceMessage;current:boolean;playing:boolean;elapsedSeconds:number;onPlay:()=>void;onDeleteForMe:()=>void;onDeleteForEveryone:()=>void;onReply:()=>void;timeFormat:TimeFormat;counts:Record<string,number>;mine:string[];onToggleReaction:(r:string)=>Promise<void>}){const [menu,setMenu]=useState(false);const countryName=iso31661.find(c=>c.alpha2===v.country)?.name??v.country;const subdivisionName=iso31662.find(s=>s.code===v.subdivision)?.name??v.subdivision.split('-').pop()??v.subdivision;const durationSeconds=playing?elapsedSeconds:Math.max(0,v.duration_ms/1000);const mins=Math.floor(durationSeconds/60);const secs=Math.floor(durationSeconds%60);return <article className={`message-row voice-row ${current?'mine':''}`}><div className="message-content"><div className="message-top"><div className="message-identity"><div className="message-avatar">{AVATARS.find(a=>a.id===v.avatar_id)?.emoji??'🌍'}</div><div><strong>{v.name}</strong><span>{flag(v.country)} {subdivisionName}, {countryName}</span></div></div></div>{v.reply_to_voice_id&&<button className="reply-preview voice-reply-preview" onClick={onReply}><ReplyIcon size={13}/><span><b>{v.reply_to_name||'User'}</b>{v.reply_to_preview||'🎙️ Voice message'}</span></button>}<div className={`voice-bubble ${playing?'voice-playing':''}`}><button className="voice-play-btn" onClick={onPlay} aria-label={playing?'Pause voice':'Play voice'}>{playing?<Pause size={17}/>:<Play size={17}/>}</button><div className="voice-wave" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{height:`${7+(i%7)*2}px`}} className={playing?'active':''}></i>)}</div><span className="voice-duration">{mins}:{String(secs).padStart(2,'0')}</span><button className="voice-menu-btn" onClick={()=>setMenu(x=>!x)} aria-label="Voice message options"><span>⋮</span></button>{menu&&<div className="voice-menu"><button onClick={()=>{onReply();setMenu(false)}}><ReplyIcon size={14}/> Reply</button><button onClick={()=>{onDeleteForMe();setMenu(false)}}><Trash2 size={14}/> Delete for me</button>{current&&<button className="danger" onClick={()=>{onDeleteForEveryone();setMenu(false)}}><Trash2 size={14}/> Delete for everyone</button>}</div>}</div><time className="message-time voice-message-time">{formatMessageTime(v.created_at,timeFormat)}</time><div className="reaction-row voice-reactions">{REACTIONS.map(r=><button key={r} className={mine.includes(r)?'reacted':''} onClick={()=>onToggleReaction(r)}>{r}{counts[r]?<small>{counts[r]}</small>:null}</button>)}</div></div></article>}

function SettingsPanel({profile,settings,onClose,onSave}:{profile:Profile;settings:any;onClose:()=>void;onSave:(p:Profile,s:any)=>void}){const [p,setP]=useState(profile);const [s,setS]=useState(settings); const nameValid=p.name.trim().length>=2 && p.name.trim().length<=32; useEffect(()=>{const t=THEMES.find(x=>x.id===p.themeId)||THEMES[0]; document.documentElement.style.setProperty('--bg',t.bg);document.documentElement.style.setProperty('--surface',t.surface);document.documentElement.style.setProperty('--primary',t.primary);document.documentElement.style.setProperty('--accent',t.accent);document.documentElement.style.setProperty('--font-size',`${TEXT_SIZES[s.textSize as TextSize]}px`);},[p.themeId,s.textSize]); return <div className="modal-backdrop"><div className="settings-panel"><div className="panel-head"><div><b>⚙️ SETTINGS</b><span>Personalize your chat experience</span></div><button onClick={onClose}><X/></button></div><label>👤 Name / Nickname</label><input className="settings-name-input" maxLength={32} value={p.name} onChange={e=>setP({...p,name:e.target.value})} placeholder="Enter a nickname…" autoComplete="nickname"/><label>🖼️ Change Avatar</label><div className="avatar-grid compact">{AVATARS.map(a=><button className={`avatar ${p.avatarId===a.id?'selected':''}`} key={a.id} onClick={()=>setP({...p,avatarId:a.id})}>{a.emoji}</button>)}</div><label>🎨 Change Theme</label><div className="theme-grid compact-themes">{THEMES.map(t=><button className={`theme-tile ${p.themeId===t.id?'selected':''}`} key={t.id} style={{background:t.bg,borderColor:t.primary}} onClick={()=>setP({...p,themeId:t.id})}><span style={{background:t.primary}}></span><strong>{t.name}</strong></button>)}</div><label>🔤 Text Size</label><div className="segmented">{(['small','medium','large','xl'] as TextSize[]).map(k=><button className={s.textSize===k?'active':''} key={k} onClick={()=>setS({...s,textSize:k})}>{k==='xl'?'Extra Large':k[0].toUpperCase()+k.slice(1)}</button>)}</div><label>🔔 Sound</label><div className="segmented two"><button className={s.sound?'active':''} onClick={()=>setS({...s,sound:true})}><Volume2 size={15}/> ON</button><button className={!s.sound?'active':''} onClick={()=>setS({...s,sound:false})}><MicOff size={15}/> OFF</button></div><label>🕐 Clock Format</label><div className="segmented two"><button className={(s.timeFormat||'12h')==='12h'?'active':''} onClick={()=>setS({...s,timeFormat:'12h'})}>12-hour</button><button className={(s.timeFormat||'12h')==='24h'?'active':''} onClick={()=>setS({...s,timeFormat:'24h'})}>24-hour</button></div><button className="primary-btn" disabled={!nameValid} onClick={()=>onSave({...p,name:p.name.trim().replace(/\s+/g,' ')},{...s,timeFormat:s.timeFormat||'12h'})}>SAVE SETTINGS <Check size={17}/></button></div></div>}


function OfflineGame({onClose}:{onClose:()=>void}){const [score,setScore]=useState(0);const [seconds,setSeconds]=useState(10);const [running,setRunning]=useState(true);useEffect(()=>{const t=window.setInterval(()=>setSeconds(s=>{if(s<=1){window.clearInterval(t);setRunning(false);return 0}return s-1}),1000);return()=>window.clearInterval(t)},[]);return <div className="offline-game-backdrop"><div className="offline-game"><div className="offline-game-head"><div><span className="game-kicker"><Gamepad2 size={15}/> OFFLINE MODE</span><h3>Tap Rush</h3><p>Internet is unavailable. Beat the timer!</p></div><button onClick={onClose}><X/></button></div><div className="game-score"><span>Score <b>{score}</b></span><span>Time <b>{seconds}s</b></span></div><button className="tap-target" disabled={!running} onClick={()=>setScore(v=>v+1)}>{running?'TAP!':'TIME UP'}</button><small>{running?'Tap as fast as you can.':'You can close this and return when the connection comes back.'}</small></div></div>}


/* GLOBAL CHAT voice final polish runtime */
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

// 3) Reliable UI click sound for voice controls.
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


/* GLOBAL CHAT voice duration live-time fix v1 */
