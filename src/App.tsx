import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { iso31661, iso31662 } from 'iso-3166';
import { ArrowDown, Check, ChevronDown, Copy, Gamepad2, MicOff, Reply as ReplyIcon, Search, Send, Settings, Smile, Trash2, Volume2, Wifi, WifiOff, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AVATARS, REACTIONS, THEMES, TEXT_SIZES, type TextSize } from './data/catalog';

const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','👍','👎','👏','🙌','🙏','👋','💪','🔥','❤️','💯'];
import { validateMessage } from './lib/validation';
import './styles.css';

type Profile = { name:string; country:string; subdivision:string; avatarId:number; themeId:string; agreed:boolean };
type TimeFormat = '12h' | '24h';
type ChatMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; body:string; created_at:string; expires_at:string; reply_to_id?:string|null; reply_to_preview?:string|null; reply_to_name?:string|null };
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
  const [name,setName]=useState(''); const [country,setCountry]=useState(''); const [subdivision,setSubdivision]=useState(''); const [avatarId,setAvatarId]=useState(1); const [themeId,setThemeId]=useState('midnight'); const [agreed,setAgreed]=useState(false); const [countryQuery,setCountryQuery]=useState(''); const [subQuery,setSubQuery]=useState('');
  useEffect(()=>{const t=THEMES.find(x=>x.id===themeId)||THEMES[0]; document.documentElement.style.setProperty('--bg',t.bg);document.documentElement.style.setProperty('--surface',t.surface);document.documentElement.style.setProperty('--primary',t.primary);document.documentElement.style.setProperty('--accent',t.accent);},[themeId]);
  const countries=useMemo(()=>iso31661.filter(c=>c.state==='assigned').sort((a,b)=>a.name.localeCompare(b.name)),[]);
  const subdivisions=useMemo(()=>iso31662.filter(s=>s.code.startsWith(country+'-')).sort((a,b)=>a.name.localeCompare(b.name)),[country]);
  const filteredCountries=useMemo(()=>countries.filter(c=>(c.name+' '+c.alpha2+' '+c.alpha3).toLowerCase().includes(countryQuery.toLowerCase())).slice(0,60),[countries,countryQuery]);
  const filteredSubs=useMemo(()=>subdivisions.filter(s=>(s.name+' '+s.code).toLowerCase().includes(subQuery.toLowerCase())).slice(0,120),[subdivisions,subQuery]);
  const selectedCountry=countries.find(c=>c.alpha2===country); const selectedSub=subdivisions.find(s=>s.code===subdivision);
  const valid=name.trim().length>=2 && name.trim().length<=32 && !!selectedCountry && !!selectedSub && agreed;
  const enter=async()=>{if(!valid)return; const p={name:name.trim().replace(/\s+/g,' '),country,subdivision,avatarId,themeId,agreed}; try { const {error}=await supabase.functions.invoke('save-profile',{body:p}); if(error) throw error; onEnter(p); } catch { alert('We could not save your profile. Please check your connection and try again.'); }};
  return <div className="setup-page"><div className="setup-shell">
    <div className="brand"><img className="brand-mark brand-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" /><div><h1>GLOBAL CHAT</h1><p>Create Your Profile</p></div></div>
    <div className="setup-grid">
      <section className="card profile-card">
        <label>Name / Nickname</label><input maxLength={32} value={name} onChange={e=>setName(e.target.value)} placeholder="Enter a nickname…" autoComplete="nickname"/>
        <label>Country</label><div className="select-wrap"><input value={countryQuery || (selectedCountry ? `${flag(selectedCountry.alpha2)} ${selectedCountry.name} · ${selectedCountry.alpha2}`:'')} onChange={e=>{setCountryQuery(e.target.value);setCountry('');setSubdivision('')}} placeholder="Search countries…"/><ChevronDown size={18}/></div>
        {countryQuery && !selectedCountry && <div className="option-list">{filteredCountries.map(c=><button key={c.alpha2} onClick={()=>{setCountry(c.alpha2);setCountryQuery('');setSubdivision('')}}>{flag(c.alpha2)} {c.name}<span>{c.alpha2}</span></button>)}</div>}
        {selectedCountry && <div className="selected-chip">{flag(selectedCountry.alpha2)} {selectedCountry.name}<b>{selectedCountry.alpha2}</b><button onClick={()=>{setCountry('');setSubdivision('')}}><X size={14}/></button></div>}
        <label>State / Province / Region</label><div className="select-wrap"><input disabled={!selectedCountry} value={subQuery || (selectedSub ? `${selectedSub.name} · ${selectedSub.code}`:'')} onChange={e=>{setSubQuery(e.target.value);setSubdivision('')}} placeholder={selectedCountry?'Search subdivisions…':'Select a country first'}/><ChevronDown size={18}/></div>
        {selectedCountry && subQuery && !selectedSub && <div className="option-list">{filteredSubs.map(s=><button key={s.code} onClick={()=>{setSubdivision(s.code);setSubQuery('')}}>{s.name}<span>{s.code}</span></button>)}</div>}
        {selectedSub && <div className="selected-chip">{selectedSub.name}<b>{selectedSub.code}</b><button onClick={()=>setSubdivision('')}><X size={14}/></button></div>}
        <label>Choose Your Avatar</label><div className="avatar-grid">{AVATARS.map(a=><button className={`avatar ${avatarId===a.id?'selected':''}`} key={a.id} onClick={()=>setAvatarId(a.id)} aria-label={`Avatar ${a.id}`}>{a.emoji}</button>)}</div>
      </section>
      <section className="card theme-card"><label>Choose Your Theme</label><div className="theme-grid">{THEMES.map(t=><button key={t.id} className={`theme-tile ${themeId===t.id?'selected':''}`} style={{background:t.bg,borderColor:t.primary}} onClick={()=>setThemeId(t.id)}><span style={{background:t.primary}}></span><strong>{t.name}</strong><small>Instant preview</small></button>)}</div>
        <div className="rules"><h3>📜 GLOBAL CHAT RULES</h3><ul><li>English only.</li><li>No bad words or offensive content.</li><li>Max 500 characters per message.</li><li>Max 3 messages every 10 seconds.</li><li>Be respectful. No spam.</li><li>Messages disappear after 5 minutes.</li><li>No photo or file uploads.</li><li>Enjoy the chat responsibly! 🌍</li></ul><label className="agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I agree to the rules</span></label></div>
        <button className="primary-btn" disabled={!valid} onClick={enter}>ENTER CHAT <span>→</span></button>
      </section>
    </div>
  </div></div>
}

