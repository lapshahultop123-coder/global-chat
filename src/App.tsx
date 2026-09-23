import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { iso31661, iso31662 } from 'iso-3166';
import { ArrowDown, Bell, BookOpen, Check, ChevronDown, Clock3, Copy, Gamepad2, Globe2, Image, KeyRound, LockKeyhole, Mic, MicOff, MoreVertical, Palette, Pause, Pencil, Play, Plus, Reply as ReplyIcon, Search, Send, Settings, Smile, Trash2, UserRound, Users, Volume2, Wifi, WifiOff, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AVATARS, EMOJIS, REACTIONS, THEMES, TEXT_SIZES, type TextSize } from './data/catalog';

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
const PRIVATE_CHAT_LOCAL_KEY='global-chat-private-room-v1';
const PRIVATE_CHAT_HIDDEN_KEY='global-chat-your-private-chats-hidden-v1';

function flag(code:string){return code.toUpperCase().replace(/./g,c=>String.fromCodePoint(c.charCodeAt(0)+127397));}
function avatarSrc(id:number){return AVATARS.find(a=>a.id===id)?.src ?? AVATARS[0].src;}
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
        <label><UserRound size={15}/> Choose Your Avatar</label><div className="avatar-grid">{AVATARS.map(a=><button className={`avatar ${avatarId===a.id?'selected':''}`} key={a.id} onClick={()=>setAvatarId(a.id)} aria-label={`Avatar ${a.id}`}><img src={a.src} alt={`Avatar ${a.id}`}/></button>)}</div>
      </section>
      <section className="card theme-card"><label><Palette size={15}/> Choose Your Theme</label><div className="theme-grid">{THEMES.map(t=><button key={t.id} className={`theme-tile ${themeId===t.id?'selected':''}`} style={{background:t.bg,borderColor:t.primary}} onClick={()=>setThemeId(t.id)}><span style={{background:t.primary}}></span><strong>{t.name}</strong><small>Instant preview</small></button>)}</div>
        <div className="rules"><h3><BookOpen size={18}/> GLOBAL CHAT RULES</h3><ul><li>English only.</li><li>No bad words, harassment, threats, spam, or offensive content.</li><li>Keep text messages within 500 characters.</li><li>Public text and voice messages are temporary and may expire after 5 minutes.</li><li>Voice messages can be up to 60 seconds and must use supported audio formats.</li><li>Public chat allows limited sending to reduce spam and abuse.</li><li>Private chats are protected by a unique 8-character room code and visible only to joined members.</li><li>Do not share private room codes with people you do not trust.</li><li>Replies, emoji reactions, typing indicators, and online status are available in chat.</li><li>Delete for me removes a message only from your view; Delete for everyone is available to the sender and removes the message for everyone.</li><li>Clear Chat clears the currently visible chat on your device; it does not erase other users’ history.</li><li>No photo or file uploads.</li><li>Be respectful and use Global Chat responsibly.</li></ul><label className="agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I agree to the rules</span></label></div>
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
  const [messages,setMessages]=useState<ChatMessage[]>([]); const [voiceMessages,setVoiceMessages]=useState<VoiceMessage[]>([]); const [voiceLocalDeleted,setVoiceLocalDeleted]=useState<Record<string,number>>(()=>readVoiceLocalDeleted()); const [recording,setRecording]=useState(false); const [recordingStream,setRecordingStream]=useState<MediaStream|null>(null); const [recordingSeconds,setRecordingSeconds]=useState(0); const [recordedVoiceBlob,setRecordedVoiceBlob]=useState<Blob|null>(null); const [recordedVoiceDuration,setRecordedVoiceDuration]=useState(0); const [micPermission,setMicPermission]=useState<'unknown'|'prompt'|'granted'|'denied'>('unknown'); const [micNotice,setMicNotice]=useState(false); const mediaRecorderRef=useRef<MediaRecorder|null>(null); const mediaChunksRef=useRef<Blob[]>([]); const recordingTimerRef=useRef<number|undefined>(undefined); const recordingStartedRef=useRef<number>(0); const sendAfterRecordingRef=useRef(false); const sendAfterRecordingReplyRef=useRef<{messageId:string|null;voiceId:string|null}>({messageId:null,voiceId:null}); const [localDeleted,setLocalDeleted]=useState<Record<string,number>>(()=>readLocalDeleted()); const messagesRef=useRef<ChatMessage[]>([]); const messageIdsRef=useRef<string[]>([]); const [online,setOnline]=useState(0); const [reactionCounts,setReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [myReactions,setMyReactions]=useState<Record<string,string[]>>({}); const [voiceReactionCounts,setVoiceReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [voiceMyReactions,setVoiceMyReactions]=useState<Record<string,string[]>>({}); const [authUserId,setAuthUserId]=useState(''); const [text,setText]=useState(''); const [error,setError]=useState(''); const [settingsOpen,setSettingsOpen]=useState(false); const [clearConfirmOpen,setClearConfirmOpen]=useState(false); const [deleteConfirmMessage,setDeleteConfirmMessage]=useState<ChatMessage|null>(null); const [deletingForEveryone,setDeletingForEveryone]=useState(false); const [emojiOpen,setEmojiOpen]=useState(false); const [connected,setConnected]=useState(false); const [connectionState,setConnectionState]=useState<'connected'|'reconnecting'|'offline'>('connected'); const [sending,setSending]=useState(false); const [typingUsers,setTypingUsers]=useState<string[]>([]); const [recordingUsers,setRecordingUsers]=useState<string[]>([]); const publicTypingActiveRef=useRef(false); const [showJump,setShowJump]=useState(false); const [replyTarget,setReplyTarget]=useState<any|null>(null); const [offlineGameOpen,setOfflineGameOpen]=useState(false); const [searchOpen,setSearchOpen]=useState(false); const [mobileMenuOpen,setMobileMenuOpen]=useState(false); const [searchQuery,setSearchQuery]=useState(''); const [newMessageCount,setNewMessageCount]=useState(0); const [highlightedMessageId,setHighlightedMessageId]=useState<string|null>(null); const [copiedId,setCopiedId]=useState<string|null>(null); const [playingVoiceId,setPlayingVoiceId]=useState<string|null>(null); const [playingVoiceElapsed,setPlayingVoiceElapsed]=useState(0); const voiceAudioRef=useRef<HTMLAudioElement|null>(null); const typingStopRef=useRef<number|undefined>(undefined); const replyMetaRef=useRef<Record<string,{replyToId:string;replyToPreview:string;replyToName:string}>>({}); const channelRef=useRef<any>(null); const listRef=useRef<HTMLDivElement>(null); const audioRef=useRef<{send:HTMLAudioElement;receive:HTMLAudioElement}|null>(null); const sessionRef=useRef<any>(null); const pendingRef=useRef<Record<string,{tempId:string;body:string;createdAt:string}>>({}); const sendLockRef=useRef(false);
  const [privateRoom,setPrivateRoom]=useState<any>(()=>{try{return JSON.parse(localStorage.getItem(PRIVATE_CHAT_LOCAL_KEY)||'null')}catch{return null}});
  const [privateModal,setPrivateModal]=useState<'create'|'join'|null>(null);
  const [privateRoomName,setPrivateRoomName]=useState('');
  const [privateJoinCode,setPrivateJoinCode]=useState('');
  const [privateMessages,setPrivateMessages]=useState<any[]>([]);
  const [privateSending,setPrivateSending]=useState(false); const privateSendLockRef=useRef(false);
  const [privateError,setPrivateError]=useState(''); const [highlightedPrivateId,setHighlightedPrivateId]=useState<string|null>(null);
  const replyTargetForPrivate=replyTarget;
  const setReplyTargetForPrivate=setReplyTarget;
  const replyTargetForPrivateRef=useRef<any>(null);
  useEffect(()=>{replyTargetForPrivateRef.current=replyTargetForPrivate},[replyTargetForPrivate]);
  const privateChannelRef=useRef<any>(null); const privatePollRef=useRef<number|undefined>(undefined); const [privateOnline,setPrivateOnline]=useState(0); const [privateTyping,setPrivateTyping]=useState(false); const [privateRecording,setPrivateRecording]=useState(false); const privateTypingStopRef=useRef<number|undefined>(undefined); const privateTypingActiveRef=useRef(false);
  const [yourPrivateChatsOpen,setYourPrivateChatsOpen]=useState(false);
  const [yourPrivateChats,setYourPrivateChats]=useState<any[]>([]);
  const [yourPrivateChatsLoading,setYourPrivateChatsLoading]=useState(false);
  const [hiddenPrivateChatIds,setHiddenPrivateChatIds]=useState<string[]>(()=>readJSON<string[]>(PRIVATE_CHAT_HIDDEN_KEY,[]));
  const [privateRenameRoom,setPrivateRenameRoom]=useState<any>(null); const [privateRenameName,setPrivateRenameName]=useState('');
  const [privateMembersOpen,setPrivateMembersOpen]=useState(false); const [privateMembers,setPrivateMembers]=useState<any[]>([]); const [privateBlockedMembers,setPrivateBlockedMembers]=useState<any[]>([]); const [privateMembersLoading,setPrivateMembersLoading]=useState(false); const [privateMembersError,setPrivateMembersError]=useState('');


  const loadYourPrivateChats=async()=>{
    setYourPrivateChatsLoading(true);
    const hidden=readJSON<string[]>(PRIVATE_CHAT_HIDDEN_KEY,[]);
    setHiddenPrivateChatIds(hidden);

    const {data,error}=await supabase
      .from('private_rooms')
      .select('id,name,join_code,owner_id,created_at')
      .order('created_at',{ascending:false});

    if(!error){
      setYourPrivateChats((data||[]).filter((room:any)=>!hidden.includes(room.id)));
    }
    setYourPrivateChatsLoading(false);
  };

  const removeFromYourPrivateChats=(room:any)=>{
    const current=readJSON<string[]>(PRIVATE_CHAT_HIDDEN_KEY,[]);
    const next=Array.from(new Set([...current,room.id]));
    try{localStorage.setItem(PRIVATE_CHAT_HIDDEN_KEY,JSON.stringify(next))}catch{}
    setHiddenPrivateChatIds(next);
    setYourPrivateChats(prev=>prev.filter(x=>x.id!==room.id));

    if(privateRoom?.id===room.id){
      closePrivateRoom();
      setYourPrivateChatsOpen(false);
    }
  };

  useEffect(()=>{
    if(authUserId)void loadYourPrivateChats();
  },[authUserId]);

  const renamePrivateRoom=async()=>{
    if(!privateRenameRoom)return;
    const name=privateRenameName.trim().replace(/\s+/g,' ');
    if(name.length<2||name.length>40){setPrivateError('Room name must be 2–40 characters.');return;}
    setPrivateSending(true);setPrivateError('');
    try{
      const {data,error}=await supabase.rpc('rename_private_room',{p_room_id:privateRenameRoom.id,p_name:name});
      if(error)throw error;
      const updated={...privateRenameRoom,name:data?.name||name};
      setPrivateRenameRoom(null);setPrivateRenameName('');
      setPrivateRoom((prev:any)=>prev?.id===updated.id?{...prev,name:updated.name}:prev);
      setYourPrivateChats(prev=>prev.map(r=>r.id===updated.id?{...r,name:updated.name}:r));
    }catch(e:any){setPrivateError(e?.message||'Could not rename private chat.');}
    finally{setPrivateSending(false)}
  };
  const loadPrivateMembers=async(roomId:string)=>{setPrivateMembersLoading(true);setPrivateMembersError('');try{const {data,error}=await supabase.rpc('get_private_room_members',{p_room_id:roomId});if(error)throw error;const rows=(data||[]) as any[];setPrivateMembers(rows.filter(x=>!x.is_blocked));setPrivateBlockedMembers(rows.filter(x=>x.is_blocked));}catch(e:any){setPrivateMembersError(e?.message||'Could not load private chat members.');}finally{setPrivateMembersLoading(false)}};
  const openPrivateMembers=async()=>{if(!privateRoom)return;setPrivateMembersOpen(true);await loadPrivateMembers(privateRoom.id)};
  const removePrivateMember=async(member:any)=>{if(!privateRoom||member.user_id===authUserId)return;if(!window.confirm(`Remove ${member.name||'this member'} from this private chat?`))return;const {error}=await supabase.rpc('remove_private_room_member',{p_room_id:privateRoom.id,p_user_id:member.user_id});if(error){setPrivateMembersError(error.message);return}await loadPrivateMembers(privateRoom.id)};
  const blockPrivateMember=async(member:any)=>{if(!privateRoom||member.user_id===authUserId)return;if(!window.confirm(`Block ${member.name||'this member'} from this private chat?`))return;const {error}=await supabase.rpc('block_private_room_member',{p_room_id:privateRoom.id,p_user_id:member.user_id});if(error){setPrivateMembersError(error.message);return}await loadPrivateMembers(privateRoom.id)};
  const unblockPrivateMember=async(member:any)=>{if(!privateRoom)return;const {error}=await supabase.rpc('unblock_private_room_member',{p_room_id:privateRoom.id,p_user_id:member.user_id});if(error){setPrivateMembersError(error.message);return}await loadPrivateMembers(privateRoom.id)};

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
  const play=(which:'send'|'receive')=>{if(!settings.sound||!audioRef.current)return;const a=audioRef.current[which];a.currentTime=0;a.play().catch(()=>{});}; const playAction=(src:string)=>{if(!settings.sound)return;const a=new Audio(src);a.volume=0.45;a.play().catch(()=>{});};
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
      channel=supabase.channel('global-chat',{config:{presence:{key:selfId},broadcast:{self:false,ack:true}}});
      channelRef.current=channel;
      channel
        .on('presence',{event:'sync'},presenceUsers)
        .on('presence',{event:'join'},presenceUsers)
        .on('presence',{event:'leave'},presenceUsers)
        .on('broadcast',{event:'typing',config:{self:false}},({payload}:any)=>{
          const id=payload?.userId;
          if(!id||id===selfId)return;
          if(payload?.typing){setTypingUsers(prev=>prev.includes(id)?prev:[...prev,id]);window.setTimeout(()=>setTypingUsers(prev=>prev.filter(x=>x!==id)),1800)}
          else setTypingUsers(prev=>prev.filter(x=>x!==id));
        })
        .on('broadcast',{event:'recording',config:{self:false}},({payload}:any)=>{
          const id=payload?.userId;
          if(!id||id===selfId)return;
          if(payload?.recording){setRecordingUsers(prev=>prev.includes(id)?prev:[...prev,id]);window.setTimeout(()=>setRecordingUsers(prev=>prev.filter(x=>x!==id)),3500)}
          else setRecordingUsers(prev=>prev.filter(x=>x!==id));
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
    const ch=channelRef.current;
    if(!ch||!authUserId)return;
    if(typingStopRef.current)window.clearTimeout(typingStopRef.current);
    if(value.trim()){
      if(!publicTypingActiveRef.current){
        publicTypingActiveRef.current=true;
        void ch.send({type:'broadcast',event:'typing',payload:{userId:authUserId,typing:true}});
      }
      typingStopRef.current=window.setTimeout(()=>{
        publicTypingActiveRef.current=false;
        setTypingUsers(prev=>prev.filter(id=>id!==authUserId));
        void channelRef.current?.send({type:'broadcast',event:'typing',payload:{userId:authUserId,typing:false}});
      },1400);
    }else{
      publicTypingActiveRef.current=false;
      void ch.send({type:'broadcast',event:'typing',payload:{userId:authUserId,typing:false}});
    }
  };
  const broadcastPublicRecording=(active:boolean)=>{if(authUserId&&channelRef.current)void channelRef.current.send({type:'broadcast',event:'recording',payload:{userId:authUserId,recording:active}})};
  const stopRecording=()=>{if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);recordingTimerRef.current=undefined;const r=mediaRecorderRef.current;if(!r)return;mediaRecorderRef.current=null;broadcastPublicRecording(false);r.stop();setRecording(false);};
  const requestMic=async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone recording is not supported in this browser.');const stream=await navigator.mediaDevices.getUserMedia({audio:true});setMicPermission('granted');setMicNotice(false);return stream}catch(e:any){setMicPermission('denied');setMicNotice(true);setError(e?.name==='NotAllowedError'?'Microphone permission was denied. Please allow microphone access in your browser site settings.':(e?.message||'Microphone access is unavailable.'));return null}};
  const startRecording=async()=>{if(recording||sending)return;if(!navigator.onLine){setError('You are offline. Please reconnect before recording.');return}const stream=await requestMic();if(!stream)return;try{const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x))||'';const recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:24000}:undefined);mediaRecorderRef.current=recorder;mediaChunksRef.current=[];recordingStartedRef.current=Date.now();setRecordingSeconds(0);setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setError('');setRecording(true);setRecordingStream(stream);broadcastPublicRecording(true);recorder.ondataavailable=e=>{if(e.data.size)mediaChunksRef.current.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());setRecordingStream(null);const elapsed=Math.min(60000,Date.now()-recordingStartedRef.current);const blob=new Blob(mediaChunksRef.current,{type:recorder.mimeType||'audio/webm'});mediaChunksRef.current=[];const autoSend=sendAfterRecordingRef.current;const reply=sendAfterRecordingReplyRef.current;sendAfterRecordingRef.current=false;sendAfterRecordingReplyRef.current={messageId:null,voiceId:null};if(elapsed<500){setError('Voice message is too short.');setRecordingSeconds(0);return}if(blob.size>350*1024){setError('Voice message is too large. Please record a shorter message.');setRecordingSeconds(0);return}setRecordingSeconds(Math.floor(elapsed/1000));if(autoSend){const ok=await uploadVoice(blob,elapsed,reply.messageId,reply.voiceId);if(ok){setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setRecordingSeconds(0);setReplyTarget(null)}else{setRecordedVoiceBlob(blob);setRecordedVoiceDuration(elapsed)}}else{setRecordedVoiceBlob(blob);setRecordedVoiceDuration(elapsed)}};recorder.start(250);recordingTimerRef.current=window.setInterval(()=>{const elapsed=Math.floor((Date.now()-recordingStartedRef.current)/1000);if(elapsed>=60){stopRecording();return}setRecordingSeconds(elapsed)},200)}catch{stream.getTracks().forEach(t=>t.stop());setRecording(false);setError('Could not start microphone recording. Please try again.')}};
  const uploadVoice=async(blob:Blob,duration:number,replyToMessageId:string|null=null,replyToVoiceId:string|null=null)=>{setError('');setSending(true);try{const ext=blob.type.includes('mp4')?'m4a':'webm';const file=new File([blob],`voice.${ext}`,{type:blob.type||'audio/webm'});const form=new FormData();form.append('audio',file);form.append('durationMs',String(duration));if(replyToMessageId)form.append('replyToMessageId',replyToMessageId);if(replyToVoiceId)form.append('replyToVoiceId',replyToVoiceId);const {data,error}=await supabase.functions.invoke('send-voice',{body:form});if(error||data?.error)throw new Error(data?.error||'Unable to send voice message.');if(data?.message)setVoiceMessages(prev=>[...prev.filter(v=>v.id!==data.message.id),data.message as VoiceMessage].sort((a,b)=>a.created_at.localeCompare(b.created_at)));play('send');return true;}catch(e:any){setError(e.message||'Unable to send voice message.');return false}finally{setSending(false)}};
  const sendRecordingNow=()=>{if(!recording||sending)return;sendAfterRecordingRef.current=true;sendAfterRecordingReplyRef.current={messageId:replyTarget?.reply_to_voice_id?null:(replyTarget?.id&&!String(replyTarget.id).startsWith('voice-reply-')?replyTarget.id:null),voiceId:replyTarget?.reply_to_voice_id||null};stopRecording()}; const sendRecordedVoice=async()=>{if(!recordedVoiceBlob||sending)return;const blob=recordedVoiceBlob;const duration=recordedVoiceDuration;const ok=await uploadVoice(blob,duration,replyTarget?.reply_to_voice_id?null:(replyTarget?.id&&!String(replyTarget.id).startsWith('voice-reply-')?replyTarget.id:null),replyTarget?.reply_to_voice_id||null);if(ok){setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setRecordingSeconds(0);setReplyTarget(null)}};
  const cancelRecording=()=>{sendAfterRecordingRef.current=false;sendAfterRecordingReplyRef.current={messageId:null,voiceId:null};broadcastPublicRecording(false);if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);recordingTimerRef.current=undefined;const r=mediaRecorderRef.current;mediaRecorderRef.current=null;if(r){r.onstop=null;if(r.state!=='inactive')r.stop();r.stream.getTracks().forEach(t=>t.stop())}mediaChunksRef.current=[];setRecording(false);setRecordingStream(null);setRecordingSeconds(0);setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);};
  const toggleVoicePlayback=async(v:VoiceMessage)=>{if(playingVoiceId===v.id){voiceAudioRef.current?.pause();setPlayingVoiceId(null);return}if(voiceAudioRef.current){voiceAudioRef.current.pause();voiceAudioRef.current=null}setPlayingVoiceElapsed(0);let audioUrl=v.audio_url;if(v.storage_path){const {data}=await supabase.storage.from('voice-messages').createSignedUrl(v.storage_path,3600);if(data?.signedUrl)audioUrl=data.signedUrl}const a=new Audio(audioUrl);voiceAudioRef.current=a;setPlayingVoiceId(v.id);a.ontimeupdate=()=>setPlayingVoiceElapsed(a.currentTime);a.onended=()=>{setPlayingVoiceElapsed(0);setPlayingVoiceId(null)};a.onerror=()=>{setPlayingVoiceElapsed(0);setPlayingVoiceId(null);setError('Could not play this voice message.')};void a.play().catch(()=>{setPlayingVoiceId(null);setError('Could not play this voice message.')})};
  const deleteVoiceForMe=(v:VoiceMessage)=>{playAction('/sounds/send.wav');const next={...readVoiceLocalDeleted(),[v.id]:new Date(v.expires_at).getTime()};setVoiceLocalDeleted(next);persistVoiceLocalDeleted(next);setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id))};
  const deleteVoiceForEveryone=async(v:VoiceMessage)=>{playAction('/sounds/send.wav');if(v.user_id!==authUserId)return;const session=sessionRef.current;const {data,error}=await supabase.functions.invoke('delete-voice-for-everyone',{body:{voiceId:v.id,userId:authUserId},headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});if(error||data?.error){setError(data?.error||'Could not delete this voice message.');return}setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id));if(playingVoiceId===v.id){voiceAudioRef.current?.pause();setPlayingVoiceId(null)}};
  useEffect(()=>()=>{voiceAudioRef.current?.pause();if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);mediaRecorderRef.current?.stream.getTracks().forEach(t=>t.stop())},[]);
  const beginReply=(m:ChatMessage)=>{if(m.id.startsWith('optimistic-'))return;setReplyTarget(m);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())};
  const beginVoiceReply=(v:VoiceMessage)=>{const target={...v,id:`voice-reply-${v.id}`,reply_to_voice_id:v.id,body:`Voice message • ${formatDuration(v.duration_ms)}`};setReplyTarget(target);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())};
  const handlePrivateTyping=(value:string)=>{
    const ch=privateChannelRef.current;
    if(!ch||!authUserId)return;
    if(privateTypingStopRef.current)window.clearTimeout(privateTypingStopRef.current);
    if(value.trim()){
      if(!privateTypingActiveRef.current){
        privateTypingActiveRef.current=true;
        void ch.send({type:'broadcast',event:'private-typing',payload:{userId:authUserId,typing:true}});
      }
      privateTypingStopRef.current=window.setTimeout(()=>{
        privateTypingActiveRef.current=false;
        void privateChannelRef.current?.send({type:'broadcast',event:'private-typing',payload:{userId:authUserId,typing:false}});
      },1800);
    }else{
      privateTypingActiveRef.current=false;
      void ch.send({type:'broadcast',event:'private-typing',payload:{userId:authUserId,typing:false}});
    }
  };
  const send=async()=>{if(sendLockRef.current)return;sendLockRef.current=true;setError('');const body=text.trim();const problem=validateMessage(text);if(problem){setError(problem);sendLockRef.current=false;return}const duplicate=messagesRef.current.some(m=>m.user_id===authUserId&&m.body===body&&Date.now()-new Date(m.created_at).getTime()<10000&&!m.id.startsWith('optimistic-'));if(duplicate){setError('Please do not send the same message again so quickly.');sendLockRef.current=false;return}const tempId=`optimistic-${crypto.randomUUID()}`;const createdAt=new Date().toISOString();const optimistic:ChatMessage={id:tempId,user_id:authUserId,name:profile.name,country:profile.country,subdivision:profile.subdivision,avatar_id:profile.avatarId,body,created_at:createdAt,expires_at:new Date(Date.now()+5*60*1000).toISOString(),reply_to_id:replyTarget?.reply_to_voice_id?null:replyTarget?.id||null,reply_to_voice_id:replyTarget?.reply_to_voice_id||null,reply_to_preview:replyTarget?.body||null,reply_to_name:replyTarget?.name||null};pendingRef.current[tempId]={tempId,body,createdAt};setText('');setEmojiOpen(false);const sentReply=replyTarget;setReplyTarget(null);setMessages(prev=>prev.some(m=>m.id===tempId)?prev:[...prev,optimistic]);play('send');setSending(true);try{let session=sessionRef.current;if(!session){const {data}=await supabase.auth.getSession();session=data.session;sessionRef.current=session}const {data,error}=await supabase.functions.invoke('send-message',{body:{text:body,profile,replyToId:sentReply&&!sentReply.reply_to_voice_id&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,replyToVoiceId:sentReply?.reply_to_voice_id||null},headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});if(error||data?.error)throw new Error(data?.error||'Unable to send message.');const serverMessage={...(data?.message||data) as ChatMessage,reply_to_id:sentReply&&!sentReply.reply_to_voice_id&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,reply_to_voice_id:sentReply?.reply_to_voice_id||null,reply_to_preview:sentReply?.body||null,reply_to_name:sentReply?.name||null};setMessages(prev=>{if(serverMessage?.id&&prev.some(m=>m.id===serverMessage.id))return prev;const exists=prev.some(m=>m.id===tempId);return exists&&serverMessage?.id?prev.map(m=>m.id===tempId?serverMessage:m):prev});delete pendingRef.current[tempId];if(sentReply&&!sentReply.id.startsWith('optimistic-')&&serverMessage?.id&&channelRef.current)void channelRef.current.send({type:'broadcast',event:'message-meta',payload:{messageId:serverMessage.id,replyToId:sentReply.id,replyToPreview:sentReply.body,replyToName:sentReply.name}})}catch(e:any){setMessages(prev=>prev.filter(m=>m.id!==tempId));delete pendingRef.current[tempId];setError(e.message||'Unable to send message. Please try again.')}finally{setSending(false);sendLockRef.current=false}};
  const persistLocalDeleted=(next:Record<string,number>)=>{setLocalDeleted(next);try{localStorage.setItem(LOCAL_DELETED_KEY,JSON.stringify(next))}catch{}};
  const deleteLocally=(m:ChatMessage)=>{if(!canLocalDelete(m))return;const key=localMessageKey(m);const next={...readLocalDeleted(),[key]:new Date(m.expires_at).getTime()};persistLocalDeleted(next);setMessages(prev=>prev.filter(x=>localMessageKey(x)!==key))};
  const deleteForEveryone=async(m:ChatMessage)=>{if(!canLocalDelete(m)||m.user_id!==authUserId)return;setDeletingForEveryone(true);setError('');try{const {data,error}=await supabase.rpc('delete_message_for_everyone',{p_message_id:m.id});if(error)throw error;if(data!==true)throw new Error('This message could not be deleted for everyone.');deleteLocally(m);setDeleteConfirmMessage(null)}catch{setError('Could not delete this message for everyone. Please try again.')}finally{setDeletingForEveryone(false)}};
  const closePrivateRoom=()=>{
    if(privateChannelRef.current){void supabase.removeChannel(privateChannelRef.current);privateChannelRef.current=null}
    if(privatePollRef.current){window.clearInterval(privatePollRef.current);privatePollRef.current=undefined}
    if(privateTypingStopRef.current){window.clearTimeout(privateTypingStopRef.current);privateTypingStopRef.current=undefined}
    privateTypingActiveRef.current=false;
    try{localStorage.removeItem(PRIVATE_CHAT_LOCAL_KEY)}catch{}
    setPrivateRoom(null);
    setPrivateMessages([]);
  };
  const loadPrivateMessages=async(roomId:string)=>{
    const {data,error}=await supabase.from('private_messages').select('*').eq('room_id',roomId).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100);
    if(!error)setPrivateMessages(data||[]);
  };
  const enterPrivateRoom=async(room:any)=>{
    setPrivateRoom(room);
    setPrivateOnline(0);
    setPrivateTyping(false);
    setPrivateRecording(false);
    try{localStorage.setItem(PRIVATE_CHAT_LOCAL_KEY,JSON.stringify(room))}catch{}
    await loadPrivateMessages(room.id);
    if(privateChannelRef.current)void supabase.removeChannel(privateChannelRef.current);
    if(privatePollRef.current)window.clearInterval(privatePollRef.current);
    const ch:any=supabase.channel('private-room-'+room.id,{config:{presence:{key:authUserId},broadcast:{self:false,ack:true}}})
      .on('presence',{event:'sync'},()=>{
        const state=ch.presenceState() as Record<string,any[]>;
        setPrivateOnline(Object.keys(state).length);
      })
      .on('presence',{event:'join'},()=>{
        const state=ch.presenceState() as Record<string,any[]>;
        setPrivateOnline(Object.keys(state).length);
      })
      .on('presence',{event:'leave'},()=>{
        const state=ch.presenceState() as Record<string,any[]>;
        setPrivateOnline(Object.keys(state).length);
      })       .on('broadcast' as any,{event:'private-typing',config:{self:false}},({payload}:any)=>{
        if(payload?.userId!==authUserId){
          setPrivateTyping(Boolean(payload?.typing));
          if(payload?.typing)window.setTimeout(()=>setPrivateTyping(false),1800);
        }
      })
      .on('broadcast' as any,{event:'private-recording',config:{self:false}},({payload}:any)=>{
        if(payload?.userId!==authUserId){
          setPrivateRecording(Boolean(payload?.recording));
          if(payload?.recording)window.setTimeout(()=>setPrivateRecording(false),3500);
        }
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'private_messages',filter:'room_id=eq.'+room.id},
        payload=>setPrivateMessages(prev=>{const incoming:any=payload.new;if(prev.some(m=>m.id===incoming.id))return prev;const optimistic=prev.find(m=>String(m.id).startsWith('optimistic-private-')&&m.user_id===incoming.user_id&&m.body===incoming.body&&Math.abs(new Date(m.created_at).getTime()-new Date(incoming.created_at).getTime())<15000);if(optimistic)return prev.map(m=>m.id===optimistic.id?incoming:m).sort((a,b)=>a.created_at.localeCompare(b.created_at));return [...prev,incoming].sort((a,b)=>a.created_at.localeCompare(b.created_at))}))
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'private_messages',filter:'room_id=eq.'+room.id},
        payload=>setPrivateMessages(prev=>prev.filter(m=>m.id!==payload.old.id)));
    privateChannelRef.current=ch;
    ch.subscribe(async (status:any)=>{
      if(status==='SUBSCRIBED'){
        try{
          await ch.track({
            userId:authUserId,
            name:profile.name,
            online_at:new Date().toISOString()
          });
          const state=ch.presenceState() as Record<string,any[]>;
          setPrivateOnline(Object.keys(state).length);
        }catch{
          setPrivateOnline(0);
        }
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        setPrivateOnline(0);
      }
    });
    privatePollRef.current=window.setInterval(()=>{void (async()=>{const {data,error}=await supabase.from('private_room_members').select('user_id').eq('room_id',room.id).eq('user_id',authUserId).maybeSingle();if(!error&&!data){closePrivateRoom()}})()},5000);
  };
  useEffect(()=>{
    if(authUserId&&privateRoom?.id)void enterPrivateRoom(privateRoom);
    return()=>{
      if(privateChannelRef.current){void supabase.removeChannel(privateChannelRef.current);privateChannelRef.current=null}
      if(privatePollRef.current){window.clearInterval(privatePollRef.current);privatePollRef.current=undefined}
    }
  },[authUserId,privateRoom?.id]);
  const createPrivateRoom=async()=>{setPrivateError('');if(privateRoomName.trim().length<2){setPrivateError('Room name needs 2+ characters.');return}setPrivateSending(true);try{const {data,error}=await supabase.rpc('create_private_room',{p_name:privateRoomName.trim().slice(0,40)});if(error)throw error;const room={id:data.room_id,name:data.room_name,join_code:data.join_code,owner:true,owner_id:authUserId};setPrivateModal(null);setPrivateRoomName('');setPrivateRoom(room)}catch(e){const x=e as any;setPrivateError(x?.message||x?.details||x?.hint||x?.code||'Could not create private chat.')}finally{setPrivateSending(false)}};
  const joinPrivateRoom=async()=>{setPrivateError('');const code=privateJoinCode.trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(code)){setPrivateError('Enter a valid 8-character room code.');return}setPrivateSending(true);try{const {data,error}=await supabase.rpc('join_private_room',{p_join_code:code});if(error)throw error;const room={id:data.room_id,name:data.room_name,join_code:code,owner:Boolean(data.owner),owner_id:data.owner_id||null};setPrivateModal(null);setPrivateJoinCode('');setPrivateRoom(room)}catch(e){setPrivateError(e instanceof Error?e.message:'Invalid room code.')}finally{setPrivateSending(false)}};
  const playPrivateAction=(src:string)=>{if(!settings.sound)return;const a=new Audio(src);a.volume=0.42;void a.play().catch(()=>{});};
   const sendPrivateMessage=async()=>{const body=text.trim();if(privateSendLockRef.current||!privateRoom||!body||privateSending)return;privateSendLockRef.current=true;setPrivateSending(true);setPrivateError('');const replyTo=replyTargetForPrivateRef.current;const tempId='optimistic-private-'+crypto.randomUUID();const optimistic={id:tempId,room_id:privateRoom.id,user_id:authUserId,name:profile.name,country:profile.country,subdivision:profile.subdivision,avatar_id:profile.avatarId,body,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+5*60*1000).toISOString(),reply_to_id:replyTo?.reply_to_voice_id?null:replyTo?.id||null,reply_to_voice_id:replyTo?.reply_to_voice_id||null,reply_to_preview:replyTo?.body||'Voice message',reply_to_name:replyTo?.name||null};setText('');setReplyTargetForPrivate(null);setPrivateMessages(prev=>[...prev,optimistic].sort((a,b)=>a.created_at.localeCompare(b.created_at)));playPrivateAction('/sounds/send.wav');try{const {data,error}=await supabase.rpc('send_private_message',{p_room_id:privateRoom.id,p_name:profile.name,p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatarId,p_body:body.slice(0,500),p_reply_to_id:replyTo?.reply_to_voice_id?null:replyTo?.id||null,p_reply_to_voice_id:replyTo?.reply_to_voice_id||null});if(error)throw error;if(data)setPrivateMessages(prev=>prev.map(m=>m.id===tempId?data:m).sort((a,b)=>a.created_at.localeCompare(b.created_at)))}catch(e){setPrivateMessages(prev=>prev.filter(m=>m.id!==tempId));const x=e as any;setPrivateError(x?.message||x?.details||x?.hint||x?.code||JSON.stringify(x)||'Could not send private message.')}finally{setPrivateSending(false);privateSendLockRef.current=false}};
  const clearChatLocally=()=>{const current=readLocalDeleted();const now=Date.now();messages.forEach(m=>{if(new Date(m.expires_at).getTime()>now)current[localMessageKey(m)]=new Date(m.expires_at).getTime()});persistLocalDeleted(current);setMessages([]);const voiceCurrent=readVoiceLocalDeleted();voiceMessages.forEach(v=>{if(new Date(v.expires_at).getTime()>now)voiceCurrent[v.id]=new Date(v.expires_at).getTime()});persistVoiceLocalDeleted(voiceCurrent);setVoiceLocalDeleted(voiceCurrent);setVoiceMessages([])};
  const onKey=(e:React.KeyboardEvent)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
  return <div className="chat-app"><header className="topbar"><div className="top-brand"><img className="brand-mini brand-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" /><div><b>GLOBAL CHAT</b><span><i className={connected?'online-dot':'offline-dot'}></i>{online} Online</span></div></div><div className="top-actions"><button className="private-top-btn" onClick={()=>{setPrivateError('');setPrivateJoinCode('');setPrivateModal('join')}} aria-label="Join Private Chat" title="Join Private Chat"><KeyRound size={17}/><span className="private-top-label">JOIN PRIVATE CHAT</span></button><button className="private-top-btn" onClick={()=>{setPrivateError('');setPrivateRoomName('');setPrivateModal('create')}} aria-label="Create Private Chat" title="Create Private Chat"><Plus size={17}/><span className="private-top-label">CREATE PRIVATE CHAT</span></button><button className="private-top-btn your-private-chats-top-btn" onClick={()=>{setYourPrivateChatsOpen(true);void loadYourPrivateChats()}} aria-label="Your Private Chats" title="Your Private Chats"><span className="your-private-chats-icon"><Users size={17}/></span><span className="private-top-label">YOUR PRIVATE CHATS</span></button><button className="header-icon" onClick={()=>setSearchOpen(v=>!v)} aria-label="Search active messages" title="Search active messages"><Search size={17}/></button><button className="header-icon clear-chat-btn" onClick={()=>setClearConfirmOpen(true)} aria-label="Clear Chat" title="Clear Chat"><Trash2 size={17}/></button><button className="settings-btn" onClick={()=>setSettingsOpen(true)} aria-label="Settings" title="Settings"><Settings size={18}/></button><div className="mobile-header-menu"><button className="mobile-menu-trigger" onClick={()=>setMobileMenuOpen(v=>!v)} aria-label="More options" title="More options"><MoreVertical size={19} aria-hidden="true"/></button>{mobileMenuOpen&&<div className="mobile-menu-dropdown"><button onClick={()=>{setSearchOpen(true);setMobileMenuOpen(false)}}><Search size={17}/><span>Search</span></button><button onClick={()=>{setClearConfirmOpen(true);setMobileMenuOpen(false)}}><Trash2 size={17}/><span>Clear Chat</span></button><button onClick={()=>{setSettingsOpen(true);setMobileMenuOpen(false)}}><Settings size={17}/><span>Settings</span></button></div>}</div></div></header>
    <div className={`connection-banner ${connectionState}`}><span>{connectionState==='connected'?<Wifi size={13}/>:connectionState==='offline'?<WifiOff size={13}/>:<Wifi size={13}/>}</span>{connectionState==='connected'?'Connected':connectionState==='offline'?'Offline — game mode available':'Reconnecting…'}</div>
    <main className="chat-main">{privateRoom&&authUserId?<PrivateRoomView profile={profile} room={privateRoom} messages={privateMessages} setMessages={setPrivateMessages} text={text} setText={setText} sending={privateSending} sendError={privateError} privateOnline={privateOnline} privateTyping={privateTyping} onTyping={handlePrivateTyping} sound={settings.sound} replyTarget={replyTargetForPrivate} setReplyTarget={setReplyTargetForPrivate} currentUserId={authUserId} onSend={()=>void sendPrivateMessage()} onClose={closePrivateRoom} onCopy={async(m:any)=>{try{await navigator.clipboard.writeText(m.body)}catch{}}} onMembers={()=>void openPrivateMembers()} privateRecording={privateRecording} onRecording={active=>{if(privateChannelRef.current&&authUserId)void privateChannelRef.current.send({type:'broadcast',event:'private-recording',payload:{userId:authUserId,recording:active}})}}/>:privateRoom?<div className="private-message-list private-empty-loading">Loading private chat...</div>:!authUserId?<div className="private-message-list private-empty-loading">Connecting...</div>:<>{searchOpen&&<div className="chat-search"><Search size={16}/><input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search active messages..." aria-label="Search active messages"/><span>{displayedMessages.length}/{messages.length}</span></div>}<div className="message-list" ref={listRef} onScroll={handleScroll}>{messages.length===0&&voiceMessages.length===0?<div className="empty"><video className="empty-earth-video" autoPlay muted playsInline loop preload="auto" aria-hidden="true"><source src="/earth-animation.mp4" type="video/mp4"/></video><h2>Talk to the world</h2><p>Say hello. Share ideas. Keep it friendly.</p></div>:<>{[...displayedMessages.map(data=>({kind:'text' as const,data})),...voiceMessages.filter(v=>!activeSearch||`${v.name} voice message`.toLowerCase().includes(activeSearch)).map(data=>({kind:'voice' as const,data}))].sort((a,b)=>a.data.created_at.localeCompare(b.data.created_at)).map(item=>item.kind==='text'?<Message key={item.data.id} m={item.data} current={item.data.user_id===authUserId} timeFormat={settings.timeFormat || '12h'} counts={reactionCounts[item.data.id]||{}} mine={myReactions[item.data.id]||[]} highlighted={highlightedMessageId===item.data.id} copied={copiedId===item.data.id} onCopy={()=>copyMessage(item.data)} onToggle={async(r)=>{const {error}=await supabase.functions.invoke('toggle-reaction',{body:{messageId:item.data.id,reaction:r}});if(!error)refreshReactions(messageIdsRef.current,authUserId)}} onDeleteForMe={()=>deleteLocally(item.data)} onDeleteForEveryone={()=>void deleteForEveryone(item.data)} onReply={()=>beginReply(item.data)} onReplyJump={(id,isVoice)=>{const el=document.getElementById(isVoice?`voice-${id}`:`msg-${id}`);el?.scrollIntoView({behavior:'smooth',block:'center'});if(!isVoice)setHighlightedMessageId(id)}}/>:<VoiceBubble key={`voice-${item.data.id}`} v={item.data} current={item.data.user_id===authUserId} onDeleteForMe={()=>deleteVoiceForMe(item.data)} onDeleteForEveryone={()=>void deleteVoiceForEveryone(item.data)} onReply={()=>beginVoiceReply(item.data)} onReplyJump={(id,isVoice)=>{const el=document.getElementById(isVoice?`voice-${id}`:`msg-${id}`);el?.scrollIntoView({behavior:'smooth',block:'center'});if(!isVoice)setHighlightedMessageId(id)}} timeFormat={settings.timeFormat||'12h'} counts={voiceReactionCounts[item.data.id]||{}} mine={voiceMyReactions[item.data.id]||[]} onToggleReaction={async(r)=>{const {error}=await supabase.functions.invoke('toggle-voice-reaction',{body:{voiceId:item.data.id,reaction:r}});if(!error)refreshVoiceReactions(voiceMessages.map(v=>v.id),authUserId)}}/> )}</>}</div>{showJump&&<button className="jump-latest" onClick={jumpToLatest}><ArrowDown size={15}/>{newMessageCount>0?`${newMessageCount} NEW MESSAGE${newMessageCount===1?'':'S'}`:'LATEST MESSAGES'}</button>}{recordingUsers.length>0&&<div className="typing-indicator recording-indicator">Someone is recording<span className="typing-dots"><i></i><i></i><i></i></span></div>}{typingUsers.length>0&&<div className="typing-indicator">Someone is typing<span className="typing-dots"><i></i><i></i><i></i></span></div>}
        {replyTarget&&<div className="reply-composer"><div><b><ReplyIcon size={14}/> Replying to {replyTarget.name||'User'}</b><span>{replyTarget.reply_to_voice_id?`Voice message • ${formatDuration(replyTarget.duration_ms||0)}`:(replyTarget.body||'Reply')}</span></div><button className="private-modal-cancel" onClick={()=>setReplyTarget(null)} aria-label="CANCEL reply"><X size={16}/></button></div>}
        <div className="composer-wrap">
          {recording||recordedVoiceBlob
            ? <div className="voice-recorder public-voice-recorder public-style-voice-recorder">
                <div className="voice-rec-left">
                  <span className="recording-dot"></span>
                  <strong>{String(Math.floor(recordingSeconds/60)).padStart(2,'0')}:{String(recordingSeconds%60).padStart(2,'0')}</strong>
                </div>
                <LiveRecordingWaveform stream={recording?recordingStream:null}/>
                <div className="recording-actions">
                <button className="voice-cancel" onClick={cancelRecording} aria-label="Delete recording" title="Delete recording"><X size={18}/></button>
                {recording
                  ? <button className="voice-send" onClick={sendRecordingNow} disabled={sending} aria-label="Send voice message" title="Send voice message"><Send size={18}/></button>
                  : <button className="voice-send" onClick={()=>void sendRecordedVoice()} disabled={sending} aria-label="Send voice message" title="Send voice message"><Send size={18}/></button>}
                </div>
              </div>
            : <div className="composer">
                <div className="tools"><button
                  className="icon-btn" onClick={()=>setEmojiOpen(v=>!v)} aria-label="Emoji"
                  title="Emoji"><Smile size={19}/></button>{emojiOpen&&<div
                  className="emoji-pop">{EMOJIS.map((e,i)=><button key={i} onClick={()=>{setText(v=>v+e)
                  ;setEmojiOpen(false)}}>{e}</button>)}</div>}</div>
                <textarea value={text} maxLength={500} onChange={e=>updateTyping(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}}
                  placeholder="Type a message..." rows={1}/>
                <button className="voice-btn"
                  disabled={sending} onClick={()=>void startRecording()} aria-label="Record voice message"
                  title="Voice message"><Mic size={18}/></button>
                <button className="send-btn"
                  disabled={!text.trim()||sending} onClick={()=>void send()} aria-label="Send message"
                  title="Send message"><Send size={18}/></button>
              </div>}
        </div>
    </>}</main>{privateModal&&<PrivateChatModal mode={privateModal} roomName={privateRoomName} setRoomName={setPrivateRoomName} joinCode={privateJoinCode} setJoinCode={setPrivateJoinCode} error={privateError} busy={privateSending} onClose={()=>setPrivateModal(null)} onCreate={()=>void createPrivateRoom()} onJoin={()=>void joinPrivateRoom()}/>} {privateMembersOpen&&privateRoom&&<PrivateMembersModal room={privateRoom} members={privateMembers} blockedMembers={privateBlockedMembers} loading={privateMembersLoading} error={privateMembersError} currentUserId={authUserId} isOwner={privateRoom.owner_id===authUserId} onClose={()=>setPrivateMembersOpen(false)} onRefresh={()=>void loadPrivateMembers(privateRoom.id)} onRemove={(m)=>void removePrivateMember(m)} onBlock={(m)=>void blockPrivateMember(m)} onUnblock={(m)=>void unblockPrivateMember(m)}/>} {yourPrivateChatsOpen&&<YourPrivateChatsModal rooms={yourPrivateChats} loading={yourPrivateChatsLoading} currentRoomId={privateRoom?.id||null} currentUserId={authUserId} onClose={()=>setYourPrivateChatsOpen(false)} onEnter={(room)=>{setYourPrivateChatsOpen(false);void enterPrivateRoom(room)}} onDelete={removeFromYourPrivateChats} onRename={(room)=>{setPrivateRenameRoom(room);setPrivateRenameName(room.name)}}/>} {offlineGameOpen&&<OfflineGame onClose={()=>setOfflineGameOpen(false)}/>} {deleteConfirmMessage&&<div className="delete-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"><div className="delete-modal"><div className="delete-modal-icon"><Trash2 size={20}/></div><h3 id="delete-modal-title">Delete Message?</h3><p>Choose where you want to delete this message.</p><div className="delete-modal-actions"><button className="delete-option-btn" onClick={()=>{deleteLocally(deleteConfirmMessage);setDeleteConfirmMessage(null)}} disabled={deletingForEveryone}><span>Delete for me</span><small>Remove only from your chat</small></button>{deleteConfirmMessage.user_id===authUserId&&<button className="delete-option-btn danger" onClick={()=>void deleteForEveryone(deleteConfirmMessage)} disabled={deletingForEveryone}><span>{deletingForEveryone?'Deleting…':'Delete for everyone'}</span><small>Remove from everyone’s chat</small></button>}<button className="private-modal-cancel clear-cancel-btn" onClick={()=>setDeleteConfirmMessage(null)} disabled={deletingForEveryone}>CANCEL</button></div></div></div>} {clearConfirmOpen&&<div className="clear-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="clear-modal-title"><div className="clear-modal"><div className="clear-modal-icon"><Trash2 size={20}/></div><h3 id="clear-modal-title">Clear Chat?</h3><p>Clear all currently visible messages on this device?</p><span>Messages on other devices will not be deleted.</span><div className="clear-modal-actions"><button className="private-modal-cancel clear-cancel-btn" onClick={()=>setClearConfirmOpen(false)}>CANCEL</button><button className="clear-confirm-btn" onClick={()=>{clearChatLocally();setClearConfirmOpen(false)}}>CLEAR CHAT</button></div></div></div>}{privateRenameRoom&&<div className="private-modal-backdrop" role="dialog" aria-modal="true"><div className="private-modal"><div className="panel-head"><div><b><Pencil size={17}/> RENAME PRIVATE CHAT</b><span>Only the room creator can rename it</span></div><button onClick={()=>setPrivateRenameRoom(null)}><X/></button></div><label>Room Name</label><input maxLength={40} value={privateRenameName} onChange={e=>setPrivateRenameName(e.target.value)} autoFocus/><div className="private-modal-actions"><button className="private-modal-cancel" onClick={()=>setPrivateRenameRoom(null)}>CANCEL</button><button className="primary-btn" disabled={privateSending} onClick={()=>void renamePrivateRoom()}>{privateSending?'SAVING…':'SAVE NAME'}</button></div></div></div>} {settingsOpen&&<SettingsPanel profile={profile} settings={settings} onClose={()=>setSettingsOpen(false)} onSave={async(p,s)=>{try{const {error}=await supabase.functions.invoke('save-profile',{body:p});if(error)throw error;onProfile(p);onSettings(s);localStorage.setItem(PROFILE_KEY,JSON.stringify(p));localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));setSettingsOpen(false)}catch{setError('Could not save settings. Please try again.')}}}/>}</div>
}

function formatMessageTime(value:string,format:TimeFormat){return new Intl.DateTimeFormat(undefined,{hour:format==='24h'?'2-digit':'numeric',minute:'2-digit',hour12:format==='12h'}).format(new Date(value))}
function formatDuration(ms:number){const total=Math.max(0,Math.round((ms||0)/1000));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`}

const Message=memo(function Message({m,current,counts,mine,onToggle,onDeleteForMe,onDeleteForEveryone,onReply,onCopy,onReplyJump,highlighted,copied,timeFormat}:{m:ChatMessage;current:boolean;counts:Record<string,number>;mine:string[];onToggle:(r:string)=>Promise<void>;onDeleteForMe:()=>void;onDeleteForEveryone:()=>void;onReply:()=>void;onCopy:()=>void;onReplyJump:(id:string,isVoice:boolean)=>void;highlighted:boolean;copied:boolean;timeFormat:TimeFormat}){
  const [expanded,setExpanded]=useState(false);
  const [menu,setMenu]=useState(false);
  const isLong=m.body.length>250;
  const visibleBody=!isLong||expanded?m.body:m.body.slice(0,250)+'…';
  const countryName=iso31661.find(c=>c.alpha2===m.country)?.name??m.country;
  const subdivisionName=iso31662.find(s=>s.code===m.subdivision)?.name??m.subdivision.split('-').pop()??m.subdivision;
  const canDeleteForEveryone=current&&!m.id.startsWith('optimistic-')&&canLocalDelete(m);
  const canDeleteForMe=canLocalDelete(m);
  return <article id={`msg-${m.id}`} className={`private-message public-message ${current?'mine':''} ${highlighted?'highlighted':''}`}>
    <div className="message-identity"><img className="message-avatar" src={avatarSrc(m.avatar_id)} alt=""/><div><strong>{m.name}</strong><span>{flag(m.country)} {subdivisionName}, {countryName}</span></div></div>
    {(m.reply_to_id||m.reply_to_voice_id)&&<button className="reply-preview" onClick={()=>onReplyJump((m.reply_to_voice_id||m.reply_to_id)!,Boolean(m.reply_to_voice_id))}><ReplyIcon size={13}/><span><b>{m.reply_to_name||'User'}</b>{m.reply_to_preview||'Reply'}</span></button>}
    <div className="private-bubble"><span>{visibleBody}</span>{isLong&&<button type="button" className="read-more-btn" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'Read more'}</button>}<time>{formatMessageTime(m.created_at,timeFormat)}</time></div>
    <div className="private-item-actions">
      {REACTIONS.map(r=><button key={r} className={mine.includes(r)?'reacted':''} onClick={()=>void onToggle(r)}>{r}{counts[r]?<small>{counts[r]}</small>:null}</button>)}
      <button onClick={onReply} aria-label="Reply" title="Reply"><ReplyIcon size={13}/></button>
      <button onClick={onCopy} aria-label="Copy" title={copied?'Copied':'Copy'}>{copied?<Check size={13}/>:<Copy size={13}/>}</button>
      {(canDeleteForMe||canDeleteForEveryone)&&<button onClick={()=>setMenu(v=>!v)} aria-label="Message options" title="Message options"><MoreVertical size={15}/></button>}
      {menu&&<div className="private-item-menu">
        <button onClick={()=>{onReply();setMenu(false)}}><ReplyIcon size={14}/> Reply</button>
        {canDeleteForMe&&<button onClick={()=>{onDeleteForMe();setMenu(false)}}><Trash2 size={14}/> Delete for me</button>}
        {canDeleteForEveryone&&<button className="danger" onClick={()=>{onDeleteForEveryone();setMenu(false)}}><Trash2 size={14}/> Delete for everyone</button>}
        <button onClick={()=>setMenu(false)}><X size={14}/> Cancel</button>
      </div>}
    </div>
  </article>
});
function LiveRecordingWaveform({stream}:{stream:MediaStream|null}){
  const [levels,setLevels]=useState<number[]>(()=>Array.from({length:34},(_,i)=>0.18+((i*7)%9)/30));
  useEffect(()=>{
    if(!stream){setLevels(Array.from({length:34},(_,i)=>0.18+((i*7)%9)/30));return;}
    const AudioCtx=(window.AudioContext||(window as any).webkitAudioContext) as typeof AudioContext|undefined;
    if(!AudioCtx)return;
    let ctx:AudioContext|undefined;
    let source:MediaStreamAudioSourceNode|undefined;
    let analyser:AnalyserNode|undefined;
    let raf=0;
    try{
      ctx=new AudioCtx();
      source=ctx.createMediaStreamSource(stream);
      analyser=ctx.createAnalyser();
      analyser.fftSize=256;
      analyser.smoothingTimeConstant=.72;
      source.connect(analyser);
      const data=new Uint8Array(analyser.fftSize);
      const draw=()=>{
        if(!analyser)return;
        analyser.getByteTimeDomainData(data);
        const next=Array.from({length:34},(_,i)=>{
          const start=Math.floor(i*data.length/34),end=Math.max(start+1,Math.floor((i+1)*data.length/34));
          let sum=0;
          for(let j=start;j<end;j++)sum+=Math.abs(data[j]-128)/128;
          const amp=sum/(end-start);
          return Math.min(1,Math.max(.12,.16+amp*2.8));
        });
        setLevels(next);
        raf=requestAnimationFrame(draw);
      };
      void ctx.resume().catch(()=>{});
      raf=requestAnimationFrame(draw);
    }catch{
      // CSS fallback waveform remains visible if Web Audio is unavailable.
    }
    return()=>{
      cancelAnimationFrame(raf);
      try{source?.disconnect();}catch{}
      void ctx?.close().catch(()=>{});
    };
  },[stream]);
  return <div className="recording-wave live-recording-wave" aria-label={stream?'Live recording waveform':'Recorded voice waveform'}>{levels.map((level,i)=><i key={i} className={stream?'active':''} style={{height:`${Math.round(6+level*25)}px`}}/>)}</div>;
}

function VoicePlayer({v,bucket='voice-messages'}:{v:any;bucket?:string}){const [playing,setPlaying]=useState(false);const [current,setCurrent]=useState(0);const [duration,setDuration]=useState(Math.max(0,(v.duration_ms||0)/1000));const [rate,setRate]=useState(1);const audioRef=useRef<HTMLAudioElement|null>(null);useEffect(()=>()=>{audioRef.current?.pause()},[]);const load=async()=>{let url=typeof v.audio_url==='string'?v.audio_url:'';if(bucket!=='voice-messages'&&v.storage_path){const {data,error}=await supabase.storage.from(bucket).createSignedUrl(v.storage_path,3600);if(error)throw error;if(data?.signedUrl)url=data.signedUrl}else if(!url&&v.storage_path){const {data,error}=await supabase.storage.from(bucket).createSignedUrl(v.storage_path,3600);if(error)throw error;if(data?.signedUrl)url=data.signedUrl}if(!url)throw new Error('Voice audio is unavailable.');const a=new Audio(url);a.preload='auto';a.playbackRate=rate;a.onloadedmetadata=()=>setDuration(Number.isFinite(a.duration)&&a.duration>0?a.duration:duration);a.ontimeupdate=()=>setCurrent(a.currentTime);a.onended=()=>{setPlaying(false);setCurrent(0)};a.onerror=()=>setPlaying(false);audioRef.current=a;return a};const toggle=async()=>{try{if(!audioRef.current){const a=await load();await a.play();setPlaying(true);return}if(playing){audioRef.current.pause();setPlaying(false)}else{await audioRef.current.play();setPlaying(true)}}catch{setPlaying(false)}};const seek=(e:React.ChangeEvent<HTMLInputElement>)=>{const value=Number(e.target.value);if(audioRef.current)audioRef.current.currentTime=value;setCurrent(value)};const cycle=()=>{const next=rate===1?1.5:rate===1.5?2:1;setRate(next);if(audioRef.current)audioRef.current.playbackRate=next};const fmt=(x:number)=>`${Math.floor(x/60)}:${String(Math.floor(x%60)).padStart(2,'0')}`;return <div className="voice-player"><button className="voice-play-btn" onClick={()=>void toggle()} aria-label={playing?'Pause voice':'Play voice'}>{playing?<Pause size={17}/>:<Play size={17}/>}</button><div className="voice-player-main"><div className="voice-wave voice-wave-player" aria-hidden="true">{Array.from({length:28},(_,i)=><i key={i} style={{height:`${7+(i%7)*2}px`}} className={playing?'active':''}/>)}</div><input className="voice-seek" type="range" min="0" max={Math.max(duration,0.1)} step="0.01" value={Math.min(current,duration||0)} onChange={seek} aria-label="Voice playback position"/><div className="voice-player-meta"><span>{fmt(current)}</span><span>{fmt(duration)}</span></div></div><button className="voice-speed-btn" onClick={cycle} title="Playback speed">{rate}x</button></div>}
function VoiceBubble({v,current,onDeleteForMe,onDeleteForEveryone,onReply,onReplyJump,timeFormat,counts,mine,onToggleReaction}:{v:VoiceMessage;current:boolean;onDeleteForMe:()=>void;onDeleteForEveryone:()=>void;onReply:()=>void;onReplyJump:(id:string,isVoice:boolean)=>void;timeFormat:TimeFormat;counts:Record<string,number>;mine:string[];onToggleReaction:(r:string)=>Promise<void>}){const [menu,setMenu]=useState(false);const countryName=iso31661.find(c=>c.alpha2===v.country)?.name??v.country;const subdivisionName=iso31662.find(s=>s.code===v.subdivision)?.name??v.subdivision.split('-').pop()??v.subdivision;return <article id={`voice-${v.id}`} className={`private-message public-message private-voice-message ${current?'mine':''}`}><div className="message-identity"><img className="message-avatar" src={avatarSrc(v.avatar_id)} alt=""/><div><strong>{v.name}</strong><span>{flag(v.country)} {subdivisionName}, {countryName}</span></div></div> {(v.reply_to_voice_id||v.reply_to_message_id)&&<button className="reply-preview voice-reply-preview" onClick={()=>onReplyJump((v.reply_to_voice_id||v.reply_to_message_id)!,Boolean(v.reply_to_voice_id))}><ReplyIcon size={13}/><span><b>{v.reply_to_name||'User'}</b>{v.reply_to_preview||'Reply'}</span></button>}<div className="private-bubble private-voice-bubble"><VoicePlayer v={v}/><button className="voice-menu-btn" onClick={()=>setMenu(x=>!x)} aria-label="Voice message options" title="Voice message options"><MoreVertical size={18}/></button>{menu&&<div className="private-item-menu voice-menu"><button onClick={()=>{onReply();setMenu(false)}}><ReplyIcon size={14}/> Reply</button><button onClick={()=>{onDeleteForMe();setMenu(false)}}><Trash2 size={14}/> Delete for me</button>{current&&<button className="danger" onClick={()=>{onDeleteForEveryone();setMenu(false)}}><Trash2 size={14}/> Delete for everyone</button>}<button onClick={()=>setMenu(false)}><X size={14}/> Cancel</button></div>}</div><div className="private-item-actions voice-reactions">{REACTIONS.map(r=><button key={r} className={mine.includes(r)?'reacted':''} onClick={()=>void onToggleReaction(r)}>{r}{counts[r]?<small>{counts[r]}</small>:null}</button>)}<button onClick={onReply} aria-label="Reply" title="Reply"><ReplyIcon size={13}/></button><time>{formatMessageTime(v.created_at,timeFormat)}</time></div></article>}

function PrivateChatModal({mode,roomName,setRoomName,joinCode,setJoinCode,error,busy,onClose,onCreate,onJoin}:{mode:'create'|'join';roomName:string;setRoomName:(v:string)=>void;joinCode:string;setJoinCode:(v:string)=>void;error:string;busy:boolean;onClose:()=>void;onCreate:()=>void;onJoin:()=>void}){return <div className="private-modal-backdrop" role="dialog" aria-modal="true"><div className="private-modal"><div className="panel-head"><div><b>{mode==='create'?<><LockKeyhole size={17}/> CREATE PRIVATE CHAT</>:<><KeyRound size={17}/> JOIN PRIVATE CHAT</>}</b><span>{mode==='create'?'Create a private room with a unique 8-character code':'Enter the 8-character room code'}</span></div><button onClick={onClose}><X/></button></div>{mode==='create'?<><label>Room Name</label><input maxLength={40} value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="e.g. Friends Room" autoFocus/></>:<><label>Room Code</label><input maxLength={8} value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="8-character code" autoFocus/></>}{error&&<div className="private-error">{error}</div>}<div className="private-modal-actions"><button className="private-modal-cancel clear-cancel-btn" onClick={onClose}>CANCEL</button><button className="primary-btn" disabled={busy} onClick={mode==='create'?onCreate:onJoin}>{busy?'PLEASE WAIT…':mode==='create'?'CREATE ROOM':'JOIN ROOM'}</button></div></div></div>}
function PrivateRoomView({profile,room,messages,setMessages,text,setText,sending,onSend,onClose,onCopy,replyTarget,setReplyTarget,currentUserId,sendError,privateOnline,privateTyping,onTyping,sound,onMembers,privateRecording,onRecording}:{profile:Profile;room:any;messages:any[];setMessages:React.Dispatch<React.SetStateAction<any[]>>;text:string;setText:(v:string)=>void;sending:boolean;onSend:()=>void;onClose:()=>void;onCopy:(m:any)=>void;replyTarget:any;setReplyTarget:(v:any)=>void;currentUserId:string;sendError:string;privateOnline:number;privateTyping:boolean;onTyping:(value:string)=>void;sound:boolean;onMembers:()=>void;privateRecording:boolean;onRecording:(active:boolean)=>void}){
  const [voices,setVoices]=useState<any[]>([]);
  const [recording,setRecording]=useState(false);
  const [recordingSeconds,setRecordingSeconds]=useState(0);
  const [recordedVoiceBlob,setRecordedVoiceBlob]=useState<Blob|null>(null);
  const [recordedVoiceDuration,setRecordedVoiceDuration]=useState(0);
  const [voiceBusy,setVoiceBusy]=useState(false);
  const [recordingStream,setRecordingStream]=useState<MediaStream|null>(null);
  const [playingId,setPlayingId]=useState<string|null>(null);
  const [playingElapsed,setPlayingElapsed]=useState(0);
  const [search,setSearch]=useState('');
  const [privateEmojiOpen,setPrivateEmojiOpen]=useState(false);
  const [menuId,setMenuId]=useState<string|null>(null);
  const [privateError,setPrivateError]=useState(''); const [highlightedPrivateId,setHighlightedPrivateId]=useState<string|null>(null);
  const replyTargetForPrivate=replyTarget;
  const setReplyTargetForPrivate=setReplyTarget;
  const replyTargetForPrivateRef=useRef<any>(null);
  useEffect(()=>{replyTargetForPrivateRef.current=replyTargetForPrivate},[replyTargetForPrivate]);
  const [reactions,setReactions]=useState<Record<string,Record<string,number>>>({});
  const [mine,setMine]=useState<Record<string,string[]>>({});
  const playPrivateAction=(src:string)=>{if(!sound)return;const a=new Audio(src);a.volume=0.42;void a.play().catch(()=>{});};
  const [localDeleted,setLocalDeleted]=useState<Record<string,boolean>>(()=>{
    try{return JSON.parse(localStorage.getItem('global-chat-private-local-deleted-v1')||'{}')}catch{return {}}
  });

  const recorderRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const sendPrivateAfterRecordingRef=useRef(false);
  const startedRef=useRef(0);
  const timerRef=useRef<number|undefined>(undefined);
  const audioRef=useRef<HTMLAudioElement|null>(null);

  const persistDeleted=(next:Record<string,boolean>)=>{
    setLocalDeleted(next);
    try{localStorage.setItem('global-chat-private-local-deleted-v1',JSON.stringify(next))}catch{}
  };

  const loadVoices=async()=>{
    const {data}=await supabase.from('private_voice_messages').select('*').eq('room_id',room.id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100);
    if(data){const visible=(data as any[]).filter(v=>!localDeleted['v:'+v.id]);setVoices(visible);}
  };

  const loadReactions=async()=>{
    const messageIds=messages.map((m:any)=>m.id);
    const voiceIds=voices.map((v:any)=>v.id);
    const [mr,vr]=await Promise.all([
      messageIds.length?supabase.from('private_message_reactions').select('message_id,user_id,reaction').in('message_id',messageIds):Promise.resolve({data:[] as any[]}),
      voiceIds.length?supabase.from('private_voice_reactions').select('voice_id,user_id,reaction').in('voice_id',voiceIds):Promise.resolve({data:[] as any[]})
    ]);
    const c:Record<string,Record<string,number>>={};
    const me:Record<string,string[]>={};
    for(const x of [...(mr.data||[]).map((x:any)=>({id:x.message_id,...x})),...(vr.data||[]).map((x:any)=>({id:x.voice_id,...x}))]){
      c[x.id]??={};c[x.id][x.reaction]=(c[x.id][x.reaction]||0)+1;
      if(x.user_id===currentUserId)me[x.id]=[...(me[x.id]||[]),x.reaction]
    }
    setReactions(c);setMine(me);
  };

  useEffect(()=>{
    void loadVoices();
    const ch=supabase.channel('private-media-'+room.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'private_voice_messages',filter:'room_id=eq.'+room.id},
        payload=>{if(localDeleted['v:'+payload.new.id])return;const v=payload.new as any;setVoices(prev=>prev.some(x=>x.id===v.id)?prev:[...prev,v].sort((a,b)=>a.created_at.localeCompare(b.created_at)))})
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'private_voice_messages',filter:'room_id=eq.'+room.id},
        payload=>setVoices(prev=>prev.filter(v=>v.id!==payload.old.id)))
      .subscribe();
    const poll=window.setInterval(()=>void loadVoices(),8000);
    return()=>{void supabase.removeChannel(ch);window.clearInterval(poll);audioRef.current?.pause();if(timerRef.current)window.clearInterval(timerRef.current)};
  },[room.id,localDeleted]);

  useEffect(()=>{void loadReactions()},[messages.length,voices.length,currentUserId]);

  const toggleReaction=async(id:string,isVoice:boolean,r:string)=>{playPrivateAction('/sounds/send.wav');
    const fn=isVoice?'toggle_private_voice_reaction':'toggle_private_message_reaction';
    const {error}=await supabase.rpc(fn,isVoice?{p_voice_id:id,p_reaction:r}:{p_message_id:id,p_reaction:r});
    if(error)setPrivateError(error.message); else void loadReactions();
  };

  const deleteForMe=(id:string,isVoice:boolean)=>{playPrivateAction('/sounds/send.wav');
    const key=(isVoice?'v:':'m:')+id;
    const next={...localDeleted,[key]:true};
    persistDeleted(next);
    if(isVoice)setVoices(prev=>prev.filter(v=>v.id!==id));
    else setMessages(prev=>prev.filter(m=>m.id!==id));
    setPrivateError('');
    setMenuId(null);
  };

  const deleteForEveryone=async(id:string,isVoice:boolean)=>{
    playPrivateAction('/sounds/send.wav');
    setPrivateError('');
    try{
      if(isVoice){
        const voice=voices.find(v=>v.id===id);
        if(!voice)throw new Error('Voice message not found.');
        if(voice.user_id!==currentUserId)throw new Error('Only the sender can delete for everyone.');

        // Delete the database row first so realtime removes the message for every member.
        const {data,error}=await supabase.rpc('delete_private_voice',{p_voice_id:id});
        if(error)throw error;
        if(data!==true)throw new Error('Voice message could not be deleted for everyone.');

        // Storage cleanup is best-effort: a missing/already-cleaned object must not turn a successful DB delete into an error.
        if(voice.storage_path){
          await supabase.storage.from('private-voice-messages').remove([voice.storage_path]).catch(()=>{});
        }

        setVoices(prev=>prev.filter(v=>v.id!==id));
        if(playingId===id){
          audioRef.current?.pause();
          audioRef.current=null;
          setPlayingId(null);
          setPlayingElapsed(0);
        }
      }else{
        const {data,error}=await supabase.rpc('delete_private_message',{p_message_id:id});
        if(error)throw error;
        if(data!==true)throw new Error('Message could not be deleted for everyone.');
        setMessages(prev=>prev.filter(m=>m.id!==id));
      }

      setLocalDeleted(prev=>{
        const next={...prev,[(isVoice?'v:':'m:')+id]:true};
        persistDeleted(next);
        return next;
      });
    }catch(e:any){
      setPrivateError(e?.message||'Could not delete for everyone. Please try again.');
    }finally{
      setMenuId(null);
    }
  };

  const uploadPrivateVoice=async(blob:Blob,duration:number)=>{
    setPrivateError('');setVoiceBusy(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user?.id)throw new Error('Authentication required');
      const ext=blob.type.includes('mp4')?'m4a':'webm';
      const path=room.id+'/'+user.id+'/private-'+crypto.randomUUID()+'.'+ext;
      const up=await supabase.storage.from('private-voice-messages').upload(path,blob,{contentType:blob.type||'audio/webm',upsert:false,cacheControl:'180'});
      if(up.error)throw up.error;
      const reply=replyTargetForPrivateRef.current;
      const replyToMessageId=reply?.reply_to_voice_id?null:(reply?.id&&!String(reply.id).startsWith('voice-reply-')?reply.id:null);
      const replyToVoiceId=reply?.reply_to_voice_id||null;
      let rpcResult=await supabase.rpc('send_private_voice',{p_room_id:room.id,p_name:profile.name,p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatarId,p_audio_url:path,p_storage_path:path,p_duration_ms:duration,p_reply_to_id:replyToMessageId,p_reply_to_voice_id:replyToVoiceId});
      if(rpcResult.error && /PGRST202|Could not find the function|function public\.send_private_voice|schema cache/i.test(rpcResult.error.message||'')){
        rpcResult=await supabase.rpc('send_private_voice',{p_room_id:room.id,p_name:profile.name,p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatarId,p_audio_url:path,p_storage_path:path,p_duration_ms:duration,p_reply_to_voice_id:replyToVoiceId});
      }
      if(rpcResult.error){await supabase.storage.from('private-voice-messages').remove([path]);throw rpcResult.error;}
      const message=Array.isArray(rpcResult.data)?rpcResult.data[0]:rpcResult.data;
      if(message)setVoices(prev=>prev.some(v=>v.id===message.id)?prev:[...prev,message].sort((a,b)=>a.created_at.localeCompare(b.created_at)));
      setReplyTargetForPrivate(null);
      playPrivateAction('/sounds/send.wav');
      return true;
    }catch(e:any){setPrivateError(e?.message||'Could not send private voice message.');return false}
    finally{setVoiceBusy(false)}
  };
  const sendRecordedPrivateVoice=async()=>{
    if(!recordedVoiceBlob||voiceBusy)return;
    const ok=await uploadPrivateVoice(recordedVoiceBlob,recordedVoiceDuration);
    if(ok){setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setRecordingSeconds(0)}
  };
  const startVoice=async()=>{
    if(recording||voiceBusy)return;
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setPrivateError('Voice recording is not supported in this browser.');return;}
    let stream:MediaStream|undefined;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const activeStream=stream;
      const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x))||'';
      const options:MediaRecorderOptions={audioBitsPerSecond:24000};if(mime)options.mimeType=mime;
      const rec=new MediaRecorder(activeStream,options);
      chunksRef.current=[];startedRef.current=Date.now();sendPrivateAfterRecordingRef.current=false;setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setPrivateError('');setRecordingStream(activeStream);
      rec.ondataavailable=e=>{if(e.data.size)chunksRef.current.push(e.data)};
      rec.onstop=()=>{
        activeStream.getTracks().forEach(t=>t.stop());
        setRecordingStream(null);
        if(timerRef.current)window.clearInterval(timerRef.current);timerRef.current=undefined;recorderRef.current=null;setRecording(false);
        const elapsed=Math.min(60000,Date.now()-startedRef.current);
        const blob=new Blob(chunksRef.current,{type:rec.mimeType||'audio/webm'});chunksRef.current=[];
        if(elapsed<500){setRecordingSeconds(0);setPrivateError('Voice message is too short.');sendPrivateAfterRecordingRef.current=false;return}
        if(blob.size>320*1024){setRecordingSeconds(0);setPrivateError('Voice message is too large. Please record a shorter message.');sendPrivateAfterRecordingRef.current=false;return}
        setRecordedVoiceBlob(blob);setRecordedVoiceDuration(elapsed);setRecordingSeconds(Math.floor(elapsed/1000));
        if(sendPrivateAfterRecordingRef.current){
          sendPrivateAfterRecordingRef.current=false;
          void uploadPrivateVoice(blob,elapsed).then(ok=>{if(ok){setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setRecordingSeconds(0)}});
        }
      };
      recorderRef.current=rec;rec.start(250);setRecording(true);setRecordingSeconds(0);onRecording(true);
      timerRef.current=window.setInterval(()=>{const elapsed=Math.floor((Date.now()-startedRef.current)/1000);if(elapsed>=60){stopVoice(false);return}setRecordingSeconds(elapsed)},250);
    }catch(e:any){stream?.getTracks().forEach(t=>t.stop());setRecordingStream(null);setRecording(false);setRecordingSeconds(0);setPrivateError(e?.name==='NotAllowedError'?'Microphone permission was denied. Please allow microphone access.':(e?.message||'Microphone access is unavailable.'));}
  };
  const stopVoice=(sendNow=true)=>{const rec=recorderRef.current;if(!rec||rec.state==='inactive')return;sendPrivateAfterRecordingRef.current=sendNow;onRecording(false);rec.stop()};
  const cancelVoice=()=>{
    sendPrivateAfterRecordingRef.current=false;
    onRecording(false);
    const rec=recorderRef.current;recorderRef.current=null;if(timerRef.current)window.clearInterval(timerRef.current);timerRef.current=undefined;chunksRef.current=[];
    if(rec&&rec.state!=='inactive'){rec.onstop=null;rec.stream.getTracks().forEach(t=>t.stop());rec.stop()}
    setRecording(false);setRecordingStream(null);setRecordingSeconds(0);setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setVoiceBusy(false);setPrivateError('');
  };

  const filteredText=messages.filter((m:any)=>!localDeleted['m:'+m.id]&&(!search||`${m.name} ${m.body}`.toLowerCase().includes(search.toLowerCase())));
  const beginPrivateReply=(item:any,isVoice=false)=>{const target=isVoice?{...item,id:`voice-reply-${item.id}`,reply_to_voice_id:item.id,body:`Voice message • ${formatDuration(item.duration_ms)}`} : item;setReplyTargetForPrivate(target);setText('');requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.private-composer textarea')?.focus())};
  const filteredVoices=voices.filter(v=>!localDeleted['v:'+v.id]&&(!search||v.name.toLowerCase().includes(search.toLowerCase())));
  const all=[...filteredText.map(m=>({kind:'text' as const,data:m})),...filteredVoices.map(v=>({kind:'voice' as const,data:v}))].sort((a,b)=>a.data.created_at.localeCompare(b.data.created_at));
  const jumpToPrivateReply=(id:string,isVoice:boolean)=>{const targetId=isVoice?`pv-${id}`:`pm-${id}`;document.getElementById(targetId)?.scrollIntoView({behavior:'smooth',block:'center'});setHighlightedPrivateId(targetId);window.setTimeout(()=>setHighlightedPrivateId(x=>x===targetId?null:x),1500)};

  return <div className="private-room-shell">
    <div className="private-room-head">
      <div><b><LockKeyhole size={17}/> {room.name}</b><span>Private room · Code: <strong>{room.join_code}</strong></span><span className="private-online-status"><i></i>{privateOnline} Online</span></div>
      <div className="private-room-actions">
        <button className="header-icon" onClick={()=>void navigator.clipboard?.writeText(room.join_code)} title="Copy join code"><Copy size={16}/></button><button className="private-members-btn" onClick={onMembers} title="Private chat members" aria-label="Private chat members"><Users size={16}/> MEMBERS</button>
        
        <button className="private-leave-btn" onClick={onClose}>LEAVE</button>
      </div>
    </div>

    

    {(sendError||privateError)&&<div className="private-error">{sendError||privateError}<button onClick={()=>setPrivateError('')} aria-label="Dismiss"><X size={14}/></button></div>}

    <div className="private-message-list">
      {all.length===0?<div className="empty private-empty-state"><div className="private-shield-animation" aria-hidden="true"><video className="private-shield-video" autoPlay muted playsInline loop preload="auto"><source src="/animations/private-shield-lock.mp4" type="video/mp4"/></video></div><h2>Private chat</h2><p>Only joined members can see these messages.</p></div>:
      all.map(item=>item.kind==='text'?
        <article key={'m-'+item.data.id} id={'pm-'+item.data.id} className={`private-message ${item.data.user_id===currentUserId?"mine":""} ${highlightedPrivateId===`pm-${item.data.id}`?"highlighted":""}`}>
          <div className="message-identity"><img className="message-avatar" src={avatarSrc(Number(item.data.avatar_id))} alt=""/><div><strong>{item.data.name}</strong><span>{flag(item.data.country)} {item.data.subdivision}</span></div></div>
          {(item.data.reply_to_id||item.data.reply_to_voice_id)&&<button className="reply-preview" onClick={()=>jumpToPrivateReply((item.data.reply_to_voice_id||item.data.reply_to_id)!,Boolean(item.data.reply_to_voice_id))}><ReplyIcon size={13}/><span><b>{item.data.reply_to_name||'User'}</b>{item.data.reply_to_preview||'Reply'}</span></button>}
          <div className="private-bubble"><span>{item.data.body}</span><time>{formatMessageTime(item.data.created_at,'12h')}</time></div>
          <div className="private-item-actions">
            {REACTIONS.map(r=><button key={r} className={mine[item.data.id]?.includes(r)?'reacted':''} onClick={()=>void toggleReaction(item.data.id,false,r)}>{r}{reactions[item.data.id]?.[r]?<small>{reactions[item.data.id][r]}</small>:null}</button>)}
            <button onClick={()=>{setReplyTargetForPrivate(item.data);setText('');requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.private-composer textarea')?.focus())}} aria-label="Reply"><ReplyIcon size={13}/></button>
            <button onClick={()=>void onCopy(item.data)} aria-label="Copy"><Copy size={13}/></button>
            <button onClick={()=>setMenuId(menuId==='m'+item.data.id?null:'m'+item.data.id)} aria-label="Message options"><MoreVertical size={15}/></button>
            {menuId==='m'+item.data.id&&<div className="private-item-menu"><button onClick={()=>{beginPrivateReply(item.data);setMenuId(null)}}><ReplyIcon size={14}/> Reply</button><button onClick={()=>deleteForMe(item.data.id,false)}>Delete for me</button>{item.data.user_id===currentUserId&&<button className="danger" onClick={()=>void deleteForEveryone(item.data.id,false)}>Delete for everyone</button>}<button onClick={()=>setMenuId(null)}><X size={14}/> Cancel</button></div>}
          </div>
        </article>
      :
        <article key={'v-'+item.data.id} id={'pv-'+item.data.id} className={`private-message private-voice-message ${item.data.user_id===currentUserId?"mine":""} ${highlightedPrivateId===`pv-${item.data.id}`?"highlighted":""}`}>
          <div className="message-identity"><img className="message-avatar" src={avatarSrc(Number(item.data.avatar_id))} alt=""/><div><strong>{item.data.name}</strong><span>{flag(item.data.country)} {item.data.subdivision}</span></div></div>
          {(item.data.reply_to_voice_id||item.data.reply_to_message_id)&&<button className="reply-preview voice-reply-preview" onClick={()=>jumpToPrivateReply((item.data.reply_to_voice_id||item.data.reply_to_message_id)!,Boolean(item.data.reply_to_voice_id))}><ReplyIcon size={13}/><span><b>{item.data.reply_to_name||'User'}</b>{item.data.reply_to_preview||'Reply'}</span></button>}
          <div className="private-bubble private-voice-bubble"><VoicePlayer v={item.data} bucket="private-voice-messages"/></div>
          <div className="private-item-actions">
            {REACTIONS.map(r=><button key={r} className={mine[item.data.id]?.includes(r)?'reacted':''} onClick={()=>void toggleReaction(item.data.id,true,r)}>{r}{reactions[item.data.id]?.[r]?<small>{reactions[item.data.id][r]}</small>:null}</button>)}
            <button onClick={()=>void onCopy({body:'Voice message'})} aria-label="Copy"><Copy size={13}/></button>
            <button onClick={()=>setMenuId(menuId==='v'+item.data.id?null:'v'+item.data.id)} aria-label="Voice options"><MoreVertical size={15}/></button>
            {menuId==='v'+item.data.id&&<div className="private-item-menu"><button onClick={()=>beginPrivateReply(item.data,true)}><ReplyIcon size={14}/> Reply</button><button onClick={()=>deleteForMe(item.data.id,true)}>Delete for me</button>{item.data.user_id===currentUserId&&<button className="danger" onClick={()=>void deleteForEveryone(item.data.id,true)}>Delete for everyone</button>}<button onClick={()=>setMenuId(null)}><X size={14}/> Cancel</button></div>}
          </div>
        </article>
      )}
    </div>

    {replyTargetForPrivate&&<div className="reply-composer private-reply"><div><b><ReplyIcon size={14}/> Replying to {replyTargetForPrivate.name}</b><span>{replyTargetForPrivate.reply_to_voice_id?`Voice message • ${formatDuration(replyTargetForPrivate.duration_ms||0)}`:(replyTargetForPrivate.body||'Reply')}</span></div><button className="private-modal-cancel" onClick={()=>setReplyTargetForPrivate(null)} aria-label="CANCEL reply"><X size={16}/></button></div>}

    {privateRecording&&<div className="typing-indicator recording-indicator">Someone is recording<span className="typing-dots"><i></i><i></i><i></i></span></div>}{privateTyping&&<div className="typing-indicator">Someone is typing<span className="typing-dots"><i></i><i></i><i></i></span></div>}

    {recording||recordedVoiceBlob?
      <div className="voice-recorder private-voice-recorder public-style-voice-recorder">
        <div className="voice-rec-left">
          <span className="recording-dot"></span>
          <strong>{String(Math.floor(recordingSeconds/60)).padStart(2,'0')}:{String(recordingSeconds%60).padStart(2,'0')}</strong>
        </div>
        <LiveRecordingWaveform stream={recording?recordingStream:null}/>
        <div className="recording-actions">
        <button className="voice-cancel" onClick={cancelVoice} aria-label="Delete recording" title="Delete recording"><X size={18}/></button>
        <button className="voice-send" onClick={recording?()=>stopVoice(true):()=>void sendRecordedPrivateVoice()} disabled={voiceBusy} aria-label="Send voice message" title="Send voice message"><Send size={18}/></button>
        </div>
      </div>
      :
      <div className="composer private-composer">
        <div className="tools private-tools"><button className="icon-btn" onClick={()=>setPrivateEmojiOpen(v=>!v)} aria-label="Emoji"><Smile size={19}/></button>{privateEmojiOpen&&<div className="private-emoji-pop">{EMOJIS.map(e=><button key={e} onClick={()=>{setText(text+e);setPrivateEmojiOpen(false)}}>{e}</button>)}</div>}</div>
        <textarea value={text} maxLength={500} onChange={e=>{const value=e.target.value;setText(value);onTyping(value)}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onSend()}}} placeholder="Type a private message..." rows={1}/>
        <button className="voice-btn" disabled={sending||voiceBusy||recording} onClick={()=>void startVoice()} aria-label="Record private voice message"><Mic size={18}/></button>
        <button className="send-btn" disabled={!text.trim()||sending||voiceBusy} onClick={onSend}><Send size={18}/></button>
      </div>
    }

  </div>
}


function PrivateMembersModal({room,members,blockedMembers,loading,error,currentUserId,isOwner,onClose,onRefresh,onRemove,onBlock,onUnblock}:{room:any;members:any[];blockedMembers:any[];loading:boolean;error:string;currentUserId:string;isOwner:boolean;onClose:()=>void;onRefresh:()=>void;onRemove:(m:any)=>void;onBlock:(m:any)=>void;onUnblock:(m:any)=>void}){const card=(m:any,blocked=false)=>{const countryName=iso31661.find(c=>c.alpha2===m.country)?.name||m.country||'Country not set';const stateName=iso31662.find(x=>x.code===m.subdivision)?.name||m.subdivision||'State not set';return <div className={`private-member-card ${blocked?'blocked':''}`} key={`${blocked?'b':'m'}-${m.user_id}`}><img className="private-member-avatar" src={avatarSrc(Number(m.avatar_id))} alt=""/><div className="private-member-info"><div><strong>{m.name||'User'}</strong>{m.is_owner&&<span className="private-admin-badge">ADMIN</span>}</div><span>{m.country?flag(m.country):'--'} {stateName}, {countryName}</span></div>{isOwner&&m.user_id!==currentUserId&&!m.is_owner&&<div className="private-member-actions">{blocked?<button onClick={()=>onUnblock(m)} className="private-member-action unblock">UNBLOCK</button>:<><button onClick={()=>onRemove(m)} className="private-member-action remove">REMOVE</button><button onClick={()=>onBlock(m)} className="private-member-action block">BLOCK</button></>}</div>}</div>};return <div className="private-members-backdrop" role="dialog" aria-modal="true"><div className="private-members-panel"><div className="private-members-head"><div><b><Users size={17}/> PRIVATE CHAT MEMBERS</b><span>{room.name} · {members.length} member{members.length===1?'':'s'}</span></div><div><button onClick={onRefresh}>↻</button><button onClick={onClose}><X size={18}/></button></div></div>{error&&<div className="private-error">{error}</div>}<div className="private-members-list">{loading?<div className="private-members-empty">Loading members…</div>:members.length===0?<div className="private-members-empty">No active members.</div>:members.map(m=>card(m))}{isOwner&&blockedMembers.length>0&&<section className="private-blocked-section"><div><strong>BLOCKED</strong> <span>{blockedMembers.length}</span></div>{blockedMembers.map(m=>card(m,true))}</section>}</div><div className="private-members-footer"><span>{isOwner?'You are the room admin.':'Room admin is the creator.'}</span><button className="private-modal-cancel" onClick={onClose}>CLOSE</button></div></div></div>}

function YourPrivateChatsModal({rooms,loading,currentRoomId,currentUserId,onClose,onEnter,onDelete,onRename}:{rooms:any[];loading:boolean;currentRoomId:string|null;currentUserId:string;onClose:()=>void;onEnter:(room:any)=>void;onDelete:(room:any)=>void;onRename:(room:any)=>void}){
  return <div className="modal-backdrop">
    <div className="your-private-chats-modal">
      <div className="your-private-chats-head">
        <div>
          <b><Users size={17}/> YOUR PRIVATE CHATS</b>
          <span>Created and joined private rooms</span>
        </div>
        <button onClick={onClose} aria-label="Close"><X size={18}/></button>
      </div>

      <div className="your-private-chats-list">
        {loading?
          <div className="your-private-empty">Loading private chats...</div>
        :
        rooms.length===0?
          <div className="your-private-empty">
            <div><LockKeyhole size={30}/></div>
            <strong>No private chats saved</strong>
            <span>Create or join a private chat and it will appear here.</span>
          </div>
        :
        rooms.map(room=>{
          const owner=room.owner_id===currentUserId;
          const active=room.id===currentRoomId;

          return <div className="your-private-chat-item" key={room.id}>
            <div className="your-private-chat-info">
              <div className="your-private-chat-icon"><LockKeyhole size={18}/></div>
              <div>
                <strong>{room.name}</strong>
                <span>{owner?'Created by you':'Joined private chat'} · Code: <b>{room.join_code}</b></span>
              </div>
            </div>

            <div className="your-private-chat-actions">
              <button className="your-private-enter-btn" onClick={()=>onEnter(room)}>
                {active?'OPEN':'ENTER'}
              </button>
              {owner&&<button className="your-private-rename-btn" onClick={()=>onRename(room)} aria-label="Rename private chat" title="Rename private chat"><Pencil size={16}/></button>}
              <button className="your-private-delete-btn" onClick={()=>onDelete(room)} aria-label="Delete from Your Private Chats" title="Remove from Your Private Chats">
                <Trash2 size={15}/>
              </button>
            </div>
          </div>
        })
        }
      </div>

      <div className="your-private-chats-footer">
        <button className="private-modal-cancel" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  </div>
}

function SettingsPanel({profile,settings,onClose,onSave}:{profile:Profile;settings:any;onClose:()=>void;onSave:(p:Profile,s:any)=>void}){const [p,setP]=useState(profile);const [s,setS]=useState(settings); const nameValid=p.name.trim().length>=2 && p.name.trim().length<=32; useEffect(()=>{const t=THEMES.find(x=>x.id===p.themeId)||THEMES[0]; document.documentElement.style.setProperty('--bg',t.bg);document.documentElement.style.setProperty('--surface',t.surface);document.documentElement.style.setProperty('--primary',t.primary);document.documentElement.style.setProperty('--accent',t.accent);document.documentElement.style.setProperty('--font-size',`${TEXT_SIZES[s.textSize as TextSize]}px`);},[p.themeId,s.textSize]); return <div className="modal-backdrop"><div className="settings-panel"><div className="panel-head"><div><b><Settings size={17}/> SETTINGS</b><span>Personalize your chat experience</span></div><button onClick={onClose}><X/></button></div><label><UserRound size={15}/> Name / Nickname</label><input className="settings-name-input" maxLength={32} value={p.name} onChange={e=>setP({...p,name:e.target.value})} placeholder="Enter a nickname…" autoComplete="nickname"/><label><Image size={15}/> Change Avatar</label><div className="avatar-grid compact">{AVATARS.map(a=><button className={`avatar ${p.avatarId===a.id?'selected':''}`} key={a.id} onClick={()=>setP({...p,avatarId:a.id})}><img src={a.src} alt={`Avatar ${a.id}`}/></button>)}</div><label><Palette size={15}/> Change Theme</label><div className="theme-grid compact-themes">{THEMES.map(t=><button className={`theme-tile ${p.themeId===t.id?'selected':''}`} key={t.id} style={{background:t.bg,borderColor:t.primary}} onClick={()=>setP({...p,themeId:t.id})}><span style={{background:t.primary}}></span><strong>{t.name}</strong></button>)}</div><label>Text Size</label><div className="segmented">{(['small','medium','large','xl'] as TextSize[]).map(k=><button className={s.textSize===k?'active':''} key={k} onClick={()=>setS({...s,textSize:k})}>{k==='xl'?'Extra Large':k[0].toUpperCase()+k.slice(1)}</button>)}</div><label><Bell size={15}/> Sound</label><div className="segmented two"><button className={s.sound?'active':''} onClick={()=>setS({...s,sound:true})}><Volume2 size={15}/> ON</button><button className={!s.sound?'active':''} onClick={()=>setS({...s,sound:false})}><MicOff size={15}/> OFF</button></div><label><Clock3 size={15}/> Clock Format</label><div className="segmented two"><button className={(s.timeFormat||'12h')==='12h'?'active':''} onClick={()=>setS({...s,timeFormat:'12h'})}>12-hour</button><button className={(s.timeFormat||'12h')==='24h'?'active':''} onClick={()=>setS({...s,timeFormat:'24h'})}>24-hour</button></div><button className="primary-btn" disabled={!nameValid} onClick={()=>onSave({...p,name:p.name.trim().replace(/\s+/g,' ')},{...s,timeFormat:s.timeFormat||'12h'})}>SAVE SETTINGS <Check size={17}/></button></div></div>}


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














