function readLocalDeleted():Record<string,number>{const raw=readJSON<Record<string,number>>(LOCAL_DELETED_KEY,{});const now=Date.now();const clean=Object.fromEntries(Object.entries(raw).filter(([,expires])=>expires>now));if(Object.keys(clean).length!==Object.keys(raw).length)try{localStorage.setItem(LOCAL_DELETED_KEY,JSON.stringify(clean))}catch{}return clean}
function localMessageKey(m:Pick<ChatMessage,'id'|'user_id'|'body'|'created_at'>){return m.id.startsWith('optimistic-')?`${m.user_id}|${m.created_at}|${m.body}`:m.id}
function canLocalDelete(m:ChatMessage){return new Date(m.expires_at).getTime()-Date.now()>0}

function Chat({profile,settings,onSettings,onProfile}:{profile:Profile;settings:{textSize:TextSize;sound:boolean;timeFormat?:TimeFormat};onSettings:(x:any)=>void;onProfile:(x:Profile)=>void}){
  const [messages,setMessages]=useState<ChatMessage[]>([]); const [localDeleted,setLocalDeleted]=useState<Record<string,number>>(()=>readLocalDeleted()); const messagesRef=useRef<ChatMessage[]>([]); const messageIdsRef=useRef<string[]>([]); const [online,setOnline]=useState(0); const [reactionCounts,setReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [myReactions,setMyReactions]=useState<Record<string,string[]>>({}); const [authUserId,setAuthUserId]=useState(''); const [text,setText]=useState(''); const [error,setError]=useState(''); const [settingsOpen,setSettingsOpen]=useState(false); const [clearConfirmOpen,setClearConfirmOpen]=useState(false); const [emojiOpen,setEmojiOpen]=useState(false); const [connected,setConnected]=useState(false); const [connectionState,setConnectionState]=useState<'connected'|'reconnecting'|'offline'>('reconnecting'); const [sending,setSending]=useState(false); const [typingUsers,setTypingUsers]=useState<string[]>([]); const [showJump,setShowJump]=useState(false); const [replyTarget,setReplyTarget]=useState<ChatMessage|null>(null); const [offlineGameOpen,setOfflineGameOpen]=useState(false); const [searchOpen,setSearchOpen]=useState(false); const [searchQuery,setSearchQuery]=useState(''); const [newMessageCount,setNewMessageCount]=useState(0); const [highlightedMessageId,setHighlightedMessageId]=useState<string|null>(null); const [copiedId,setCopiedId]=useState<string|null>(null); const typingStopRef=useRef<number|undefined>(undefined); const replyMetaRef=useRef<Record<string,{replyToId:string;replyToPreview:string;replyToName:string}>>({}); const channelRef=useRef<any>(null); const listRef=useRef<HTMLDivElement>(null); const audioRef=useRef<{send:HTMLAudioElement;receive:HTMLAudioElement}|null>(null); const sessionRef=useRef<any>(null); const pendingRef=useRef<Record<string,{tempId:string;body:string;createdAt:string}>>({}); const sendLockRef=useRef(false);
  const theme=THEMES.find(t=>t.id===profile.themeId) ?? THEMES[0];
  useEffect(()=>{document.documentElement.style.setProperty('--bg',theme.bg);document.documentElement.style.setProperty('--surface',theme.surface);document.documentElement.style.setProperty('--primary',theme.primary);document.documentElement.style.setProperty('--accent',theme.accent);document.documentElement.style.setProperty('--font-size',`${TEXT_SIZES[settings.textSize]}px`);},[theme,settings.textSize]);
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
  const refresh=useCallback(async()=>{const {data,error}=await supabase.from('messages').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100);if(!error&&data){const rawServer=(data as ChatMessage[]).filter(m=>!localDeleted[localMessageKey(m)]);const server=rawServer.map(m=>{const target=rawServer.find(x=>x.id===m.reply_to_id);return target?{...m,reply_to_preview:target.body,reply_to_name:target.name}:m});setMessages(prev=>{const pending=prev.filter(m=>m.id.startsWith('optimistic-')&&pendingRef.current[m.id]&&!localDeleted[localMessageKey(m)]);const merged=[...server,...pending.filter(p=>!server.some(m=>m.user_id===p.user_id&&m.body===p.body&&Math.abs(new Date(m.created_at).getTime()-new Date(p.created_at).getTime())<15000))];return merged.sort((a,b)=>a.created_at.localeCompare(b.created_at))})}},[localDeleted]); const refreshReactions=useCallback(async(ids:string[],userId:string)=>{if(!ids.length)return;const {data}=await supabase.from('message_reactions').select('message_id,user_id,reaction').in('message_id',ids);const counts:Record<string,Record<string,number>>={};const mine:Record<string,string[]>={};(data||[]).forEach((r:any)=>{counts[r.message_id]??={};counts[r.message_id][r.reaction]=(counts[r.message_id][r.reaction]||0)+1;if(r.user_id===userId)(mine[r.message_id]??=[]).push(r.reaction)});setReactionCounts(counts);setMyReactions(mine)},[]);
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
      channel=supabase.channel('global-chat',{config:{presence:{key:selfId},private:true}});
      channelRef.current=channel;
      channel
        .on('presence',{event:'sync'},presenceUsers)
        .on('presence',{event:'join'},presenceUsers)
        .on('presence',{event:'leave'},presenceUsers)
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
        .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},()=>refreshReactions(messageIdsRef.current,selfId))
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
  useEffect(()=>{const timers: number[]=[]; const now=Date.now(); messages.forEach(m=>{const delay=new Date(m.expires_at).getTime()-now; if(delay>0&&delay<2147483647)timers.push(window.setTimeout(()=>setMessages(prev=>prev.filter(x=>x.id!==m.id)),delay+50));}); return()=>timers.forEach(t=>window.clearTimeout(t))},[messages]);
  useEffect(()=>{messagesRef.current=messages;messageIdsRef.current=messages.map(m=>m.id)},[messages]);
  const messageIds=useMemo(()=>messages.map(m=>m.id).join(','),[messages]);
  useEffect(()=>{if(authUserId&&messageIds)refreshReactions(messageIds.split(',').filter(Boolean),authUserId)},[messageIds,authUserId,refreshReactions]);
  const shouldStickToBottom=()=>{const el=listRef.current;if(!el)return true;return el.scrollHeight-el.scrollTop-el.clientHeight<120};
  const previousMessageCountRef=useRef(messages.length);
  useEffect(()=>{const el=listRef.current;if(!el)return;const grew=messages.length>previousMessageCountRef.current;const near=shouldStickToBottom();if(grew&&near&&!activeSearch)el.scrollTop=el.scrollHeight;else if(!near&&messages.length)setShowJump(true);previousMessageCountRef.current=messages.length},[messages.length,activeSearch]);
  const handleScroll=()=>{const el=listRef.current;if(!el)return;const near=el.scrollHeight-el.scrollTop-el.clientHeight<120;if(near){setShowJump(false);setNewMessageCount(0)}else setShowJump(messages.length>0)};
  const jumpToLatest=()=>{const el=listRef.current;if(!el)return;el.scrollTop=el.scrollHeight;setShowJump(false);setNewMessageCount(0)};
  const updateTyping=(value:string)=>{setText(value);if(!channelRef.current||!authUserId)return;void channelRef.current.track({online_at:new Date().toISOString(),typing:Boolean(value.trim())});if(typingStopRef.current)window.clearTimeout(typingStopRef.current);if(value.trim())typingStopRef.current=window.setTimeout(()=>{void channelRef.current?.track({online_at:new Date().toISOString(),typing:false})},1200)};
  const beginReply=(m:ChatMessage)=>{if(m.id.startsWith('optimistic-'))return;setReplyTarget(m);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())};
  const send=async()=>{if(sendLockRef.current)return;sendLockRef.current=true;setError('');const body=text.trim();const problem=validateMessage(text);if(problem){setError(problem);sendLockRef.current=false;return}const duplicate=messagesRef.current.some(m=>m.user_id===authUserId&&m.body===body&&Date.now()-new Date(m.created_at).getTime()<10000&&!m.id.startsWith('optimistic-'));if(duplicate){setError('Please do not send the same message again so quickly.');sendLockRef.current=false;return}const tempId=`optimistic-${crypto.randomUUID()}`;const createdAt=new Date().toISOString();const optimistic:ChatMessage={id:tempId,user_id:authUserId,name:profile.name,country:profile.country,subdivision:profile.subdivision,avatar_id:profile.avatarId,body,created_at:createdAt,expires_at:new Date(Date.now()+5*60*1000).toISOString(),reply_to_id:replyTarget?.id||null,reply_to_preview:replyTarget?.body||null,reply_to_name:replyTarget?.name||null};pendingRef.current[tempId]={tempId,body,createdAt};setText('');setEmojiOpen(false);const sentReply=replyTarget;setReplyTarget(null);setMessages(prev=>prev.some(m=>m.id===tempId)?prev:[...prev,optimistic]);play('send');setSending(true);try{let session=sessionRef.current;if(!session){const {data}=await supabase.auth.getSession();session=data.session;sessionRef.current=session}const {data,error}=await supabase.functions.invoke('send-message',{body:{text:body,profile,replyToId:sentReply&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null},headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});if(error||data?.error)throw new Error(data?.error||'Unable to send message.');const serverMessage={...(data?.message||data) as ChatMessage,reply_to_id:sentReply&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,reply_to_preview:sentReply?.body||null,reply_to_name:sentReply?.name||null};setMessages(prev=>{if(serverMessage?.id&&prev.some(m=>m.id===serverMessage.id))return prev;const exists=prev.some(m=>m.id===tempId);return exists&&serverMessage?.id?prev.map(m=>m.id===tempId?serverMessage:m):prev});delete pendingRef.current[tempId];if(sentReply&&!sentReply.id.startsWith('optimistic-')&&serverMessage?.id&&channelRef.current)void channelRef.current.send({type:'broadcast',event:'message-meta',payload:{messageId:serverMessage.id,replyToId:sentReply.id,replyToPreview:sentReply.body,replyToName:sentReply.name}})}catch(e:any){setMessages(prev=>prev.filter(m=>m.id!==tempId));delete pendingRef.current[tempId];setError(e.message||'Unable to send message. Please try again.')}finally{setSending(false);sendLockRef.current=false}};
  const persistLocalDeleted=(next:Record<string,number>)=>{setLocalDeleted(next);try{localStorage.setItem(LOCAL_DELETED_KEY,JSON.stringify(next))}catch{}};
  const deleteLocally=(m:ChatMessage)=>{if(!canLocalDelete(m))return;const key=localMessageKey(m);const next={...readLocalDeleted(),[key]:new Date(m.expires_at).getTime()};persistLocalDeleted(next);setMessages(prev=>prev.filter(x=>localMessageKey(x)!==key))};
  const clearChatLocally=()=>{const current=readLocalDeleted();const now=Date.now();messages.forEach(m=>{if(new Date(m.expires_at).getTime()>now)current[localMessageKey(m)]=new Date(m.expires_at).getTime()});persistLocalDeleted(current);setMessages([])};
  const onKey=(e:React.KeyboardEvent)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
  return <div className="chat-app"><header className="topbar"><div className="top-brand"><img className="brand-mini brand-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" /><div><b>GLOBAL CHAT</b><span><i className={connected?'online-dot':'offline-dot'}></i>{online} Online</span></div></div><div className="top-actions"><button className={`header-icon ${searchOpen?'active':''}`} onClick={()=>setSearchOpen(v=>!v)} aria-label="Search active messages" title="Search active messages"><Search size={17}/></button><button className="clear-chat-btn" onClick={()=>setClearConfirmOpen(true)}><Trash2 size={17}/> CLEAR CHAT</button><button className="settings-btn" onClick={()=>setSettingsOpen(true)} aria-label="Settings" title="Settings"><Settings size={18}/></button></div></header>
    <div className={`connection-banner ${connectionState}`}><span>{connectionState==='connected'?<Wifi size={13}/>:connectionState==='offline'?<WifiOff size={13}/>:<Wifi size={13}/>}</span>{connectionState==='connected'?'Connected':connectionState==='offline'?'Offline — game mode available':'Reconnecting…'}</div>
    <main className="chat-main">{searchOpen&&<div className="chat-search"><Search size={16}/><input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search active messages..." aria-label="Search active messages"/>{searchQuery&&<button onClick={()=>setSearchQuery('')} aria-label="Clear search"><X size={15}/></button>}<span>{displayedMessages.length}/{messages.length}</span></div>}<div className="message-list" ref={listRef} onScroll={handleScroll}>{messages.length===0?<div className="empty"><div className="empty-earth">🌍</div><h2>Talk to the world</h2><p>Say hello. Share ideas. Keep it friendly.</p></div>:displayedMessages.length===0?<div className="empty search-empty"><Search size={28}/><h2>No active messages found</h2><p>Search only covers messages that are still visible.</p></div>:displayedMessages.map(m=><Message key={m.id} m={m} current={m.user_id===authUserId} timeFormat={settings.timeFormat || '12h'} counts={reactionCounts[m.id]||{}} mine={myReactions[m.id]||[]} highlighted={highlightedMessageId===m.id} copied={copiedId===m.id} onCopy={()=>copyMessage(m)} onToggle={async(r)=>{const {error}=await supabase.functions.invoke('toggle-reaction',{body:{messageId:m.id,reaction:r}});if(!error)refreshReactions(messageIdsRef.current,authUserId)}} onDelete={()=>deleteLocally(m)} onReply={()=>beginReply(m)} onReplyJump={(id)=>{setSearchQuery('');const el=document.getElementById(`msg-${id}`);el?.scrollIntoView({behavior:'smooth',block:'center'});setHighlightedMessageId(id)}}/>)}</div>{showJump&&<button className="jump-latest" onClick={jumpToLatest}><ArrowDown size={15}/>{newMessageCount>0?`${newMessageCount} NEW MESSAGE${newMessageCount===1?'':'S'}`:'LATEST MESSAGES'}</button>}{typingUsers.length>0&&<div className="typing-indicator">Someone is typing<span className="typing-dots"><i></i><i></i><i></i></span></div>}
      <div className="composer-wrap">{replyTarget&&<div className="reply-composer"><div><b><ReplyIcon size={14}/> Replying to {replyTarget.name}</b><span>{replyTarget.body}</span></div><button onClick={()=>setReplyTarget(null)} aria-label="Cancel reply"><X size={16}/></button></div>}<div className="composer"><div className="tools"><button className="icon-btn" onClick={()=>setEmojiOpen(v=>!v)} aria-label="Emoji"><Smile size={19}/></button>{emojiOpen&&<div className="emoji-pop">{EMOJIS.map(e=><button key={e} onClick={()=>setText(v=>v+e)}>{e}</button>)}</div>}</div><textarea value={text} maxLength={500} onChange={e=>updateTyping(e.target.value)} onKeyDown={onKey} placeholder="Type your message..." rows={1}/><button className="send-btn" disabled={!text.trim()||sending} onClick={send}><Send size={18}/></button></div><div className="composer-meta"><span className={text.length>500?'danger':''}>{text.length} / 500</span>{error&&<span className="error-text">{error}</span>}<span className="input-note">English only · 3 messages / 10s</span></div></div>
    </main>{offlineGameOpen&&<OfflineGame onClose={()=>setOfflineGameOpen(false)}/>} {clearConfirmOpen&&<div className="clear-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="clear-modal-title"><div className="clear-modal"><div className="clear-modal-icon"><Trash2 size={20}/></div><h3 id="clear-modal-title">Clear Chat?</h3><p>Clear all currently visible messages on this device?</p><span>Messages on other devices will not be deleted.</span><div className="clear-modal-actions"><button className="clear-cancel-btn" onClick={()=>setClearConfirmOpen(false)}>CANCEL</button><button className="clear-confirm-btn" onClick={()=>{clearChatLocally();setClearConfirmOpen(false)}}>CLEAR CHAT</button></div></div></div>}{settingsOpen&&<SettingsPanel profile={profile} settings={settings} onClose={()=>setSettingsOpen(false)} onSave={async(p,s)=>{try{const {error}=await supabase.functions.invoke('save-profile',{body:p});if(error)throw error;onProfile(p);onSettings(s);localStorage.setItem(PROFILE_KEY,JSON.stringify(p));localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));setSettingsOpen(false)}catch{setError('Could not save settings. Please try again.')}}}/>}</div>
}

function formatMessageTime(value:string,format:TimeFormat){return new Intl.DateTimeFormat(undefined,{hour:format==='24h'?'2-digit':'numeric',minute:'2-digit',hour12:format==='12h'}).format(new Date(value))}

const Message=memo(function Message({m,current,counts,mine,onToggle,onDelete,onReply,onCopy,onReplyJump,highlighted,copied,timeFormat}:{m:ChatMessage;current:boolean;counts:Record<string,number>;mine:string[];onToggle:(r:string)=>Promise<void>;onDelete:()=>void;onReply:()=>void;onCopy:()=>void;onReplyJump:(id:string)=>void;highlighted:boolean;copied:boolean;timeFormat:TimeFormat}){const countryName=iso31661.find(c=>c.alpha2===m.country)?.name??m.country; const subdivisionName=iso31662.find(s=>s.code===m.subdivision)?.name??m.subdivision.split('-').pop()??m.subdivision; const head=<div className="message-head">{<div className="message-identity"><div className="message-avatar">{AVATARS.find(a=>a.id===m.avatar_id)?.emoji??'🌍'}</div><div><strong>{m.name}</strong><span>{flag(m.country)} {subdivisionName}, {countryName}</span></div></div>}</div>; const deletable=canLocalDelete(m); return <article id={`msg-${m.id}`} className={`message-row ${current?'mine':''} ${highlighted?'highlighted':''}`}><div className="message-content"><div className="message-top">{head}</div><div className="bubble-wrap">{m.reply_to_id&&<button className="reply-preview" onClick={()=>onReplyJump(m.reply_to_id!)}><ReplyIcon size={13}/><span><b>{m.reply_to_name||'User'}</b>{m.reply_to_preview||'Reply'}</span></button>}<div className="bubble">{m.body}</div><time className="message-time" dateTime={m.created_at}>{formatMessageTime(m.created_at,timeFormat)}</time><button className="message-copy" onClick={onCopy} aria-label="Copy message" title={copied?"Copied":"Copy message"}>{copied?<Check size={12}/>:<Copy size={12}/>}</button><button className="message-reply" onClick={onReply} aria-label="Reply" title="Reply"><ReplyIcon size={13}/></button>{deletable&&<button className="message-delete" onClick={onDelete} aria-label="Delete this message on this device" title="Delete on this device"><Trash2 size={13}/></button>}</div><div className="reaction-row">{REACTIONS.map(r=><button key={r} className={mine.includes(r)?'reacted':''} onClick={()=>onToggle(r)}>{r}{counts[r]?<small>{counts[r]}</small>:null}</button>)}</div></div></article>});
function SettingsPanel({profile,settings,onClose,onSave}:{profile:Profile;settings:any;onClose:()=>void;onSave:(p:Profile,s:any)=>void}){const [p,setP]=useState(profile);const [s,setS]=useState(settings); const nameValid=p.name.trim().length>=2 && p.name.trim().length<=32; useEffect(()=>{const t=THEMES.find(x=>x.id===p.themeId)||THEMES[0]; document.documentElement.style.setProperty('--bg',t.bg);document.documentElement.style.setProperty('--surface',t.surface);document.documentElement.style.setProperty('--primary',t.primary);document.documentElement.style.setProperty('--accent',t.accent);document.documentElement.style.setProperty('--font-size',`${TEXT_SIZES[s.textSize as TextSize]}px`);},[p.themeId,s.textSize]); return <div className="modal-backdrop"><div className="settings-panel"><div className="panel-head"><div><b>⚙️ SETTINGS</b><span>Personalize your chat experience</span></div><button onClick={onClose}><X/></button></div><label>👤 Name / Nickname</label><input className="settings-name-input" maxLength={32} value={p.name} onChange={e=>setP({...p,name:e.target.value})} placeholder="Enter a nickname…" autoComplete="nickname"/><label>🖼️ Change Avatar</label><div className="avatar-grid compact">{AVATARS.map(a=><button className={`avatar ${p.avatarId===a.id?'selected':''}`} key={a.id} onClick={()=>setP({...p,avatarId:a.id})}>{a.emoji}</button>)}</div><label>🎨 Change Theme</label><div className="theme-grid compact-themes">{THEMES.map(t=><button className={`theme-tile ${p.themeId===t.id?'selected':''}`} key={t.id} style={{background:t.bg,borderColor:t.primary}} onClick={()=>setP({...p,themeId:t.id})}><span style={{background:t.primary}}></span><strong>{t.name}</strong></button>)}</div><label>🔤 Text Size</label><div className="segmented">{(['small','medium','large','xl'] as TextSize[]).map(k=><button className={s.textSize===k?'active':''} key={k} onClick={()=>setS({...s,textSize:k})}>{k==='xl'?'Extra Large':k[0].toUpperCase()+k.slice(1)}</button>)}</div><label>🔔 Sound</label><div className="segmented two"><button className={s.sound?'active':''} onClick={()=>setS({...s,sound:true})}><Volume2 size={15}/> ON</button><button className={!s.sound?'active':''} onClick={()=>setS({...s,sound:false})}><MicOff size={15}/> OFF</button></div><label>🕐 Clock Format</label><div className="segmented two"><button className={(s.timeFormat||'12h')==='12h'?'active':''} onClick={()=>setS({...s,timeFormat:'12h'})}>12-hour</button><button className={(s.timeFormat||'12h')==='24h'?'active':''} onClick={()=>setS({...s,timeFormat:'24h'})}>24-hour</button></div><button className="primary-btn" disabled={!nameValid} onClick={()=>onSave({...p,name:p.name.trim().replace(/\s+/g,' ')},{...s,timeFormat:s.timeFormat||'12h'})}>SAVE SETTINGS <Check size={17}/></button></div></div>}


function OfflineGame({onClose}:{onClose:()=>void}){const [score,setScore]=useState(0);const [seconds,setSeconds]=useState(10);const [running,setRunning]=useState(true);useEffect(()=>{const t=window.setInterval(()=>setSeconds(s=>{if(s<=1){window.clearInterval(t);setRunning(false);return 0}return s-1}),1000);return()=>window.clearInterval(t)},[]);return <div className="offline-game-backdrop"><div className="offline-game"><div className="offline-game-head"><div><span className="game-kicker"><Gamepad2 size={15}/> OFFLINE MODE</span><h3>Tap Rush</h3><p>Internet is unavailable. Beat the timer!</p></div><button onClick={onClose}><X/></button></div><div className="game-score"><span>Score <b>{score}</b></span><span>Time <b>{seconds}s</b></span></div><button className="tap-target" disabled={!running} onClick={()=>setScore(v=>v+1)}>{running?'TAP!':'TIME UP'}</button><small>{running?'Tap as fast as you can.':'You can close this and return when the connection comes back.'}</small></div></div>}
