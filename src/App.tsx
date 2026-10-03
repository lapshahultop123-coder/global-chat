import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { iso31661, iso31662 } from 'iso-3166';
import { AlertTriangle, ArrowDown, ArrowLeft, Ban, Bell, BookOpen, Bug, Check, ChevronDown, Clock3, Copy, Eye, EyeOff, Globe2, Image, KeyRound, LockKeyhole, LogOut, MessageCircle, Mic, MicOff, MoreVertical, Palette, Pause, Pencil, Pin, Play, Plus, Reply as ReplyIcon, RefreshCw, Search, Send, Settings, Smile, Square, Trash2, UserRound, Users, Volume2, Wifi, WifiOff, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AVATARS, AVATAR_PICKER_AVATARS, AVATAR_PICKER_STYLES, REACTIONS, THEMES, TEXT_SIZES, type TextSize } from './data/catalog';
import ActionDialog from './ActionDialog';
import EarthGlobe from './EarthGlobe';
import EmojiPicker from './EmojiPicker';
import InlineMessageEditor from './InlineMessageEditor';

import { validateMessage } from './lib/validation';
import { clearRemoteActivity, updateRemoteActivity } from './lib/realtimeActivity';
const PrivateCallCenter = lazy(() => import('./PrivateCallCenter'));
const FriendsPanel = lazy(() => import('./FriendsPanel'));
import './styles.css';

type Profile = { name:string; country:string; subdivision:string; avatarId:number; themeId:string; agreed:boolean };
type TimeFormat = '12h' | '24h';
type ChatMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; body:string; created_at:string; expires_at:string; edited_at?:string|null; reply_to_id?:string|null; reply_to_voice_id?:string|null; reply_to_preview?:string|null; reply_to_name?:string|null };
type VoiceMessage = { id:string; user_id:string; name:string; country:string; subdivision:string; avatar_id:number; audio_url:string; storage_path:string; duration_ms:number; created_at:string; expires_at:string; reply_to_message_id?:string|null; reply_to_voice_id?:string|null; reply_to_preview?:string|null; reply_to_name?:string|null };
const VOICE_LOCAL_DELETED_KEY='global-chat-voice-local-deleted-v1';
const PROFILE_KEY='global-chat-profile-v1';
const SETTINGS_KEY='global-chat-settings-v1';
const ACCOUNT_PASSWORD_KEY='global-chat-account-password-session-v1';
const LOCAL_DELETED_KEY='global-chat-local-deleted-v1';
const PRIVATE_CHAT_LOCAL_KEY='global-chat-private-room-v1';
const PRIVATE_CHAT_HIDDEN_KEY='global-chat-your-private-chats-hidden-v1';
const PRIVATE_CHAT_CACHE_KEY='global-chat-your-private-chats-cache-v1';
const PRIVATE_CHAT_PINNED_KEY='global-chat-your-private-chats-pinned-v1';
const EMPTY_REACTION_COUNTS:Record<string,number>={};
const EMPTY_REACTIONS:string[]=[];

function flag(code:string){return code.toUpperCase().replace(/./g,c=>String.fromCodePoint(c.charCodeAt(0)+127397));}
function avatarSrc(id:number){return AVATARS.find(a=>a.id===id)?.src ?? AVATARS[0].src;}
function avatarPickerStyleForId(id:number){const style=AVATARS.find(a=>a.id===id)?.style;return AVATAR_PICKER_STYLES.some(item=>item.name===style)?style!:AVATAR_PICKER_STYLES[0].name;}
function readJSON<T>(key:string, fallback:T):T { try { const x=localStorage.getItem(key); return x ? JSON.parse(x) as T : fallback; } catch { return fallback; } }
function readSessionValue(key:string):string { try { return sessionStorage.getItem(key)||''; } catch { return ''; } }
async function edgeFunctionErrorMessage(error:unknown,fallback:string){const response=(error as {context?:Response}|null)?.context;if(response&&typeof response.clone==='function'){try{const body=await response.clone().json();if(typeof body?.error==='string')return body.error}catch{}}return fallback}
async function invokeWithFreshSession(functionName:string,body:Record<string,any>){
  const current=await supabase.auth.getSession();
  if(current.error)throw current.error;
  let session=current.data.session;
  if(!session)throw new Error('Session expired. Please sign in again.');
  if(!session.expires_at||session.expires_at*1000<=Date.now()+60000){
    const refreshed=await supabase.auth.refreshSession();
    if(refreshed.error||!refreshed.data.session)throw new Error('Session expired. Please sign in again.');
    session=refreshed.data.session;
  }
  let result=await supabase.functions.invoke(functionName,{body,headers:{Authorization:`Bearer ${session.access_token}`}});
  if(result.error&&(result.error as any).context?.status===401){
    const refreshed=await supabase.auth.refreshSession();
    if(refreshed.error||!refreshed.data.session)throw new Error('Session expired. Please sign in again.');
    result=await supabase.functions.invoke(functionName,{body,headers:{Authorization:`Bearer ${refreshed.data.session.access_token}`}});
  }
  return result;
}
function themeGradientSamples(stops:string[]){
  const colors=stops.map(hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)));
  return Array.from({length:21},(_,sample)=>{
    const progress=sample/20*(colors.length-1),index=Math.min(colors.length-2,Math.floor(progress)),fraction=progress-index;
    const color=colors.length===1?colors[0]:colors[index].map((channel,axis)=>channel+(colors[index+1][axis]-channel)*fraction);
    return color.map(channel=>Math.round(channel).toString(16).padStart(2,'0')).join('');
  });
}
function themeLuminance(hex:string){
  const [r,g,b]=[0,2,4].map(index=>{const channel=parseInt(hex.slice(index,index+2),16)/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4});
  return 0.2126*r+0.7152*g+0.0722*b;
}
function contrastForThemeText(luminance:number,white:boolean){return white?1.05/(luminance+0.05):(luminance+0.05)/0.05}
function themeButtonText(stops:string[]){
  const samples=themeGradientSamples(stops);
  const whiteContrast=Math.min(...samples.map(color=>contrastForThemeText(themeLuminance(color),true)));
  const blackContrast=Math.min(...samples.map(color=>contrastForThemeText(themeLuminance(color),false)));
  return whiteContrast>=blackContrast?'#fff':'#101114';
}
function accessibleThemeGradient(stops:string[],foreground:string){
  const white=foreground==='#fff',target=white?0:255,threshold=4.6;
  const adjusted=themeGradientSamples(stops).map(color=>{
    const channels=[0,2,4].map(index=>parseInt(color.slice(index,index+2),16));
    const makeCandidate=(amount:number)=>channels.map(channel=>Math.round(channel+(target-channel)*amount).toString(16).padStart(2,'0')).join('');
    if(contrastForThemeText(themeLuminance(color),white)>=threshold)return `#${color}`;
    let low=0,high=1;
    for(let attempt=0;attempt<20;attempt++){
      const middle=(low+high)/2;
      if(contrastForThemeText(themeLuminance(makeCandidate(middle)),white)>=threshold)high=middle;else low=middle;
    }
    return `#${makeCandidate(high)}`;
  });
  return `linear-gradient(135deg,${adjusted.map((color,index)=>`${color} ${index*5}%`).join(',')})`;
}
function applyTheme(theme:typeof THEMES[number],root:HTMLElement=document.documentElement){
  root.style.setProperty('--bg',theme.bg);root.style.setProperty('--surface',theme.surface);root.style.setProperty('--primary',theme.primary);root.style.setProperty('--accent',theme.accent);
  const buttonText=themeButtonText([theme.primary,theme.accent]);
  root.style.setProperty('--theme-button-text',buttonText);
  root.style.setProperty('--theme-button-gradient',accessibleThemeGradient([theme.primary,theme.accent],buttonText));
  const primaryText=themeButtonText([theme.primary]);
  root.style.setProperty('--theme-primary-text',primaryText);
  root.style.setProperty('--theme-primary-gradient',accessibleThemeGradient([theme.primary],primaryText));
  root.dataset.theme=theme.id;
}
function hasPrivateChatCache(){try{return localStorage.getItem(PRIVATE_CHAT_CACHE_KEY)!==null}catch{return false}}
function readPrivateChatCache(){const cached=readJSON<any[]>(PRIVATE_CHAT_CACHE_KEY,[]);return Array.isArray(cached)?cached:[]}
function sortPrivateChats(rooms:any[],pinnedIds:string[]){const pinned=new Set(pinnedIds);return [...rooms].sort((a,b)=>Number(pinned.has(b.id))-Number(pinned.has(a.id))||((new Date(b.created_at||0).getTime()||0)-(new Date(a.created_at||0).getTime()||0)))}

export default function App(){
  const [profile,setProfile]=useState<Profile|null>(()=>readJSON<Profile|null>(PROFILE_KEY,null));
  const [settings,setSettings]=useState(()=>readJSON(SETTINGS_KEY,{textSize:'medium' as TextSize,sound:true,timeFormat:'12h' as TimeFormat}));
  const [accountPassword,setAccountPassword]=useState(()=>readSessionValue(ACCOUNT_PASSWORD_KEY));
  const [authReady,setAuthReady]=useState(false); const [hasSession,setHasSession]=useState(false); const [bootError,setBootError]=useState('');
  useEffect(()=>{ (async()=>{ try { const {data,error}=await supabase.auth.getSession(); if(error) throw error; if(data.session){setHasSession(true);if(!readJSON<Profile|null>(PROFILE_KEY,null)){const cloudProfile=await loadSavedProfile();if(cloudProfile){localStorage.setItem(PROFILE_KEY,JSON.stringify(cloudProfile));setProfile(cloudProfile)}}} setAuthReady(true); } catch { setBootError('Unable to connect securely. Please refresh and try again.'); } })(); },[]);
  const saveProfile=(p:Profile,pin?:string)=>{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));if(pin!==undefined){try{sessionStorage.setItem(ACCOUNT_PASSWORD_KEY,pin)}catch{}setAccountPassword(pin)}setProfile(p)};
  const startGuestAccount=async()=>{clearAccountDeviceData();setProfile(null);setAccountPassword('');setSettings(defaultSettings());const {error}=await supabase.auth.signInAnonymously();if(error)throw error;setHasSession(true)};
  const recoverSavedAccount=async(publicUid:string,pin:string)=>{const {data,error}=await supabase.functions.invoke('account-recovery',{body:{action:'recover',publicUid,pin}});if(error)throw new Error(await edgeFunctionErrorMessage(error,'Could not check this UID and password. Please try again.'));if(!data?.tokenHash)throw new Error(data?.error||'Invalid UID or password.');const {data:authData,error:authError}=await supabase.auth.verifyOtp({token_hash:data.tokenHash,type:'magiclink'});if(authError||!authData.session)throw new Error('Could not open this account. Check the UID and password, then try again.');clearAccountDeviceData();const cloudProfile=await loadSavedProfile();if(!cloudProfile)throw new Error('This account has no saved profile. Please contact support before continuing.');localStorage.setItem(PROFILE_KEY,JSON.stringify(cloudProfile));try{sessionStorage.setItem(ACCOUNT_PASSWORD_KEY,pin)}catch{}setAccountPassword(pin);void supabase.functions.invoke('account-recovery',{body:{action:'remember-password',pin}}).catch(()=>{});setProfile(cloudProfile);setSettings(defaultSettings());setHasSession(true);setAuthReady(true)};
  const logOut=async()=>{const {error}=await supabase.auth.signOut();if(error)throw error;clearAccountDeviceData();setProfile(null);setAccountPassword('');setSettings(defaultSettings());setHasSession(false)};
  if(!authReady) return <div className="boot"><img className="logo-orbit logo-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" /><h1>GLOBAL CHAT</h1><p>{bootError||'Connecting securely...'}</p>{bootError&&<button className="primary-btn boot-retry" onClick={()=>location.reload()}>TRY AGAIN</button>}</div>;
  if(!hasSession)return <AccountAccess onRecover={recoverSavedAccount} onContinueAsGuest={startGuestAccount}/>;
  return profile ? <Chat profile={profile} settings={settings} accountPassword={accountPassword} onAccountPasswordChange={pin=>{try{sessionStorage.setItem(ACCOUNT_PASSWORD_KEY,pin)}catch{}setAccountPassword(pin)}} onSettings={setSettings} onProfile={saveProfile} onLogout={logOut}/> : <ProfileSetup onEnter={saveProfile} onBackToLogin={logOut}/>;
}

function defaultSettings(){return {textSize:'medium' as TextSize,sound:true,timeFormat:'12h' as TimeFormat}}
function clearAccountDeviceData(){for(const key of [PROFILE_KEY,SETTINGS_KEY,VOICE_LOCAL_DELETED_KEY,LOCAL_DELETED_KEY,PRIVATE_CHAT_LOCAL_KEY,PRIVATE_CHAT_HIDDEN_KEY,PRIVATE_CHAT_CACHE_KEY,PRIVATE_CHAT_PINNED_KEY])try{localStorage.removeItem(key)}catch{}try{sessionStorage.removeItem(ACCOUNT_PASSWORD_KEY)}catch{}}
async function loadSavedProfile():Promise<Profile|null>{const {data,error}=await supabase.from('profiles').select('name,country,subdivision,avatar_id,theme_id,agreed').maybeSingle();if(error||!data)return null;return {name:data.name,country:data.country,subdivision:data.subdivision,avatarId:Number(data.avatar_id),themeId:data.theme_id||'midnight',agreed:Boolean(data.agreed)}}

function AccountAccess({onRecover,onContinueAsGuest}:{onRecover:(uid:string,pin:string)=>Promise<void>;onContinueAsGuest:()=>Promise<void>}){
 const [publicUid,setPublicUid]=useState('');const [pin,setPin]=useState('');const [showPin,setShowPin]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const recover=async(event:React.FormEvent)=>{event.preventDefault();if(!/^\d{10}$/.test(publicUid)||!/^\d{5}$/.test(pin)){setError('Enter your 10-digit UID and 5-digit password.');return}setBusy(true);setError('');try{await onRecover(publicUid,pin)}catch(e){setError(e instanceof Error?e.message:'Could not restore this account.')}finally{setBusy(false)}};
 const guest=async()=>{setBusy(true);setError('');try{await onContinueAsGuest()}catch(e){setError(e instanceof Error?e.message:'Could not create a new account.')}finally{setBusy(false)}};
 return <div className="account-access-page"><section className="account-access-card"><div className="account-access-brand"><img src="/global-chat-logo.svg" alt=""/><div><h1>Welcome back</h1><p>Log in with your UID and 5-digit password to access your account and chats.</p></div></div><form onSubmit={recover}><label htmlFor="restore-uid">10-digit UID</label><input id="restore-uid" inputMode="numeric" autoComplete="username" maxLength={10} value={publicUid} onChange={e=>setPublicUid(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="Enter your UID"/><label htmlFor="restore-pin">5-digit password</label><div className="restore-pin-wrap"><input id="restore-pin" inputMode="numeric" autoComplete="current-password" maxLength={5} type={showPin?'text':'password'} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,5))} placeholder="Enter your password"/><button type="button" onClick={()=>setShowPin(v=>!v)} aria-label={showPin?'Hide password':'Show password'} title={showPin?'Hide password':'Show password'}>{showPin?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{error&&<div className="account-access-error" role="alert">{error}</div>}<button className="primary-btn account-login-btn" type="submit" disabled={busy||publicUid.length!==10||pin.length!==5}>{busy?'LOGGING IN...':'LOG IN'}</button></form><div className="account-access-divider"><span>OR</span></div><button className="account-guest-btn" type="button" disabled={busy} onClick={()=>void guest()}>CONTINUE AS NEW USER</button><small>Keep your UID and password somewhere safe. Recovery is limited to protect your account.</small></section></div>
}

function ProfileSetup({onEnter,onBackToLogin}:{onEnter:(p:Profile,pin:string)=>void;onBackToLogin:()=>Promise<void>}){
 const [name,setName]=useState(''); const [country,setCountry]=useState(''); const [subdivision,setSubdivision]=useState(''); const [avatarId,setAvatarId]=useState(1); const [avatarStyle,setAvatarStyle]=useState<string>(AVATAR_PICKER_STYLES[0].name); const [themeId,setThemeId]=useState('midnight'); const [agreed,setAgreed]=useState(false); const [countryQuery,setCountryQuery]=useState(''); const [subQuery,setSubQuery]=useState(''); const [countryOpen,setCountryOpen]=useState(false); const [subOpen,setSubOpen]=useState(false);
  const [password,setPassword]=useState('');const [confirmPassword,setConfirmPassword]=useState('');const [showPassword,setShowPassword]=useState(false);const [enterBusy,setEnterBusy]=useState(false);const [saveErrorOpen,setSaveErrorOpen]=useState(false);const [saveError,setSaveError]=useState('');const [backBusy,setBackBusy]=useState(false);const [backError,setBackError]=useState('');
  useEffect(()=>{const t=THEMES.find(x=>x.id===themeId)||THEMES[0];applyTheme(t)},[themeId]);
  const countries=useMemo(()=>iso31661.filter(c=>c.state==='assigned').sort((a,b)=>a.name.localeCompare(b.name)),[]);
  const subdivisions=useMemo(()=>iso31662.filter(s=>s.code.startsWith(country+'-')).sort((a,b)=>a.name.localeCompare(b.name)),[country]);
  const filteredCountries=useMemo(()=>countries.filter(c=>(c.name+' '+c.alpha2+' '+c.alpha3).toLowerCase().includes(countryQuery.toLowerCase())),[countries,countryQuery]);
  const filteredSubs=useMemo(()=>subdivisions.filter(s=>(s.name+' '+s.code).toLowerCase().includes(subQuery.toLowerCase())).slice(0,120),[subdivisions,subQuery]);
  const selectedCountry=countries.find(c=>c.alpha2===country); const selectedSub=subdivisions.find(s=>s.code===subdivision);
  const valid=name.trim().length>=2 && name.trim().length<=32 && /^\d{5}$/.test(password) && password===confirmPassword && !!selectedCountry && !!selectedSub && agreed;
  const enter=async()=>{if(!valid||enterBusy)return;setEnterBusy(true);const p={name:name.trim().replace(/\s+/g,' '),country,subdivision,avatarId,themeId,agreed};try{const {data:profileData,error:profileError}=await supabase.functions.invoke('save-profile',{body:p});if(profileError||profileData?.error)throw new Error(profileData?.error||profileError?.message||'Could not save your profile.');const {data:passwordData,error:passwordError}=await supabase.functions.invoke('account-recovery',{body:{action:'set-password',pin:password}});if(passwordError||!passwordData?.configured)throw new Error(passwordData?.error||passwordError?.message||'Could not save your password. Please try again.');onEnter(p,password)}catch(error){setSaveError(error instanceof Error?error.message:'Could not complete account setup. Please try again.');setSaveErrorOpen(true)}finally{setEnterBusy(false)}};
  const backToLogin=async()=>{setBackBusy(true);setBackError('');try{await onBackToLogin()}catch{setBackError('Could not return to the log in page. Check your connection and try again.');setBackBusy(false)}};
  return <div className="setup-page"><div className="setup-shell">
    <div className="brand"><img className="brand-mark brand-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" /><div><h1>GLOBAL CHAT</h1><p>Create Your Profile</p></div><button type="button" className="profile-login-back" onClick={()=>void backToLogin()} disabled={backBusy}><ArrowLeft size={17}/>{backBusy?'PLEASE WAIT...':'BACK TO LOG IN PAGE'}</button></div>{backError&&<div className="profile-login-back-error" role="alert">{backError}</div>}
    <div className="setup-grid">
      <section className="card profile-card">
        <label>Name / Nickname</label><input maxLength={32} value={name} onChange={e=>setName(e.target.value)} placeholder="Enter a nickname..." autoComplete="nickname"/>
        <label htmlFor="setup-account-password">Your Password <small className="account-password-hint">Choose 5 digits. Use it with your UID to log in on another device.</small></label><div className="setup-password-wrap"><input id="setup-account-password" inputMode="numeric" pattern="[0-9]*" maxLength={5} autoComplete="new-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value.replace(/\D/g,'').slice(0,5))} placeholder="5-digit password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'} title={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div><input className="setup-password-confirm" inputMode="numeric" pattern="[0-9]*" maxLength={5} autoComplete="new-password" type={showPassword?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value.replace(/\D/g,'').slice(0,5))} placeholder="Confirm 5-digit password" aria-label="Confirm your 5-digit password"/>{confirmPassword&&password!==confirmPassword&&<small className="account-password-error" role="alert">Passwords do not match.</small>}
        <label>Country</label><div className="select-wrap" onClick={()=>setCountryOpen(true)}><input value={countryQuery || (selectedCountry ? `${flag(selectedCountry.alpha2)} ${selectedCountry.name} · ${selectedCountry.alpha2}`:'')} onFocus={()=>setCountryOpen(true)} onChange={e=>{setCountryQuery(e.target.value);setCountry('');setSubdivision('');setCountryOpen(true)}} placeholder="Search countries..."/><ChevronDown size={18}/></div>
        {countryOpen && <div className="option-list">{filteredCountries.map(c=><button key={c.alpha2} onClick={()=>{setCountry(c.alpha2);setCountryQuery('');setSubdivision('');setCountryOpen(false);setSubOpen(false)}}>{flag(c.alpha2)} {c.name}<span>{c.alpha2}</span></button>)}</div>}
        {selectedCountry && <div className="selected-chip">{flag(selectedCountry.alpha2)} {selectedCountry.name}<b>{selectedCountry.alpha2}</b><button onClick={()=>{setCountry('');setSubdivision('');setCountryOpen(false)}}><X size={14}/></button></div>}
        <label>State / Province / Region</label><div className="select-wrap" onClick={()=>{if(selectedCountry)setSubOpen(true)}}><input disabled={!selectedCountry} value={subQuery || (selectedSub ? `${selectedSub.name} · ${selectedSub.code}`:'')} onFocus={()=>selectedCountry&&setSubOpen(true)} onChange={e=>{setSubQuery(e.target.value);setSubdivision('');setSubOpen(true)}} placeholder={selectedCountry?'Search subdivisions...':'Select a country first'}/><ChevronDown size={18}/></div>
        {selectedCountry && subOpen && <div className="option-list">{filteredSubs.map(s=><button key={s.code} onClick={()=>{setSubdivision(s.code);setSubQuery('');setSubOpen(false)}}>{s.name}<span>{s.code}</span></button>)}</div>}
        {selectedSub && <div className="selected-chip">{selectedSub.name}<b>{selectedSub.code}</b><button onClick={()=>setSubdivision('')}><X size={14}/></button></div>}
        <label><UserRound size={15}/> Choose Your Avatar <small className="avatar-total">{AVATAR_PICKER_AVATARS.length} avatars · 26 single-letter initials</small></label><div className="avatar-style-tabs" role="tablist" aria-label="Avatar designs">{AVATAR_PICKER_STYLES.map(style=><button type="button" role="tab" aria-selected={avatarStyle===style.name} className={avatarStyle===style.name?'active':''} key={style.slug} onClick={()=>setAvatarStyle(style.name)}>{style.name}</button>)}</div><div className="avatar-grid">{AVATAR_PICKER_AVATARS.filter(a=>a.style===avatarStyle).map(a=><button type="button" className={`avatar ${avatarId===a.id?'selected':''}`} key={a.id} onClick={()=>setAvatarId(a.id)} aria-label={a.letter?`${a.letter} letter`:`${a.style} avatar ${a.variant+1}`} title={a.letter?`${a.letter} · ${a.style}`:`${a.style} · ${a.variant+1}`}><img src={a.src} alt={a.letter?`${a.letter} letter`:`${a.style} avatar ${a.variant+1}`}/></button>)}</div>
      </section>
      <section className="card theme-card"><label><Palette size={15}/> Choose Your Theme</label><div className="theme-grid">{THEMES.map(t=><button key={t.id} className={`theme-tile ${themeId===t.id?'selected':''}`} style={{background:t.bg,borderColor:t.primary}} onClick={()=>setThemeId(t.id)}><span style={{background:t.primary}}></span><strong>{t.name}</strong><small>Instant preview</small></button>)}</div>
        <div className="rules"><h3><BookOpen size={18}/> GLOBAL CHAT RULES</h3><ul><li>English only.</li><li>No bad words, harassment, threats, spam, or offensive content.</li><li>Keep text messages within 500 characters.</li><li>Public chat messages expire after 5 minutes; private and friend messages expire after 24 hours.</li><li>Voice messages can be up to 60 seconds and must use supported audio formats.</li><li>Public chat allows limited sending to reduce spam and abuse.</li><li>Private chats are protected by a unique 8-character private code and visible only to joined members.</li><li>Do not share private codes with people you do not trust.</li><li>Replies, emoji reactions, typing indicators, and online status are available in chat.</li><li>Delete for me removes a message only from your view; Delete for everyone is available to the sender and removes the message for everyone.</li><li>Clear Chat clears the currently visible chat on your device; it does not erase other users' history.</li><li>No photo or file uploads.</li><li>Be respectful and use Global Chat responsibly.</li></ul><label className="agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I agree to the rules</span></label></div>
        <button className="primary-btn" disabled={!valid||enterBusy} onClick={enter}>{enterBusy?'SAVING PROFILE...':'ENTER CHAT'} <span>&rarr;</span></button>
      </section>
    </div>
  </div>{saveErrorOpen&&<ActionDialog title="Account setup could not be completed" message={saveError} confirmLabel="Got it" cancelLabel="" tone="accent" onConfirm={()=>setSaveErrorOpen(false)} onCancel={()=>setSaveErrorOpen(false)}/>}</div>
}

function readVoiceLocalDeleted():Record<string,number>{const raw=readJSON<Record<string,number>>(VOICE_LOCAL_DELETED_KEY,{});const now=Date.now();const clean=Object.fromEntries(Object.entries(raw).filter(([,expires])=>expires>now));if(Object.keys(clean).length!==Object.keys(raw).length)try{localStorage.setItem(VOICE_LOCAL_DELETED_KEY,JSON.stringify(clean))}catch{}return clean}
function persistVoiceLocalDeleted(next:Record<string,number>){try{localStorage.setItem(VOICE_LOCAL_DELETED_KEY,JSON.stringify(next))}catch{}}

function readLocalDeleted():Record<string,number>{const raw=readJSON<Record<string,number>>(LOCAL_DELETED_KEY,{});const now=Date.now();const clean=Object.fromEntries(Object.entries(raw).filter(([,expires])=>expires>now));if(Object.keys(clean).length!==Object.keys(raw).length)try{localStorage.setItem(LOCAL_DELETED_KEY,JSON.stringify(clean))}catch{}return clean}
function localMessageKey(m:Pick<ChatMessage,'id'|'user_id'|'body'|'created_at'>){return m.id.startsWith('optimistic-')?`${m.user_id}|${m.created_at}|${m.body}`:m.id}
function canLocalDelete(m:ChatMessage){return new Date(m.expires_at).getTime()-Date.now()>0}
function canEditMessage(m:{created_at:string;expires_at:string;id:string}){const age=Date.now()-new Date(m.created_at).getTime();return !m.id.startsWith('optimistic-')&&age>=0&&age<5*60*1000&&new Date(m.expires_at).getTime()>Date.now()}

function Chat({profile,settings,accountPassword,onAccountPasswordChange,onSettings,onProfile,onLogout}:{profile:Profile;settings:{textSize:TextSize;sound:boolean;timeFormat?:TimeFormat};accountPassword:string;onAccountPasswordChange:(pin:string)=>void;onSettings:(x:any)=>void;onProfile:(x:Profile)=>void;onLogout:()=>Promise<void>}){
  const [messages,setMessages]=useState<ChatMessage[]>([]); const [voiceMessages,setVoiceMessages]=useState<VoiceMessage[]>([]); const [voiceLocalDeleted,setVoiceLocalDeleted]=useState<Record<string,number>>(()=>readVoiceLocalDeleted()); const [recording,setRecording]=useState(false); const [recordingStream,setRecordingStream]=useState<MediaStream|null>(null); const [recordingSeconds,setRecordingSeconds]=useState(0); const [recordedVoiceBlob,setRecordedVoiceBlob]=useState<Blob|null>(null); const [recordedVoiceDuration,setRecordedVoiceDuration]=useState(0); const [micPermission,setMicPermission]=useState<'unknown'|'prompt'|'granted'|'denied'>('unknown'); const [micNotice,setMicNotice]=useState(false); const mediaRecorderRef=useRef<MediaRecorder|null>(null); const mediaChunksRef=useRef<Blob[]>([]); const recordingTimerRef=useRef<number|undefined>(undefined); const recordingStartedRef=useRef<number>(0); const [localDeleted,setLocalDeleted]=useState<Record<string,number>>(()=>readLocalDeleted()); const messagesRef=useRef<ChatMessage[]>([]); const messageIdsRef=useRef<string[]>([]); const [online,setOnline]=useState(0); const [reactionCounts,setReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [myReactions,setMyReactions]=useState<Record<string,string[]>>({}); const [voiceReactionCounts,setVoiceReactionCounts]=useState<Record<string,Record<string,number>>>({}); const [voiceMyReactions,setVoiceMyReactions]=useState<Record<string,string[]>>({}); const [authUserId,setAuthUserId]=useState(''); const [text,setText]=useState(''); const [error,setError]=useState(''); const [settingsOpen,setSettingsOpen]=useState(false); const [clearConfirmOpen,setClearConfirmOpen]=useState(false); const [deleteConfirmMessage,setDeleteConfirmMessage]=useState<ChatMessage|null>(null); const [deletingForEveryone,setDeletingForEveryone]=useState(false); const [emojiOpen,setEmojiOpen]=useState(false); const [connected,setConnected]=useState(false); const [connectionState,setConnectionState]=useState<'connected'|'reconnecting'|'offline'>('connected'); const [sending,setSending]=useState(false); const [voiceSendingPending,setVoiceSendingPending]=useState(false); const [typingUsers,setTypingUsers]=useState<string[]>([]); const [recordingUsers,setRecordingUsers]=useState<string[]>([]); const publicTypingActiveRef=useRef(false); const publicTypingHeartbeatRef=useRef<number|undefined>(undefined); const publicRecordingHeartbeatRef=useRef<number|undefined>(undefined); const publicTypingUsersRef=useRef(new Set<string>()); const publicTypingTimersRef=useRef(new Map<string,number>()); const publicRecordingUsersRef=useRef(new Set<string>()); const publicRecordingTimersRef=useRef(new Map<string,number>()); const [showJump,setShowJump]=useState(false); const [replyTarget,setReplyTarget]=useState<any|null>(null); const [searchOpen,setSearchOpen]=useState(false); const [feedbackOpen,setFeedbackOpen]=useState(false); const [mobileMenuOpen,setMobileMenuOpen]=useState(false); const [headerMenuOpen,setHeaderMenuOpen]=useState(false); const [friendsOpen,setFriendsOpen]=useState(false); const [friendsUnreadCount,setFriendsUnreadCount]=useState(0); const [searchQuery,setSearchQuery]=useState(''); const [newMessageCount,setNewMessageCount]=useState(0); const [highlightedMessageId,setHighlightedMessageId]=useState<string|null>(null); const [copiedId,setCopiedId]=useState<string|null>(null); const [playingVoiceId,setPlayingVoiceId]=useState<string|null>(null); const [playingVoiceElapsed,setPlayingVoiceElapsed]=useState(0); const voiceAudioRef=useRef<HTMLAudioElement|null>(null); const typingStopRef=useRef<number|undefined>(undefined); const replyMetaRef=useRef<Record<string,{replyToId:string;replyToPreview:string;replyToName:string}>>({}); const channelRef=useRef<any>(null); const listRef=useRef<HTMLDivElement>(null); const audioRef=useRef<{send:HTMLAudioElement;receive:HTMLAudioElement}|null>(null); const sessionRef=useRef<any>(null); const pendingRef=useRef<Record<string,{tempId:string;body:string;createdAt:string}>>({}); const sendLockRef=useRef(false);
  const pendingVoiceDeleteIdsRef=useRef(new Set<string>());
  const [privateRoom,setPrivateRoom]=useState<any>(()=>{try{return JSON.parse(localStorage.getItem(PRIVATE_CHAT_LOCAL_KEY)||'null')}catch{return null}});
  const messageRenderKeysRef=useRef<Record<string,string>>({});
  const voiceRenderKeysRef=useRef<Record<string,string>>({});
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
  const privateChannelRef=useRef<any>(null); const privateRoomStartedRef=useRef<string|null>(null); const privatePollRef=useRef<number|undefined>(undefined); const [privateOnline,setPrivateOnline]=useState(0); const [privateTyping,setPrivateTyping]=useState(false); const [privateRecording,setPrivateRecording]=useState(false); const privateTypingStopRef=useRef<number|undefined>(undefined); const privateTypingActiveRef=useRef(false); const privateTypingHeartbeatRef=useRef<number|undefined>(undefined); const privateRecordingHeartbeatRef=useRef<number|undefined>(undefined); const privateTypingUsersRef=useRef(new Set<string>()); const privateTypingTimersRef=useRef(new Map<string,number>()); const privateRecordingUsersRef=useRef(new Set<string>()); const privateRecordingTimersRef=useRef(new Map<string,number>());
  const [yourPrivateChatsOpen,setYourPrivateChatsOpen]=useState(false);
  const [pinnedPrivateChatIds,setPinnedPrivateChatIds]=useState<string[]>(()=>readJSON<string[]>(PRIVATE_CHAT_PINNED_KEY,[]));
  const [yourPrivateChats,setYourPrivateChats]=useState<any[]>(()=>sortPrivateChats(readPrivateChatCache().filter((room:any)=>!readJSON<string[]>(PRIVATE_CHAT_HIDDEN_KEY,[]).includes(room.id)),readJSON<string[]>(PRIVATE_CHAT_PINNED_KEY,[])));
  const [yourPrivateChatsLoading,setYourPrivateChatsLoading]=useState(()=>!hasPrivateChatCache());
  const [yourPrivateChatsError,setYourPrivateChatsError]=useState('');
  const privateChatsLoadedRef=useRef(hasPrivateChatCache());
  const privateChatsRequestRef=useRef<Promise<void>|null>(null);
  const [hiddenPrivateChatIds,setHiddenPrivateChatIds]=useState<string[]>(()=>readJSON<string[]>(PRIVATE_CHAT_HIDDEN_KEY,[]));
  const [privateRenameRoom,setPrivateRenameRoom]=useState<any>(null); const [privateRenameName,setPrivateRenameName]=useState('');
  const [privateMembersOpen,setPrivateMembersOpen]=useState(false); const [privateMembers,setPrivateMembers]=useState<any[]>([]); const [privateBlockedMembers,setPrivateBlockedMembers]=useState<any[]>([]); const [privateMembersLoading,setPrivateMembersLoading]=useState(false); const [privateMembersError,setPrivateMembersError]=useState('');


  const loadYourPrivateChats=()=>{
    if(privateChatsRequestRef.current)return privateChatsRequestRef.current;
    if(!privateChatsLoadedRef.current)setYourPrivateChatsLoading(true);
    setYourPrivateChatsError('');
    const hidden=readJSON<string[]>(PRIVATE_CHAT_HIDDEN_KEY,[]);
    const pinned=readJSON<string[]>(PRIVATE_CHAT_PINNED_KEY,[]);
    setHiddenPrivateChatIds(hidden);
    setPinnedPrivateChatIds(pinned);
    let request!:Promise<void>;
    request=(async()=>{try{
      const {data,error}=await supabase.from('private_rooms').select('id,name,join_code,owner_id,created_at').order('created_at',{ascending:false});
      if(error)throw error;
      const rooms=sortPrivateChats((data||[]).filter((room:any)=>!hidden.includes(room.id)),pinned);
      try{localStorage.setItem(PRIVATE_CHAT_CACHE_KEY,JSON.stringify(data||[]))}catch{}
      privateChatsLoadedRef.current=true;
      setYourPrivateChats(rooms);
    }catch(error){setYourPrivateChatsError(error instanceof Error?error.message:'Could not load private chats. Please retry.')}finally{setYourPrivateChatsLoading(false);if(privateChatsRequestRef.current===request)privateChatsRequestRef.current=null}})();
    privateChatsRequestRef.current=request;
    return request;
  };

  const togglePrivateChatPin=(room:any)=>{
    const current=readJSON<string[]>(PRIVATE_CHAT_PINNED_KEY,[]);
    const next=current.includes(room.id)?current.filter(id=>id!==room.id):[...current,room.id];
    try{localStorage.setItem(PRIVATE_CHAT_PINNED_KEY,JSON.stringify(next))}catch{}
    setPinnedPrivateChatIds(next);
    setYourPrivateChats(prev=>sortPrivateChats(prev,next));
  };

  const removeFromYourPrivateChats=(room:any)=>{
    const current=readJSON<string[]>(PRIVATE_CHAT_HIDDEN_KEY,[]);
    const next=Array.from(new Set([...current,room.id]));
    try{localStorage.setItem(PRIVATE_CHAT_HIDDEN_KEY,JSON.stringify(next))}catch{}
    setHiddenPrivateChatIds(next);
    const pinned=readJSON<string[]>(PRIVATE_CHAT_PINNED_KEY,[]).filter(id=>id!==room.id);
    try{localStorage.setItem(PRIVATE_CHAT_PINNED_KEY,JSON.stringify(pinned))}catch{}
    setPinnedPrivateChatIds(pinned);
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
  const removePrivateMember=async(member:any)=>{if(!privateRoom||member.user_id===authUserId)return;const {error}=await supabase.rpc('remove_private_room_member',{p_room_id:privateRoom.id,p_user_id:member.user_id});if(error){setPrivateMembersError(error.message);return}await loadPrivateMembers(privateRoom.id)};
  const blockPrivateMember=async(member:any)=>{if(!privateRoom||member.user_id===authUserId)return;const {error}=await supabase.rpc('block_private_room_member',{p_room_id:privateRoom.id,p_user_id:member.user_id});if(error){setPrivateMembersError(error.message);return}await loadPrivateMembers(privateRoom.id)};
  const unblockPrivateMember=async(member:any)=>{if(!privateRoom)return;const {error}=await supabase.rpc('unblock_private_room_member',{p_room_id:privateRoom.id,p_user_id:member.user_id});if(error){setPrivateMembersError(error.message);return}await loadPrivateMembers(privateRoom.id)};

  const theme=THEMES.find(t=>t.id===profile.themeId) ?? THEMES[0];
  useEffect(()=>{applyTheme(theme);document.documentElement.style.setProperty('--font-size',`${TEXT_SIZES[settings.textSize]}px`);},[theme,settings.textSize]);
  const isNearBottom=useCallback(()=>{const el=listRef.current;if(!el)return true;return el.scrollHeight-el.scrollTop-el.clientHeight<120},[]);
  const copyMessage=useCallback(async(m:ChatMessage)=>{try{await navigator.clipboard.writeText(m.body);setCopiedId(m.id);window.setTimeout(()=>setCopiedId(id=>id===m.id?null:id),1200)}catch{}},[]);
  const activeSearch=searchQuery.trim().toLowerCase();
  const displayedMessages=useMemo(()=>activeSearch?messages.filter(m=>`${m.name} ${m.body} ${m.country} ${m.subdivision}`.toLowerCase().includes(activeSearch)):messages,[messages,activeSearch]);
  useEffect(()=>{if(!searchOpen)setSearchQuery('')},[searchOpen]);
  useEffect(()=>{if(highlightedMessageId){const t=window.setTimeout(()=>setHighlightedMessageId(null),1500);return()=>window.clearTimeout(t)}},[highlightedMessageId]);

  useEffect(()=>{const vv=window.visualViewport;if(!vv)return;const apply=()=>document.documentElement.style.setProperty('--app-height',`${vv.height}px`);apply();vv.addEventListener('resize',apply);vv.addEventListener('scroll',apply);return()=>{vv.removeEventListener('resize',apply);vv.removeEventListener('scroll',apply)}},[]);
  useEffect(()=>{audioRef.current={send:new Audio('/sounds/send.wav'),receive:new Audio('/sounds/receive.wav')};},[]);
  const play=(which:'send'|'receive')=>{if(!settings.sound||!audioRef.current)return;const a=audioRef.current[which];a.currentTime=0;a.play().catch(()=>{});}; const playAction=(src:string)=>{if(!settings.sound)return;const a=new Audio(src);a.volume=0.45;a.play().catch(()=>{});};
   const refresh=useCallback(async()=>{
     const startedAt=Date.now();
     const [messageResult,voiceResult]=await Promise.all([
       supabase.from('messages').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100),
       supabase.from('voice_messages').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100)
     ]);
     if(!messageResult.error&&messageResult.data){
       const rawServer=(messageResult.data as ChatMessage[]).filter(m=>!localDeleted[localMessageKey(m)]);
       const server=rawServer.map(m=>{const target=rawServer.find(x=>x.id===m.reply_to_id);return target?{...m,reply_to_preview:target.body,reply_to_name:target.name}:m});
       setMessages(prev=>{
         const pending=prev.filter(m=>m.id.startsWith('optimistic-')&&pendingRef.current[m.id]&&!localDeleted[localMessageKey(m)]);
         const liveArrivals=prev.filter(m=>!m.id.startsWith('optimistic-')&&new Date(m.created_at).getTime()>=startedAt&&!server.some(x=>x.id===m.id));
         return [...server,...liveArrivals,...pending.filter(m=>!server.some(x=>x.user_id===m.user_id&&x.body===m.body&&Math.abs(new Date(x.created_at).getTime()-new Date(m.created_at).getTime())<15000))].sort((a,b)=>a.created_at.localeCompare(b.created_at));
       });
     }
     if(!voiceResult.error&&voiceResult.data){
        const server=(voiceResult.data as VoiceMessage[]).filter(v=>!voiceLocalDeleted[v.id]&&!pendingVoiceDeleteIdsRef.current.has(v.id));
       setVoiceMessages(prev=>{
         const merged=new Map(server.map(v=>[v.id,v]));
         prev.filter(v=>new Date(v.created_at).getTime()>=startedAt&&!voiceLocalDeleted[v.id]).forEach(v=>{if(!merged.has(v.id))merged.set(v.id,v)});
         return [...merged.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at));
       });
     }
   },[localDeleted,voiceLocalDeleted]);
const refreshReactions=useCallback(async(ids:string[],userId:string)=>{if(!ids.length)return;const {data}=await supabase.from('message_reactions').select('message_id,user_id,reaction').in('message_id',ids);const counts:Record<string,Record<string,number>>={};const mine:Record<string,string[]>={};(data||[]).forEach((r:any)=>{counts[r.message_id]??={};counts[r.message_id][r.reaction]=(counts[r.message_id][r.reaction]||0)+1;if(r.user_id===userId)(mine[r.message_id]??=[]).push(r.reaction)});setReactionCounts(counts);setMyReactions(mine)},[]);
  const refreshVoiceReactions=useCallback(async(ids:string[],userId:string)=>{if(!ids.length)return;const {data}=await supabase.from('voice_reactions').select('voice_id,user_id,reaction').in('voice_id',ids);const counts:Record<string,Record<string,number>>={};const mine:Record<string,string[]>={};(data||[]).forEach((r:any)=>{counts[r.voice_id]??={};counts[r.voice_id][r.reaction]=(counts[r.voice_id][r.reaction]||0)+1;if(r.user_id===userId)(mine[r.voice_id]??=[]).push(r.reaction)});setVoiceReactionCounts(counts);setVoiceMyReactions(mine)},[]);
  useEffect(()=>{
    let mounted=true;
    let channel:any;
    let refreshTimer:number|undefined;
    let postgresChangesReady=false;
    const removeExpired=()=>setMessages(prev=>{
      const now=Date.now();
      const next=prev.filter(m=>new Date(m.expires_at).getTime()>now);
      return next.length===prev.length?prev:next;
    });
    const refreshNow=async()=>{await refresh();removeExpired()};
    const onVisibility=()=>{if(document.visibilityState==='visible')void refreshNow()};
    const onOnline=()=>{if(!mounted)return;setConnectionState('reconnecting');setConnected(false);void supabase.realtime.connect();void refreshNow()};
    const onOffline=()=>{if(!mounted)return;postgresChangesReady=false;setConnected(false);setConnectionState('offline')};
    const presenceUsers=()=>{
      if(!channel)return;
      const state=channel.presenceState() as Record<string,any[]>;
      if(mounted)setOnline(Object.keys(state).length);
    };
    (async()=>{
       void refreshNow();
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.user||!mounted)return;
      sessionRef.current=session;
      const selfId=session.user.id;
      setAuthUserId(selfId); console.log('Zynyro Creator/User ID:',selfId);
      await supabase.realtime.setAuth(session.access_token);
      channel=supabase.channel('global-chat',{config:{presence:{key:selfId},broadcast:{self:false,ack:true}}});
      channelRef.current=channel;
      channel
        .on('system',{},(payload:any)=>{
          if(payload?.extension!=='postgres_changes')return;
          const wasReady=postgresChangesReady;
          postgresChangesReady=payload.status==='ok';
          if(!postgresChangesReady){
            console.warn('Global chat database change subscription is unavailable:',payload.message||payload.status);
            void refreshNow();
          }else if(!wasReady){
            void refreshNow();
          }
        })
        .on('presence',{event:'sync'},presenceUsers)
        .on('presence',{event:'join'},presenceUsers)
        .on('presence',{event:'leave'},presenceUsers)
        .on('broadcast',{event:'typing',config:{self:false}},({payload}:any)=>{
          const id=payload?.userId;
          if(!id||id===selfId)return;
          updateRemoteActivity(publicTypingUsersRef.current,publicTypingTimersRef.current,id,Boolean(payload?.typing),3200,setTypingUsers);
        })
        .on('broadcast',{event:'recording',config:{self:false}},({payload}:any)=>{
          const id=payload?.userId;
          if(!id||id===selfId)return;
          updateRemoteActivity(publicRecordingUsersRef.current,publicRecordingTimersRef.current,id,Boolean(payload?.recording),6500,setRecordingUsers);
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
              if(match){messageRenderKeysRef.current[m.id]=messageRenderKeysRef.current[match.id]||match.id;delete pendingRef.current[match.id];return prev.map(x=>x.id===match.id?m:x).sort((a,b)=>a.created_at.localeCompare(b.created_at))}
            }
            return [...prev,m].sort((a,b)=>a.created_at.localeCompare(b.created_at));
          });
          if(m.user_id!==selfId){play('receive'); if(!wasNearBottom)setNewMessageCount(c=>Math.min(c+1,99));}
          else if(wasNearBottom)setNewMessageCount(0);
        })
        .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},(payload:any)=>{delete messageRenderKeysRef.current[payload.old.id];setMessages(prev=>prev.filter(m=>m.id!==payload.old.id))})
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'},(payload:any)=>{setMessages(prev=>prev.map(m=>m.id===payload.new.id?{...m,...payload.new}:m))})
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'voice_messages'},(payload:any)=>{const v=payload.new as VoiceMessage;if(v.expires_at&&new Date(v.expires_at).getTime()>Date.now()&&!voiceLocalDeleted[v.id])setVoiceMessages(prev=>{if(prev.some(x=>x.id===v.id))return prev;if(v.user_id===selfId){const match=prev.find(x=>x.id.startsWith('optimistic-public-voice-')&&x.user_id===selfId&&Math.abs(x.duration_ms-v.duration_ms)<1000);if(match){voiceRenderKeysRef.current[v.id]=voiceRenderKeysRef.current[match.id]||match.id;return prev.map(x=>x.id===match.id?v:x).sort((a,b)=>a.created_at.localeCompare(b.created_at))}}return [...prev,v].sort((a,b)=>a.created_at.localeCompare(b.created_at))})})
        .on('postgres_changes',{event:'DELETE',schema:'public',table:'voice_messages'},(payload:any)=>{delete voiceRenderKeysRef.current[payload.old.id];setVoiceMessages(prev=>prev.filter(v=>v.id!==payload.old.id));if(playingVoiceId===payload.old.id){voiceAudioRef.current?.pause();setPlayingVoiceId(null)}})
        .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},()=>refreshReactions(messageIdsRef.current,selfId))
        .on('postgres_changes',{event:'*',schema:'public',table:'voice_reactions'},()=>refreshVoiceReactions(voiceMessages.map(v=>v.id),selfId))
        .subscribe(async (status:any,subscribeError:any)=>{
          if(status==='SUBSCRIBED'){
            setConnected(true);
            setConnectionState('connected');
            postgresChangesReady=true;
            await channel.track({online_at:new Date().toISOString(),typing:false});
            presenceUsers();
            void refreshNow();
          }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
            postgresChangesReady=false;
            if(subscribeError)console.warn('Global chat realtime connection issue:',subscribeError);
            setConnected(false);
            setConnectionState('reconnecting');
          }
        });
      refreshTimer=window.setInterval(()=>{if(!postgresChangesReady)void refreshNow()},5000);
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
      if(publicTypingHeartbeatRef.current)window.clearInterval(publicTypingHeartbeatRef.current);
      const currentUserId=sessionRef.current?.user?.id;
      if(publicTypingActiveRef.current&&currentUserId)void channel?.send({type:'broadcast',event:'typing',payload:{userId:currentUserId,typing:false}});
      publicTypingHeartbeatRef.current=undefined;
      publicTypingActiveRef.current=false;
      typingStopRef.current=undefined;
      clearRemoteActivity(publicTypingUsersRef.current,publicTypingTimersRef.current,setTypingUsers);
      clearRemoteActivity(publicRecordingUsersRef.current,publicRecordingTimersRef.current,setRecordingUsers);
      if(channel){channel.untrack();supabase.removeChannel(channel)}
      channelRef.current=null;
    };
  },[refresh,localDeleted]);
  useEffect(()=>{const timers: number[]=[]; const now=Date.now(); messages.forEach(m=>{const delay=new Date(m.expires_at).getTime()-now; if(delay>0&&delay<2147483647)timers.push(window.setTimeout(()=>{delete messageRenderKeysRef.current[m.id];setMessages(prev=>prev.filter(x=>x.id!==m.id))},delay+50));}); voiceMessages.forEach(v=>{const delay=new Date(v.expires_at).getTime()-now; if(delay>0&&delay<2147483647)timers.push(window.setTimeout(()=>{delete voiceRenderKeysRef.current[v.id];setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id))},delay+50));}); return()=>timers.forEach(t=>window.clearTimeout(t))},[messages,voiceMessages]);
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
        publicTypingHeartbeatRef.current=window.setInterval(()=>{
          void channelRef.current?.send({type:'broadcast',event:'typing',payload:{userId:authUserId,typing:true}});
        },1000);
      }
      typingStopRef.current=window.setTimeout(()=>{
        publicTypingActiveRef.current=false;
        if(publicTypingHeartbeatRef.current)window.clearInterval(publicTypingHeartbeatRef.current);
        publicTypingHeartbeatRef.current=undefined;
        typingStopRef.current=undefined;
        void channelRef.current?.send({type:'broadcast',event:'typing',payload:{userId:authUserId,typing:false}});
      },1500);
    }else{
      publicTypingActiveRef.current=false;
      if(publicTypingHeartbeatRef.current)window.clearInterval(publicTypingHeartbeatRef.current);
      publicTypingHeartbeatRef.current=undefined;
      if(typingStopRef.current)window.clearTimeout(typingStopRef.current);
      typingStopRef.current=undefined;
      void ch.send({type:'broadcast',event:'typing',payload:{userId:authUserId,typing:false}});
    }
  };
  const broadcastPublicRecording=(active:boolean)=>{
    if(publicRecordingHeartbeatRef.current)window.clearInterval(publicRecordingHeartbeatRef.current);
    publicRecordingHeartbeatRef.current=undefined;
    if(!authUserId)return;
    const send=()=>void channelRef.current?.send({type:'broadcast',event:'recording',payload:{userId:authUserId,recording:active}});
    send();
    if(active)publicRecordingHeartbeatRef.current=window.setInterval(send,1500);
  };
  const stopRecording=()=>{if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);recordingTimerRef.current=undefined;const r=mediaRecorderRef.current;if(!r)return;mediaRecorderRef.current=null;broadcastPublicRecording(false);r.stop();setRecording(false);};
  const requestMic=async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone recording is not supported in this browser.');const stream=await navigator.mediaDevices.getUserMedia({audio:true});setMicPermission('granted');setMicNotice(false);return stream}catch(e:any){setMicPermission('denied');setMicNotice(true);setError(e?.name==='NotAllowedError'?'Microphone permission was denied. Please allow microphone access in your browser site settings.':(e?.message||'Microphone access is unavailable.'));return null}};
  const startRecording=async()=>{if(recording||sending)return;if(!navigator.onLine){setError('You are offline. Please reconnect before recording.');return}const stream=await requestMic();if(!stream)return;try{const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x))||'';const recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:24000}:undefined);mediaRecorderRef.current=recorder;mediaChunksRef.current=[];recordingStartedRef.current=Date.now();setRecordingSeconds(0);setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setError('');setRecording(true);setRecordingStream(stream);broadcastPublicRecording(true);recorder.ondataavailable=e=>{if(e.data.size)mediaChunksRef.current.push(e.data)};recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setRecordingStream(null);const elapsed=Math.min(60000,Date.now()-recordingStartedRef.current);const blob=new Blob(mediaChunksRef.current,{type:recorder.mimeType||'audio/webm'});mediaChunksRef.current=[];if(elapsed<500){setError('Voice message is too short.');setRecordingSeconds(0);return}if(blob.size>350*1024){setError('Voice message is too large. Please record a shorter message.');setRecordingSeconds(0);return}setRecordingSeconds(Math.floor(elapsed/1000));setRecordedVoiceBlob(blob);setRecordedVoiceDuration(elapsed)};recorder.start(250);recordingTimerRef.current=window.setInterval(()=>{const elapsed=Math.floor((Date.now()-recordingStartedRef.current)/1000);if(elapsed>=60){stopRecording();return}setRecordingSeconds(elapsed)},200)}catch{stream.getTracks().forEach(t=>t.stop());setRecording(false);setError('Could not start microphone recording. Please try again.')}};
  const uploadVoice=async(blob:Blob,duration:number,replyToMessageId:string|null=null,replyToVoiceId:string|null=null)=>{setError('');setSending(true);setVoiceSendingPending(true);const tempId='optimistic-public-voice-'+crypto.randomUUID();const localUrl=URL.createObjectURL(blob);const optimistic:VoiceMessage={id:tempId,user_id:authUserId,name:profile.name,country:profile.country,subdivision:profile.subdivision,avatar_id:profile.avatarId,audio_url:localUrl,storage_path:'',duration_ms:duration,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+5*60*1000).toISOString(),reply_to_message_id:replyToMessageId,reply_to_voice_id:replyToVoiceId};setVoiceMessages(prev=>[...prev,optimistic].sort((a,b)=>a.created_at.localeCompare(b.created_at)));try{let session=sessionRef.current;if(!session?.access_token||(session.expires_at&&session.expires_at*1000<=Date.now()+30000)){const sessionResult=await supabase.auth.getSession();if(sessionResult.error)throw sessionResult.error;session=sessionResult.data.session}if(!session?.access_token||(session.expires_at&&session.expires_at*1000<=Date.now()+30000)){const refreshed=await supabase.auth.refreshSession();if(refreshed.error||!refreshed.data.session?.access_token)throw new Error('Session expired. Please refresh the chat and try again.');session=refreshed.data.session}sessionRef.current=session;const rawMime=(blob.type||'audio/webm').split(';')[0].trim().toLowerCase();const mime=rawMime==='audio/mp4'||rawMime==='audio/x-m4a'?'audio/mp4':'audio/webm';const ext=mime==='audio/mp4'?'m4a':'webm';const file=new File([blob],`voice.${ext}`,{type:mime});if(file.size<1)throw new Error('The voice recording is empty. Please record again.');if(file.size>358400)throw new Error('Voice message is too large. Please record a shorter message.');const form=new FormData();form.append('audio',file,file.name);form.append('durationMs',String(Math.max(500,Math.min(60000,Math.round(duration)) )));if(replyToMessageId)form.append('replyToMessageId',replyToMessageId);if(replyToVoiceId)form.append('replyToVoiceId',replyToVoiceId);let data:any=null;let invokeError:any=null;try{const result=await supabase.functions.invoke('send-voice',{body:form,headers:{Authorization:`Bearer ${session.access_token}`}});data=result.data;invokeError=result.error}catch(e){invokeError=e}if(invokeError||data?.error||!data?.message){const url=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-voice`;const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string},body:form});let fallback:any=null;try{fallback=await response.json()}catch{}if(!response.ok||fallback?.error||!fallback?.message)throw new Error(fallback?.error||invokeError?.message||`Voice upload failed (${response.status}). Please deploy the latest send-voice function.`);data=fallback}voiceRenderKeysRef.current[data.message.id]=voiceRenderKeysRef.current[tempId]||tempId;setVoiceMessages(prev=>[...prev.filter(v=>v.id!==tempId&&v.id!==data.message.id),data.message as VoiceMessage].sort((a,b)=>a.created_at.localeCompare(b.created_at)));URL.revokeObjectURL(localUrl);play('send');return true;}catch(e:any){setVoiceMessages(prev=>prev.filter(v=>v.id!==tempId));URL.revokeObjectURL(localUrl);setError(e?.message||'Unable to send voice message.');return false}finally{setSending(false);setVoiceSendingPending(false)}};
  const sendRecordedVoice=async()=>{if(!recordedVoiceBlob||sending)return;const blob=recordedVoiceBlob;const duration=recordedVoiceDuration;const ok=await uploadVoice(blob,duration,replyTarget?.reply_to_voice_id?null:(replyTarget?.id&&!String(replyTarget.id).startsWith('voice-reply-')?replyTarget.id:null),replyTarget?.reply_to_voice_id||null);if(ok){setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);setRecordingSeconds(0);setReplyTarget(null)}};
  const cancelRecording=()=>{broadcastPublicRecording(false);if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);recordingTimerRef.current=undefined;const r=mediaRecorderRef.current;mediaRecorderRef.current=null;if(r){r.onstop=null;if(r.state!=='inactive')r.stop();r.stream.getTracks().forEach(t=>t.stop())}mediaChunksRef.current=[];setRecording(false);setRecordingStream(null);setRecordingSeconds(0);setRecordedVoiceBlob(null);setRecordedVoiceDuration(0);};
  const toggleVoicePlayback=async(v:VoiceMessage)=>{if(playingVoiceId===v.id){voiceAudioRef.current?.pause();setPlayingVoiceId(null);return}if(voiceAudioRef.current){voiceAudioRef.current.pause();voiceAudioRef.current=null}setPlayingVoiceElapsed(0);let audioUrl=v.audio_url;if(v.storage_path){const {data}=await supabase.storage.from('voice-messages').createSignedUrl(v.storage_path,3600);if(data?.signedUrl)audioUrl=data.signedUrl}const a=new Audio(audioUrl);voiceAudioRef.current=a;setPlayingVoiceId(v.id);a.ontimeupdate=()=>setPlayingVoiceElapsed(a.currentTime);a.onended=()=>{setPlayingVoiceElapsed(0);setPlayingVoiceId(null)};a.onerror=()=>{setPlayingVoiceElapsed(0);setPlayingVoiceId(null);setError('Could not play this voice message.')};void a.play().catch(()=>{setPlayingVoiceId(null);setError('Could not play this voice message.')})};
  const deleteVoiceForMe=(v:VoiceMessage)=>{playAction('/sounds/send.wav');delete voiceRenderKeysRef.current[v.id];const next={...readVoiceLocalDeleted(),[v.id]:new Date(v.expires_at).getTime()};setVoiceLocalDeleted(next);persistVoiceLocalDeleted(next);setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id));if(playingVoiceId===v.id){voiceAudioRef.current?.pause();voiceAudioRef.current=null;setPlayingVoiceId(null)}};
  const deleteVoiceForEveryone=async(v:VoiceMessage)=>{
    playAction('/sounds/send.wav');
    if(v.user_id!==authUserId||pendingVoiceDeleteIdsRef.current.has(v.id))return;
    pendingVoiceDeleteIdsRef.current.add(v.id);
    setVoiceMessages(prev=>prev.filter(x=>x.id!==v.id));
    if(playingVoiceId===v.id){voiceAudioRef.current?.pause();voiceAudioRef.current=null;setPlayingVoiceId(null)}
    try{
      const session=sessionRef.current;
      const {data,error}=await supabase.functions.invoke('delete-voice-for-everyone',{body:{voiceId:v.id,userId:authUserId},headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});
      if(error||data?.error)throw new Error(data?.error||'Could not delete this voice message.');
      delete voiceRenderKeysRef.current[v.id];
    }catch(error){
      setVoiceMessages(prev=>prev.some(x=>x.id===v.id)?prev:[...prev,v].sort((a,b)=>a.created_at.localeCompare(b.created_at)));
      setError(error instanceof Error?error.message:'Could not delete this voice message. Please try again.');
    }finally{pendingVoiceDeleteIdsRef.current.delete(v.id)}
  };
  useEffect(()=>()=>{
    voiceAudioRef.current?.pause();
    if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current);
    const currentUserId=sessionRef.current?.user?.id;
    if(publicTypingActiveRef.current&&currentUserId)void channelRef.current?.send({type:'broadcast',event:'typing',payload:{userId:currentUserId,typing:false}});
    if(publicRecordingHeartbeatRef.current&&currentUserId)void channelRef.current?.send({type:'broadcast',event:'recording',payload:{userId:currentUserId,recording:false}});
    if(publicTypingHeartbeatRef.current)window.clearInterval(publicTypingHeartbeatRef.current);
    if(publicRecordingHeartbeatRef.current)window.clearInterval(publicRecordingHeartbeatRef.current);
    if(privateTypingActiveRef.current&&currentUserId)void privateChannelRef.current?.send({type:'broadcast',event:'private-typing',payload:{userId:currentUserId,typing:false}});
    if(privateRecordingHeartbeatRef.current&&currentUserId)void privateChannelRef.current?.send({type:'broadcast',event:'private-recording',payload:{userId:currentUserId,recording:false}});
    if(privateTypingStopRef.current)window.clearTimeout(privateTypingStopRef.current);
    if(privateTypingHeartbeatRef.current)window.clearInterval(privateTypingHeartbeatRef.current);
    if(privateRecordingHeartbeatRef.current)window.clearInterval(privateRecordingHeartbeatRef.current);
    clearRemoteActivity(privateTypingUsersRef.current,privateTypingTimersRef.current,()=>{});
    clearRemoteActivity(privateRecordingUsersRef.current,privateRecordingTimersRef.current,()=>{});
    if(privatePollRef.current)window.clearInterval(privatePollRef.current);
    if(privateChannelRef.current)void supabase.removeChannel(privateChannelRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach(t=>t.stop());
  },[]);
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
        privateTypingHeartbeatRef.current=window.setInterval(()=>{
          void privateChannelRef.current?.send({type:'broadcast',event:'private-typing',payload:{userId:authUserId,typing:true}});
        },1000);
      }
      privateTypingStopRef.current=window.setTimeout(()=>{
        privateTypingActiveRef.current=false;
        if(privateTypingHeartbeatRef.current)window.clearInterval(privateTypingHeartbeatRef.current);
        privateTypingHeartbeatRef.current=undefined;
        privateTypingStopRef.current=undefined;
        void privateChannelRef.current?.send({type:'broadcast',event:'private-typing',payload:{userId:authUserId,typing:false}});
      },1500);
    }else{
      privateTypingActiveRef.current=false;
      if(privateTypingHeartbeatRef.current)window.clearInterval(privateTypingHeartbeatRef.current);
      privateTypingHeartbeatRef.current=undefined;
      if(privateTypingStopRef.current)window.clearTimeout(privateTypingStopRef.current);
      privateTypingStopRef.current=undefined;
      void ch.send({type:'broadcast',event:'private-typing',payload:{userId:authUserId,typing:false}});
    }
  };
  const broadcastPrivateRecording=(active:boolean)=>{
    if(privateRecordingHeartbeatRef.current)window.clearInterval(privateRecordingHeartbeatRef.current);
    privateRecordingHeartbeatRef.current=undefined;
    if(!authUserId)return;
    const send=()=>void privateChannelRef.current?.send({type:'broadcast',event:'private-recording',payload:{userId:authUserId,recording:active}});
    send();
    if(active)privateRecordingHeartbeatRef.current=window.setInterval(send,1500);
  };
  const send=async()=>{if(sendLockRef.current)return;sendLockRef.current=true;setError('');const body=text.trim();const problem=validateMessage(text);if(problem){setError(problem);sendLockRef.current=false;return}const duplicate=messagesRef.current.some(m=>m.user_id===authUserId&&m.body===body&&Date.now()-new Date(m.created_at).getTime()<10000&&!m.id.startsWith('optimistic-'));if(duplicate){setError('Please do not send the same message again so quickly.');sendLockRef.current=false;return}const tempId=`optimistic-${crypto.randomUUID()}`;const createdAt=new Date().toISOString();const optimistic:ChatMessage={id:tempId,user_id:authUserId,name:profile.name,country:profile.country,subdivision:profile.subdivision,avatar_id:profile.avatarId,body,created_at:createdAt,expires_at:new Date(Date.now()+5*60*1000).toISOString(),reply_to_id:replyTarget?.reply_to_voice_id?null:replyTarget?.id||null,reply_to_voice_id:replyTarget?.reply_to_voice_id||null,reply_to_preview:replyTarget?.body||null,reply_to_name:replyTarget?.name||null};pendingRef.current[tempId]={tempId,body,createdAt};updateTyping('');setEmojiOpen(false);const sentReply=replyTarget;setReplyTarget(null);setMessages(prev=>prev.some(m=>m.id===tempId)?prev:[...prev,optimistic]);play('send');setSending(true);try{let session=sessionRef.current;if(!session){const {data}=await supabase.auth.getSession();session=data.session;sessionRef.current=session}const {data,error}=await supabase.functions.invoke('send-message',{body:{text:body,profile,replyToId:sentReply&&!sentReply.reply_to_voice_id&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,replyToVoiceId:sentReply?.reply_to_voice_id||null},headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});if(error||data?.error)throw new Error(data?.error||'Unable to send message.');const serverMessage={...(data?.message||data) as ChatMessage,reply_to_id:sentReply&&!sentReply.reply_to_voice_id&&!sentReply.id.startsWith('optimistic-')?sentReply.id:null,reply_to_voice_id:sentReply?.reply_to_voice_id||null,reply_to_preview:sentReply?.body||null,reply_to_name:sentReply?.name||null};if(serverMessage?.id)messageRenderKeysRef.current[serverMessage.id]=messageRenderKeysRef.current[tempId]||tempId;setMessages(prev=>{if(serverMessage?.id&&prev.some(m=>m.id===serverMessage.id))return prev;const exists=prev.some(m=>m.id===tempId);return exists&&serverMessage?.id?prev.map(m=>m.id===tempId?serverMessage:m):prev});delete pendingRef.current[tempId];if(sentReply&&!sentReply.id.startsWith('optimistic-')&&serverMessage?.id&&channelRef.current)void channelRef.current.send({type:'broadcast',event:'message-meta',payload:{messageId:serverMessage.id,replyToId:sentReply.id,replyToPreview:sentReply.body,replyToName:sentReply.name}})}catch(e:any){setMessages(prev=>prev.filter(m=>m.id!==tempId));delete pendingRef.current[tempId];setError(e.message||'Unable to send message. Please try again.')}finally{setSending(false);sendLockRef.current=false}};
  const persistLocalDeleted=(next:Record<string,number>)=>{setLocalDeleted(next);try{localStorage.setItem(LOCAL_DELETED_KEY,JSON.stringify(next))}catch{}};
  const deleteLocally=(m:ChatMessage)=>{if(!canLocalDelete(m))return;const key=localMessageKey(m);const next={...readLocalDeleted(),[key]:new Date(m.expires_at).getTime()};persistLocalDeleted(next);delete messageRenderKeysRef.current[m.id];setMessages(prev=>prev.filter(x=>localMessageKey(x)!==key))};
  const deleteForEveryone=async(m:ChatMessage)=>{if(!canLocalDelete(m)||m.user_id!==authUserId)return;setDeletingForEveryone(true);setError('');try{const {data,error}=await supabase.rpc('delete_message_for_everyone',{p_message_id:m.id});if(error)throw error;if(data!==true)throw new Error('This message could not be deleted for everyone.');deleteLocally(m);setDeleteConfirmMessage(null)}catch{setError('Could not delete this message for everyone. Please try again.')}finally{setDeletingForEveryone(false)}};
  const editPublicMessage=async(m:ChatMessage,body:string)=>{if(m.user_id!==authUserId||!canEditMessage(m)){setError('This message is outside the 5-minute edit window.');return false}const {data,error}=await supabase.rpc('edit_global_message',{p_message_id:m.id,p_body:body});if(error){setError(error.message||'Could not edit this message.');return false}if(!data){setError('Could not edit this message.');return false}setMessages(prev=>prev.map(item=>item.id===m.id?{...item,...data}:item));setError('');return true};
  const closePrivateRoom=()=>{
    if(privateTypingStopRef.current){window.clearTimeout(privateTypingStopRef.current);privateTypingStopRef.current=undefined}
    if(privateTypingHeartbeatRef.current)window.clearInterval(privateTypingHeartbeatRef.current);
    if(privateTypingActiveRef.current&&authUserId)void privateChannelRef.current?.send({type:'broadcast',event:'private-typing',payload:{userId:authUserId,typing:false}});
    privateTypingHeartbeatRef.current=undefined;
    privateTypingActiveRef.current=false;
    broadcastPrivateRecording(false);
    clearRemoteActivity(privateTypingUsersRef.current,privateTypingTimersRef.current,ids=>setPrivateTyping(ids.length>0));
    clearRemoteActivity(privateRecordingUsersRef.current,privateRecordingTimersRef.current,ids=>setPrivateRecording(ids.length>0));
    if(privateChannelRef.current){void supabase.removeChannel(privateChannelRef.current);privateChannelRef.current=null}
    if(privatePollRef.current){window.clearInterval(privatePollRef.current);privatePollRef.current=undefined}
    privateRoomStartedRef.current=null;
    try{localStorage.removeItem(PRIVATE_CHAT_LOCAL_KEY)}catch{}
    setPrivateRoom(null);
    setPrivateMessages([]);
  };
  const loadPrivateMessages=async(roomId:string)=>{
    const startedAt=Date.now();
    const {data,error}=await supabase.from('private_messages').select('*').eq('room_id',roomId).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100);
    if(!error&&data&&privateRoomStartedRef.current===roomId)setPrivateMessages(prev=>{
      const merged=new Map<string,any>((data as any[]).map(message=>[message.id,message]));
      prev.filter(message=>message.room_id===roomId&&(String(message.id).startsWith('optimistic-private-')||new Date(message.created_at).getTime()>=startedAt)).forEach(message=>merged.set(message.id,message));
      return [...merged.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at));
    });
  };
  const enterPrivateRoom=async(room:any)=>{
    if(privateRoomStartedRef.current===room.id)return;
    if(privateTypingStopRef.current){window.clearTimeout(privateTypingStopRef.current);privateTypingStopRef.current=undefined}
    if(privateTypingHeartbeatRef.current)window.clearInterval(privateTypingHeartbeatRef.current);
    if(privateTypingActiveRef.current&&authUserId)void privateChannelRef.current?.send({type:'broadcast',event:'private-typing',payload:{userId:authUserId,typing:false}});
    privateTypingHeartbeatRef.current=undefined;
    privateTypingActiveRef.current=false;
    broadcastPrivateRecording(false);
    clearRemoteActivity(privateTypingUsersRef.current,privateTypingTimersRef.current,ids=>setPrivateTyping(ids.length>0));
    clearRemoteActivity(privateRecordingUsersRef.current,privateRecordingTimersRef.current,ids=>setPrivateRecording(ids.length>0));
    privateRoomStartedRef.current=room.id;
    if(privateRoom?.id!==room.id)setPrivateMessages([]);
    setPrivateRoom(room);
    setPrivateOnline(0);
    setPrivateTyping(false);
    setPrivateRecording(false);
    try{localStorage.setItem(PRIVATE_CHAT_LOCAL_KEY,JSON.stringify(room))}catch{}
    if(privateChannelRef.current)void supabase.removeChannel(privateChannelRef.current);
    if(privatePollRef.current)window.clearInterval(privatePollRef.current);
    let privateChangesReady=false;
    const ch:any=supabase.channel('private-room-'+room.id,{config:{presence:{key:authUserId},broadcast:{self:false,ack:true}}})
      .on('system',{},(payload:any)=>{
        if(payload?.extension!=='postgres_changes')return;
        privateChangesReady=payload.status==='ok';
        if(!privateChangesReady)void loadPrivateMessages(room.id);
      })
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
      })
      .on('broadcast' as any,{event:'private-typing',config:{self:false}},({payload}:any)=>{
        const id=payload?.userId;
        if(id&&id!==authUserId)updateRemoteActivity(privateTypingUsersRef.current,privateTypingTimersRef.current,id,Boolean(payload?.typing),3200,ids=>setPrivateTyping(ids.length>0));
      })
      .on('broadcast' as any,{event:'private-recording',config:{self:false}},({payload}:any)=>{
        const id=payload?.userId;
        if(id&&id!==authUserId)updateRemoteActivity(privateRecordingUsersRef.current,privateRecordingTimersRef.current,id,Boolean(payload?.recording),6500,ids=>setPrivateRecording(ids.length>0));
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'private_messages',filter:'room_id=eq.'+room.id},
        payload=>setPrivateMessages(prev=>{const incoming:any=payload.new;if(prev.some(m=>m.id===incoming.id))return prev;const optimistic=prev.find(m=>String(m.id).startsWith('optimistic-private-')&&m.user_id===incoming.user_id&&m.body===incoming.body&&Math.abs(new Date(m.created_at).getTime()-new Date(incoming.created_at).getTime())<15000);if(optimistic)return prev.map(m=>m.id===optimistic.id?incoming:m).sort((a,b)=>a.created_at.localeCompare(b.created_at));return [...prev,incoming].sort((a,b)=>a.created_at.localeCompare(b.created_at))}))
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'private_messages',filter:'room_id=eq.'+room.id},
        payload=>setPrivateMessages(prev=>prev.filter(m=>m.id!==payload.old.id)))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'private_messages',filter:'room_id=eq.'+room.id},
        payload=>setPrivateMessages(prev=>prev.map(m=>m.id===payload.new.id?{...m,...payload.new}:m)));
    privateChannelRef.current=ch;
    ch.subscribe(async (status:any)=>{
      if(status==='SUBSCRIBED'){
        privateChangesReady=true;
        try{
          await ch.track({
            userId:authUserId,
            name:profile.name,
            online_at:new Date().toISOString()
          });
          const state=ch.presenceState() as Record<string,any[]>;
          setPrivateOnline(Object.keys(state).length);
          void loadPrivateMessages(room.id);
        }catch{
          setPrivateOnline(0);
        }
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        privateChangesReady=false;
        setPrivateOnline(0);
      }
    });
    void loadPrivateMessages(room.id);
    privatePollRef.current=window.setInterval(()=>{if(!privateChangesReady)void loadPrivateMessages(room.id);void (async()=>{const {data,error}=await supabase.from('private_room_members').select('user_id').eq('room_id',room.id).eq('user_id',authUserId).maybeSingle();if(!error&&!data){closePrivateRoom()}})()},5000);
  };
  useEffect(()=>{
    if(authUserId&&privateRoom?.id)void enterPrivateRoom(privateRoom);
    return()=>{
      if(privateChannelRef.current){void supabase.removeChannel(privateChannelRef.current);privateChannelRef.current=null}
      if(privatePollRef.current){window.clearInterval(privatePollRef.current);privatePollRef.current=undefined}
    }
  },[authUserId,privateRoom?.id]);
  const createPrivateRoom=async()=>{setPrivateError('');if(privateRoomName.trim().length<2){setPrivateError('Room name needs 2+ characters.');return}setPrivateSending(true);try{const {data,error}=await supabase.rpc('create_private_room',{p_name:privateRoomName.trim().slice(0,40)});if(error)throw error;const room={id:data.room_id,name:data.room_name,join_code:data.join_code,owner:true,owner_id:authUserId};setPrivateModal(null);setPrivateRoomName('');setPrivateRoom(room)}catch(e){const x=e as any;setPrivateError(x?.message||x?.details||x?.hint||x?.code||'Could not create private chat.')}finally{setPrivateSending(false)}};
  const joinPrivateRoom=async()=>{setPrivateError('');const code=privateJoinCode.trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(code)){setPrivateError('Enter a valid 8-character private code.');return}setPrivateSending(true);try{const {data,error}=await supabase.rpc('join_private_room',{p_join_code:code});if(error)throw error;const room={id:data.room_id,name:data.room_name,join_code:code,owner:Boolean(data.owner),owner_id:data.owner_id||null};setPrivateModal(null);setPrivateJoinCode('');setPrivateRoom(room)}catch(e){setPrivateError(e instanceof Error?e.message:'Invalid private code.')}finally{setPrivateSending(false)}};
  const playPrivateAction=(src:string)=>{if(!settings.sound)return;const a=new Audio(src);a.volume=0.42;void a.play().catch(()=>{});};
  const addFriend=async(userId:string)=>{if(!userId||userId===authUserId)return;const {error}=await supabase.rpc('send_friend_request',{p_recipient_id:userId});if(error){setError(error.message);window.setTimeout(()=>setError(v=>v===error.message?'':v),5000)}else setError('Friend request sent.');};
   const sendPrivateMessage=async()=>{const body=text.trim();if(privateSendLockRef.current||!privateRoom||!body||privateSending)return;privateSendLockRef.current=true;setPrivateSending(true);setPrivateError('');const replyTo=replyTargetForPrivateRef.current;const tempId='optimistic-private-'+crypto.randomUUID();const optimistic={id:tempId,room_id:privateRoom.id,user_id:authUserId,name:profile.name,country:profile.country,subdivision:profile.subdivision,avatar_id:profile.avatarId,body,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+24*60*60*1000).toISOString(),reply_to_id:replyTo?.reply_to_voice_id?null:replyTo?.id||null,reply_to_voice_id:replyTo?.reply_to_voice_id||null,reply_to_preview:replyTo?.body||'Voice message',reply_to_name:replyTo?.name||null};handlePrivateTyping('');setText('');setReplyTargetForPrivate(null);setPrivateMessages(prev=>[...prev,optimistic].sort((a,b)=>a.created_at.localeCompare(b.created_at)));playPrivateAction('/sounds/send.wav');try{const {data,error}=await supabase.rpc('send_private_message',{p_room_id:privateRoom.id,p_name:profile.name,p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatarId,p_body:body.slice(0,500),p_reply_to_id:replyTo?.reply_to_voice_id?null:replyTo?.id||null,p_reply_to_voice_id:replyTo?.reply_to_voice_id||null});if(error)throw error;if(data)setPrivateMessages(prev=>prev.map(m=>m.id===tempId?data:m).sort((a,b)=>a.created_at.localeCompare(b.created_at)))}catch(e){setPrivateMessages(prev=>prev.filter(m=>m.id!==tempId));const x=e as any;setPrivateError(x?.message||x?.details||x?.hint||x?.code||JSON.stringify(x)||'Could not send private message.')}finally{setPrivateSending(false);privateSendLockRef.current=false}};
  const clearChatLocally=()=>{const current=readLocalDeleted();const now=Date.now();messages.forEach(m=>{if(new Date(m.expires_at).getTime()>now)current[localMessageKey(m)]=new Date(m.expires_at).getTime()});persistLocalDeleted(current);setMessages([]);const voiceCurrent=readVoiceLocalDeleted();voiceMessages.forEach(v=>{if(new Date(v.expires_at).getTime()>now)voiceCurrent[v.id]=new Date(v.expires_at).getTime()});persistVoiceLocalDeleted(voiceCurrent);setVoiceLocalDeleted(voiceCurrent);setVoiceMessages([])};
  const onKey=(e:React.KeyboardEvent)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
  return <div className="chat-app">
    <header className="topbar">
      <div className="top-brand">
        <img className="brand-mini brand-image" src="/global-chat-logo.svg" alt="GLOBAL CHAT" />
        <div><b>GLOBAL CHAT</b><span><i className={connected?'online-dot':'offline-dot'}></i>{online} Online</span></div>
      </div>
      <div className="top-actions">
        <button className="private-top-btn" onClick={()=>{setPrivateError('');setPrivateJoinCode('');setPrivateModal('join')}} aria-label="Join Private Chat" title="Join Private Chat"><KeyRound size={17}/><span className="private-top-label">JOIN PRIVATE CHAT</span></button>
        <button className="private-top-btn" onClick={()=>{setPrivateError('');setPrivateRoomName('');setPrivateModal('create')}} aria-label="Create Private Chat" title="Create Private Chat"><Plus size={17}/><span className="private-top-label">CREATE PRIVATE CHAT</span></button>
        <button className="private-top-btn your-private-chats-top-btn" onClick={()=>{setYourPrivateChatsOpen(true);void loadYourPrivateChats()}} aria-label="Your Private Chats" title="Your Private Chats"><span className="your-private-chats-icon"><svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 5.5C5 3.57 6.57 2 8.5 2h15C25.43 2 27 3.57 27 5.5v15c0 1.93-1.57 3.5-3.5 3.5H13l-6.5 5v-5.25A3.5 3.5 0 0 1 5 20.5v-15Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><rect x="12" y="12.5" width="8" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.8"/><path d="M13.8 12.5V10a2.2 2.2 0 0 1 4.4 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span><span className="private-top-label">YOUR PRIVATE CHATS</span></button>
        <button className="private-top-btn friends-top-btn" onClick={()=>{setFriendsOpen(true);setHeaderMenuOpen(false)}} aria-label="Friends" title="Friends"><UserRound size={17}/><span className="private-top-label">FRIENDS</span>{friendsUnreadCount>0&&<i className="friends-unread-badge">{friendsUnreadCount>99?'99+':friendsUnreadCount}</i>}</button>
        <div className="header-more-menu">
          <button className="header-more-trigger" onClick={()=>setHeaderMenuOpen(v=>!v)} aria-label="More options" title="More options"><MoreVertical size={19}/></button>
          {headerMenuOpen&&<div className="header-more-dropdown">
            <button onClick={()=>{setSearchOpen(true);setHeaderMenuOpen(false)}}><Search size={17}/><span>Search</span></button>
            <button onClick={()=>{setClearConfirmOpen(true);setHeaderMenuOpen(false)}}><Trash2 size={17}/><span>Clear Chat</span></button>
            <button onClick={()=>{setSettingsOpen(true);setHeaderMenuOpen(false)}}><Settings size={17}/><span>Settings</span></button>
            <button onClick={()=>{setHeaderMenuOpen(false);setFeedbackOpen(true)}}><Bell size={17}/><span>Feedback / Bug Report</span></button>
          </div>}
        </div>
      </div>
    </header>
    <div className={`connection-banner ${connectionState}`}><span>{connectionState==='connected'?<Wifi size={13}/>:connectionState==='offline'?<WifiOff size={13}/>:<Wifi size={13}/>}</span>{connectionState==='connected'?'Connected':connectionState==='offline'?'Offline':'Reconnecting...'}</div>
    <main className="chat-main">{privateRoom&&authUserId?<PrivateRoomView profile={profile} room={privateRoom} messages={privateMessages} setMessages={setPrivateMessages} text={text} setText={setText} sending={privateSending} sendError={privateError} privateOnline={privateOnline} privateTyping={privateTyping} onTyping={handlePrivateTyping} sound={settings.sound} replyTarget={replyTargetForPrivate} setReplyTarget={setReplyTargetForPrivate} currentUserId={authUserId} onSend={()=>void sendPrivateMessage()} onClose={closePrivateRoom} onCopy={async(m:any)=>{try{await navigator.clipboard.writeText(m.body)}catch{}}} onMembers={()=>void openPrivateMembers()} onAddFriend={addFriend} privateRecording={privateRecording} onRecording={broadcastPrivateRecording}/>:privateRoom?<div className="private-message-list private-empty-loading">Loading private chat...</div>:!authUserId?<div className="private-message-list private-empty-loading">Connecting...</div>:<>{searchOpen&&<div className="chat-search"><Search size={16}/><input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search active messages..." aria-label="Search active messages"/><span>{displayedMessages.length}/{messages.length}</span><button className="chat-search-close" onClick={()=>{setSearchQuery('');setSearchOpen(false)}} aria-label="Close search" title="Close search"><X size={15}/></button></div>}<div className="message-list" ref={listRef} onScroll={handleScroll}>{messages.length===0&&voiceMessages.length===0?<div className="empty"><EarthGlobe/><h2>Talk to the world</h2><p>Say hello. Share ideas. Keep it friendly.</p></div>:<>{[...displayedMessages.map(data=>({kind:'text' as const,data})),...voiceMessages.filter(v=>!activeSearch||`${v.name} voice message`.toLowerCase().includes(activeSearch)).map(data=>({kind:'voice' as const,data}))].sort((a,b)=>a.data.created_at.localeCompare(b.data.created_at)).map(item=>item.kind==='text'?<Message key={messageRenderKeysRef.current[item.data.id]||item.data.id} m={item.data} current={item.data.user_id===authUserId} timeFormat={settings.timeFormat || '12h'} counts={reactionCounts[item.data.id]||EMPTY_REACTION_COUNTS} mine={myReactions[item.data.id]||EMPTY_REACTIONS} highlighted={highlightedMessageId===item.data.id} copied={copiedId===item.data.id} onCopy={()=>copyMessage(item.data)} onToggle={async(r)=>{const {error}=await supabase.functions.invoke('toggle-reaction',{body:{messageId:item.data.id,reaction:r}});if(!error)refreshReactions(messageIdsRef.current,sessionRef.current?.user?.id||authUserId)}} onDeleteForMe={()=>deleteLocally(item.data)} onDeleteForEveryone={()=>void deleteForEveryone(item.data)} onEdit={body=>editPublicMessage(item.data,body)} onAddFriend={()=>void addFriend(item.data.user_id)} onReply={()=>beginReply(item.data)} onReplyJump={(id,isVoice)=>{const el=document.getElementById(isVoice?`voice-${id}`:`msg-${id}`);el?.scrollIntoView({behavior:'smooth',block:'center'});if(!isVoice)setHighlightedMessageId(id)}}/>:<VoiceBubble key={`voice-${voiceRenderKeysRef.current[item.data.id]||item.data.id}`} v={item.data} current={item.data.user_id===authUserId} onDeleteForMe={()=>deleteVoiceForMe(item.data)} onDeleteForEveryone={()=>void deleteVoiceForEveryone(item.data)} onAddFriend={()=>void addFriend(item.data.user_id)} onReply={()=>beginVoiceReply(item.data)} onReplyJump={(id,isVoice)=>{const el=document.getElementById(isVoice?`voice-${id}`:`msg-${id}`);el?.scrollIntoView({behavior:'smooth',block:'center'});if(!isVoice)setHighlightedMessageId(id)}} timeFormat={settings.timeFormat||'12h'} counts={voiceReactionCounts[item.data.id]||{}} mine={voiceMyReactions[item.data.id]||[]} onToggleReaction={async(r)=>{const {error}=await supabase.functions.invoke('toggle-voice-reaction',{body:{voiceId:item.data.id,reaction:r}});if(!error)refreshVoiceReactions(voiceMessages.map(v=>v.id),authUserId)}}/> )}</>}</div>{showJump&&<button className="jump-latest" onClick={jumpToLatest}><ArrowDown size={15}/>{newMessageCount>0?`${newMessageCount} NEW MESSAGE${newMessageCount===1?'':'S'}`:'LATEST MESSAGES'}</button>}{recordingUsers.length>0&&<div className="typing-indicator recording-indicator">Someone is recording<span className="typing-dots"><i></i><i></i><i></i></span></div>}{typingUsers.length>0&&<div className="typing-indicator">Someone is typing<span className="typing-dots"><i></i><i></i><i></i></span></div>}
        {replyTarget&&<div className="reply-composer"><div><b><ReplyIcon size={14}/> Replying to {replyTarget.name||'User'}</b><span>{replyTarget.reply_to_voice_id?`Voice message • ${formatDuration(replyTarget.duration_ms||0)}`:(replyTarget.body||'Reply')}</span></div><button className="private-modal-cancel" onClick={()=>setReplyTarget(null)} aria-label="CANCEL reply"><X size={16}/></button></div>}
        <div className="composer-wrap">
          {recording||recordedVoiceBlob
            ? <div className={`voice-recorder public-voice-composer-v2 ${recording?'is-recording':'is-ready'}`}>
                <div className="public-recording-status" aria-live="polite">
                  <span className="recording-dot"></span>
                  <div className="public-recording-copy"><span>{recording?'Recording':'Voice ready'}</span><strong>{formatDuration(recording?recordingSeconds*1000:recordedVoiceDuration)}</strong></div>
                </div>
                {recording&&<LiveRecordingWaveform stream={recordingStream}/>}
                <div className="public-recording-actions">
                  <button className="public-record-cancel" onClick={cancelRecording} disabled={sending} aria-label="Cancel voice recording" title="Cancel recording"><X size={18}/></button>
                  <button className="public-record-main" onClick={recording?stopRecording:()=>void sendRecordedVoice()} disabled={sending} aria-label={recording?'Stop recording':sending?'Sending voice message':'Send voice message'} title={recording?'Stop recording':'Send voice message'}>
                    {recording?<><Square size={15} fill="currentColor"/><span>Stop</span></>:<><Send size={17}/><span>{sending?'Sending…':'Send voice'}</span></>}
                  </button>
                </div>
              </div>
            : <div className="composer">
                <div className="tools"><button
                  className="icon-btn" onClick={()=>setEmojiOpen(v=>!v)} aria-label="Emoji"
                  title="Emoji" aria-expanded={emojiOpen}><Smile size={19}/></button>{emojiOpen&&<EmojiPicker
                  className="public-emoji-picker" onSelect={emoji=>{updateTyping(text+emoji);setEmojiOpen(false)}}/>}</div>
                <textarea value={text} maxLength={500} onChange={e=>updateTyping(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}}
                  placeholder="Type a message..." rows={1}/>
                <button className="voice-btn"
                  disabled={sending} onClick={()=>void startRecording()} aria-label="Record voice message"
                  title="Voice message"><Mic size={18}/></button>
                <button className={`send-btn ${sending?'is-sending':''}`}
                  disabled={!text.trim()||sending} onClick={()=>void send()} aria-label="Send message"
                  title="Send message"><Send size={18}/></button>
              </div>}
        </div>
  </>}</main>{privateModal&&<PrivateChatModal mode={privateModal} roomName={privateRoomName} setRoomName={setPrivateRoomName} joinCode={privateJoinCode} setJoinCode={setPrivateJoinCode} error={privateError} busy={privateSending} onClose={()=>setPrivateModal(null)} onCreate={()=>void createPrivateRoom()} onJoin={()=>void joinPrivateRoom()}/>} {privateMembersOpen&&privateRoom&&<PrivateMembersModal room={privateRoom} members={privateMembers} blockedMembers={privateBlockedMembers} loading={privateMembersLoading} error={privateMembersError} currentUserId={authUserId} isOwner={privateRoom.owner_id===authUserId} onClose={()=>setPrivateMembersOpen(false)} onRefresh={()=>void loadPrivateMembers(privateRoom.id)} onRemove={removePrivateMember} onBlock={blockPrivateMember} onUnblock={(m)=>void unblockPrivateMember(m)} onAddFriend={addFriend}/>} {yourPrivateChatsOpen&&<YourPrivateChatsModal rooms={yourPrivateChats} loading={yourPrivateChatsLoading} error={yourPrivateChatsError} pinnedRoomIds={pinnedPrivateChatIds} currentRoomId={privateRoom?.id||null} currentUserId={authUserId} onRefresh={()=>void loadYourPrivateChats()} onTogglePin={togglePrivateChatPin} onClose={()=>setYourPrivateChatsOpen(false)} onEnter={(room)=>{setYourPrivateChatsOpen(false);void enterPrivateRoom(room)}} onDelete={removeFromYourPrivateChats} onRename={(room)=>{setPrivateRenameRoom(room);setPrivateRenameName(room.name)}}/>} {deleteConfirmMessage&&<div className="delete-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"><div className="delete-modal"><div className="delete-modal-icon"><Trash2 size={20}/></div><h3 id="delete-modal-title">Delete Message?</h3><p>Choose where you want to delete this message.</p><div className="delete-modal-actions"><button className="delete-option-btn" onClick={()=>{deleteLocally(deleteConfirmMessage);setDeleteConfirmMessage(null)}} disabled={deletingForEveryone}><span>Delete for me</span><small>Remove only from your chat</small></button>{deleteConfirmMessage.user_id===authUserId&&<button className="delete-option-btn danger" onClick={()=>void deleteForEveryone(deleteConfirmMessage)} disabled={deletingForEveryone}><span>{deletingForEveryone?'Deleting...':'Delete for everyone'}</span><small>Remove from everyone's chat</small></button>}<button className="private-modal-cancel clear-cancel-btn" onClick={()=>setDeleteConfirmMessage(null)} disabled={deletingForEveryone}>CANCEL</button></div></div></div>} {clearConfirmOpen&&<div className="clear-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="clear-modal-title"><div className="clear-modal"><div className="clear-modal-icon"><Trash2 size={20}/></div><h3 id="clear-modal-title">Clear Chat?</h3><p>Clear all currently visible messages on this device?</p><span>Messages on other devices will not be deleted.</span><div className="clear-modal-actions"><button className="private-modal-cancel clear-cancel-btn" onClick={()=>setClearConfirmOpen(false)}>CANCEL</button><button className="clear-confirm-btn" onClick={()=>{clearChatLocally();setClearConfirmOpen(false)}}>CLEAR CHAT</button></div></div></div>}{privateRenameRoom&&<div className="private-modal-backdrop" role="dialog" aria-modal="true"><div className="private-modal"><div className="panel-head"><div><b><Pencil size={17}/> RENAME PRIVATE CHAT</b><span>Only the room creator can rename it</span></div><button onClick={()=>setPrivateRenameRoom(null)}><X/></button></div><label>Room Name</label><input maxLength={40} value={privateRenameName} onChange={e=>setPrivateRenameName(e.target.value)} autoFocus/><div className="private-modal-actions"><button className="private-modal-cancel" onClick={()=>setPrivateRenameRoom(null)}>CANCEL</button><button className="primary-btn" disabled={privateSending} onClick={()=>void renamePrivateRoom()}>{privateSending?'SAVING...':'SAVE NAME'}</button></div></div></div>} {settingsOpen&&<SettingsPanel profile={profile} settings={settings} accountPassword={accountPassword} onAccountPasswordChange={onAccountPasswordChange} onClose={()=>setSettingsOpen(false)} onLogout={onLogout} onDeleteChats={async()=>{const {data,error}=await supabase.functions.invoke('delete-account-chats',{body:{}});if(error||!data?.ok)throw new Error(data?.error||'Could not delete your messages. Please try again.');window.location.reload()}} onSave={async(p,s)=>{const {data,error}=await invokeWithFreshSession('save-profile',p);if(error)throw new Error(await edgeFunctionErrorMessage(error,'Could not save your profile. Please try again.'));if(!data?.ok)throw new Error(data?.error||'The server did not confirm the profile update. Please try again.');onProfile(p);onSettings(s);localStorage.setItem(PROFILE_KEY,JSON.stringify(p));localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));setSettingsOpen(false)}}/>} {feedbackOpen&&<FeedbackPanel profile={profile} onClose={()=>setFeedbackOpen(false)} />}{friendsOpen&&authUserId&&<Suspense fallback={<div className="friends-panel-loading" role="status">Loading friends…</div>}><FriendsPanel userId={authUserId} profile={profile} sound={settings.sound} onUnreadChange={setFriendsUnreadCount} onClose={()=>setFriendsOpen(false)}/></Suspense>}</div>
}

function formatMessageTime(value:string,format:TimeFormat){return new Intl.DateTimeFormat(undefined,{hour:format==='24h'?'2-digit':'numeric',minute:'2-digit',hour12:format==='12h'}).format(new Date(value))}
function formatDuration(ms:number){const total=Math.max(0,Math.round((ms||0)/1000));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`}

const Message=memo(function Message({m,current,counts,mine,onToggle,onDeleteForMe,onDeleteForEveryone,onEdit,onAddFriend,onReply,onCopy,onReplyJump,highlighted,copied,timeFormat}:{m:ChatMessage;current:boolean;counts:Record<string,number>;mine:string[];onToggle:(r:string)=>Promise<void>;onDeleteForMe:()=>void;onDeleteForEveryone:()=>void;onEdit:(body:string)=>Promise<boolean>;onAddFriend:()=>void;onReply:()=>void;onCopy:()=>void;onReplyJump:(id:string,isVoice:boolean)=>void;highlighted:boolean;copied:boolean;timeFormat:TimeFormat}){
  const [expanded,setExpanded]=useState(false);
  const [menu,setMenu]=useState(false);
  const [editing,setEditing]=useState(false);
  const isLong=m.body.length>250;
  const visibleBody=!isLong||expanded?m.body:m.body.slice(0,250)+'...';
  const countryName=iso31661.find(c=>c.alpha2===m.country)?.name??m.country;
  const subdivisionName=iso31662.find(s=>s.code===m.subdivision)?.name??m.subdivision.split('-').pop()??m.subdivision;
  const canDeleteForEveryone=current&&!m.id.startsWith('optimistic-')&&canLocalDelete(m);
  const canDeleteForMe=canLocalDelete(m);
  const canEdit=current&&canEditMessage(m);
  return <article id={`msg-${m.id}`} className={`private-message public-message ${current?'mine':''} ${highlighted?'highlighted':''} ${menu?'menu-open':''}`}>
    <div className="message-identity"><img className="message-avatar" src={avatarSrc(m.avatar_id)} alt=""/><div><strong>{m.name}</strong><span>{flag(m.country)} {subdivisionName}, {countryName}</span></div></div>
    {(m.reply_to_id||m.reply_to_voice_id)&&<button className="reply-preview" onClick={()=>onReplyJump((m.reply_to_voice_id||m.reply_to_id)!,Boolean(m.reply_to_voice_id))}><ReplyIcon size={13}/><span><b>{m.reply_to_name||'User'}</b>{m.reply_to_preview||'Reply'}</span></button>}
    {editing?<InlineMessageEditor value={m.body} onSave={onEdit} onCancel={()=>setEditing(false)}/>:<div className="private-bubble"><span>{visibleBody}</span>{isLong&&<button type="button" className="read-more-btn" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'Read more'}</button>}<time>{m.edited_at?'Edited · ':''}{formatMessageTime(m.created_at,timeFormat)}</time></div>}
    <div className="private-item-actions">
      {REACTIONS.map(r=><button key={r} className={mine.includes(r)?'reacted':''} onClick={()=>void onToggle(r)}>{r}{counts[r]?<small>{counts[r]}</small>:null}</button>)}
      <button onClick={onReply} aria-label="Reply" title="Reply"><ReplyIcon size={13}/></button>
      <button onClick={onCopy} aria-label="Copy" title={copied?'Copied':'Copy'}>{copied?<Check size={13}/>:<Copy size={13}/>}</button>
      {(canDeleteForMe||canDeleteForEveryone||!current)&&<button onClick={()=>setMenu(v=>!v)} aria-label="Message options" title="Message options"><MoreVertical size={15}/></button>}
      {menu&&<div className="private-item-menu">
        {!current&&<button onClick={()=>{onAddFriend();setMenu(false)}}><UserRound size={14}/> Add Friend</button>}
        {canEdit&&<button onClick={()=>{setEditing(true);setMenu(false)}}><Pencil size={14}/> Edit message</button>}
        {canDeleteForMe&&<button onClick={()=>{onDeleteForMe();setMenu(false)}}><Trash2 size={14}/> Delete for me</button>}
        {canDeleteForEveryone&&<button className="danger" onClick={()=>{onDeleteForEveryone();setMenu(false)}}><Trash2 size={14}/> Delete for everyone</button>}
        <button onClick={()=>setMenu(false)}><X size={14}/> Cancel</button>
      </div>}
    </div>
  </article>
},(previous,next)=>previous.m===next.m&&previous.current===next.current&&previous.counts===next.counts&&previous.mine===next.mine&&previous.highlighted===next.highlighted&&previous.copied===next.copied&&previous.timeFormat===next.timeFormat);
function LiveRecordingWaveform({stream,staticPreview=false}:{stream:MediaStream|null;staticPreview?:boolean}){
  const [levels,setLevels]=useState<number[]>(()=>Array.from({length:64},(_,i)=>0.18+((i*7)%9)/30));
  useEffect(()=>{
    if(!stream){setLevels([]);return;}
    const AudioCtx=(window.AudioContext||(window as any).webkitAudioContext) as typeof AudioContext|undefined;
    if(!AudioCtx)return;
    let ctx:AudioContext|undefined;
    let source:MediaStreamAudioSourceNode|undefined;
    let analyser:AnalyserNode|undefined;
    let raf=0;
    let lastPaint=0;
    try{
      ctx=new AudioCtx();
      source=ctx.createMediaStreamSource(stream);
      analyser=ctx.createAnalyser();
      analyser.fftSize=256;
      analyser.smoothingTimeConstant=.72;
      source.connect(analyser);
      const data=new Uint8Array(analyser.fftSize);
      const draw=(now:number)=>{
        if(!analyser)return;
        if(now-lastPaint<40){raf=requestAnimationFrame(draw);return;}
        lastPaint=now;
        analyser.getByteTimeDomainData(data);
        const next=Array.from({length:64},(_,i)=>{
          const start=Math.floor(i*data.length/64),end=Math.max(start+1,Math.floor((i+1)*data.length/64));
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
  if(!stream){if(!staticPreview)return null;return <div className="recording-wave live-recording-wave preview-wave" aria-label="Voice message waveform">{Array.from({length:44},(_,i)=><i key={i} style={{height:`${7+Math.round((Math.sin(i*.63)+1)*10+(i%5)*1.5)}px`}}/>)}</div>}
  return <div className="recording-wave live-recording-wave" aria-label="Live recording waveform">{levels.map((level,i)=><i key={i} className="active" style={{height:`${Math.round(6+level*25)}px`}}/>)}</div>;
}

const VoicePlayer=memo(function VoicePlayer({v,bucket='voice-messages'}:{v:any;bucket?:string}){
  const [playing,setPlaying]=useState(false);
  const [buffering,setBuffering]=useState(false);
  const [current,setCurrent]=useState(0);
  const [duration,setDuration]=useState(Math.max(0,(v.duration_ms||0)/1000));
  const [rate,setRate]=useState(1);
  const [playError,setPlayError]=useState('');
  const playerRef=useRef<HTMLDivElement|null>(null);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const objectUrlRef=useRef<string|null>(null);
  const privateFallbackTriedRef=useRef(false);
  const privateSourceRef=useRef<'signed'|'blob'|null>(null);
  const loadingRef=useRef<Promise<HTMLAudioElement>|null>(null);
  const startingRef=useRef(false);
  useEffect(()=>()=>{const audio=audioRef.current;if(audio){audio.pause();audio.onloadedmetadata=null;audio.ontimeupdate=null;audio.onwaiting=null;audio.onplaying=null;audio.onended=null;audio.onerror=null}audioRef.current=null;if(objectUrlRef.current){URL.revokeObjectURL(objectUrlRef.current);objectUrlRef.current=null}},[]);
  const load=async()=>{
    if(audioRef.current)return audioRef.current;
    if(loadingRef.current)return loadingRef.current;
    const request=(async()=>{
    let url=typeof v.audio_url==='string'?v.audio_url:'';
    if(bucket==='private-voice-messages'){
      if(!v.storage_path)throw new Error('Private voice file path is missing.');
      const remaining=v.expires_at?Math.ceil((new Date(v.expires_at).getTime()-Date.now())/1000):3600;
      if(remaining<=0)throw new Error('This voice message has expired.');
      const lifetime=Math.max(1,Math.min(3600,remaining));
      const signed=await supabase.storage.from(bucket).createSignedUrl(v.storage_path,lifetime);
      if(!signed.error&&signed.data?.signedUrl){
        url=signed.data.signedUrl;
        privateSourceRef.current='signed';
      }else{
        const downloaded=await supabase.storage.from(bucket).download(v.storage_path);
        if(downloaded.error){
          const status=(downloaded.error as any).statusCode;
          const signedIssue=signed.error?.message?`Signed URL: ${signed.error.message}. `:'';
          throw new Error(`${signedIssue}Private voice download failed${status?` (${status})`:''}: ${downloaded.error.message||'Check room membership and Storage access.'} A 404 can mean the object is missing or hidden by Storage access rules.`);
        }
        if(!downloaded.data)throw new Error('Private voice audio is unavailable. Please retry.');
        const storedMime=(downloaded.data.type||'').split(';')[0].trim().toLowerCase();
        const fileMime=/\.(m4a|mp4)$/i.test(v.storage_path)||storedMime==='audio/mp4'||storedMime==='audio/x-m4a'?'audio/mp4':'audio/webm';
        const playableBlob=storedMime===fileMime?downloaded.data:new Blob([downloaded.data],{type:fileMime});
        url=URL.createObjectURL(playableBlob);
        objectUrlRef.current=url;
        privateSourceRef.current='blob';
      }
    }
    else if(bucket!=='voice-messages'){
      if(!v.storage_path)throw new Error('Voice file path is missing.');
      const remaining=v.expires_at?Math.ceil((new Date(v.expires_at).getTime()-Date.now())/1000):3600;
      if(remaining<=0)throw new Error('This voice message has expired.');
      const {data,error}=await supabase.storage.from(bucket).createSignedUrl(v.storage_path,Math.max(1,Math.min(3600,remaining)));
      if(error)throw new Error('Could not access this voice message. Check room access and retry.');
      if(!data?.signedUrl)throw new Error('Could not create a secure playback link. Please retry.');
      url=data.signedUrl;
    }
    else if(!url&&v.storage_path){const {data,error}=await supabase.storage.from(bucket).createSignedUrl(v.storage_path,3600);if(error)throw error;if(data?.signedUrl)url=data.signedUrl}
    if(!url)throw new Error('Voice audio is unavailable.');
    const a=new Audio();a.preload='auto';a.playbackRate=rate;
    a.onloadedmetadata=()=>setDuration(Number.isFinite(a.duration)&&a.duration>0?a.duration:duration);
    a.ontimeupdate=()=>setCurrent(a.currentTime);
    a.onwaiting=()=>setBuffering(true);
    a.onplaying=()=>{setBuffering(false);setPlaying(true);setPlayError('')};
    a.onended=()=>{setPlaying(false);setBuffering(false);setCurrent(0)};
    a.onerror=()=>{
      if(bucket==='private-voice-messages'&&!privateFallbackTriedRef.current&&v.storage_path){
        privateFallbackTriedRef.current=true;
        setBuffering(true);
        const remaining=v.expires_at?Math.ceil((new Date(v.expires_at).getTime()-Date.now())/1000):3600;
        void (async()=>{
          let fallbackUrl='';
          let fallbackError='';
          if(privateSourceRef.current==='signed'){
            const {data,error}=await supabase.storage.from(bucket).download(v.storage_path);
            if(error)fallbackError=`Storage download failed${(error as any).statusCode?` (${(error as any).statusCode})`:''}: ${error.message}`;
            else if(data){
              const storedMime=(data.type||'').split(';')[0].trim().toLowerCase();
              const fileMime=/\.(m4a|mp4)$/i.test(v.storage_path)||storedMime==='audio/mp4'||storedMime==='audio/x-m4a'?'audio/mp4':'audio/webm';
              const playableBlob=storedMime===fileMime?data:new Blob([data],{type:fileMime});
              fallbackUrl=URL.createObjectURL(playableBlob);
              objectUrlRef.current=fallbackUrl;
              privateSourceRef.current='blob';
            }else fallbackError='Storage returned no audio data.';
          }else{
            const {data,error}=await supabase.storage.from(bucket).createSignedUrl(v.storage_path,Math.max(1,Math.min(3600,remaining)));
            if(error)fallbackError=`Signed URL failed: ${error.message}`;
            else if(data?.signedUrl){
              fallbackUrl=data.signedUrl;
              privateSourceRef.current='signed';
              if(objectUrlRef.current){URL.revokeObjectURL(objectUrlRef.current);objectUrlRef.current=null}
            }else fallbackError='Storage did not return a signed playback URL.';
          }
          if(audioRef.current!==a)return;
          if(fallbackUrl){a.src=fallbackUrl;a.load();setBuffering(false);return}
          audioRef.current=null;
          if(objectUrlRef.current){URL.revokeObjectURL(objectUrlRef.current);objectUrlRef.current=null}
          setPlaying(false);setBuffering(false);
          setPlayError(`Private voice playback failed. ${fallbackError||'Storage returned no playable audio.'} The object may be missing or blocked by Storage access rules.`);
        })().catch(error=>{
          if(audioRef.current!==a)return;
          audioRef.current=null;
          if(objectUrlRef.current){URL.revokeObjectURL(objectUrlRef.current);objectUrlRef.current=null}
          setPlaying(false);setBuffering(false);
          setPlayError(error instanceof Error?`Private voice playback failed: ${error.message}`:'Audio could not load. Tap play to retry.');
        });
        return;
      }
      if(audioRef.current===a)audioRef.current=null;
      if(bucket==='private-voice-messages'&&objectUrlRef.current){URL.revokeObjectURL(objectUrlRef.current);objectUrlRef.current=null}
      setPlaying(false);setBuffering(false);
      const code=a.error?.code;
      setPlayError(code===4?'This audio format is not supported. Please update the app and retry.':code===2?'Audio download was interrupted. Tap play to retry.':'Audio could not load. Tap play to retry.');
    };
    a.src=url;a.load();audioRef.current=a;return a;
    })();
    loadingRef.current=request;
    try{return await request}finally{loadingRef.current=null}
  };
  useEffect(()=>{
    const node=playerRef.current;
    if(!node)return;
    const preload=()=>{void load().catch(()=>{})};
    if(typeof IntersectionObserver==='undefined'){preload();return}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();preload()}},{rootMargin:'180px 0px'});
    observer.observe(node);
    return()=>observer.disconnect();
  },[v.id,bucket]);
  const startPlayback=(audio:HTMLAudioElement)=>{
    audio.playbackRate=rate;
    if(Number.isFinite(audio.duration)&&audio.currentTime>=audio.duration)audio.currentTime=0;
    setBuffering(true);
    const reportPlayError=(error:unknown)=>{
      setPlaying(false);setBuffering(false);
      setPlayError((error as {name?:string}|null)?.name==='NotAllowedError'?'Audio is ready. Tap play again to start.':'Playback was blocked. Tap play to retry.');
    };
    try{
      void audio.play().then(()=>{setPlaying(true);setBuffering(false)}).catch(reportPlayError);
    }catch(error){reportPlayError(error)}
  };
  const toggle=()=>{
    const existing=audioRef.current;
    if(existing&&!existing.paused){existing.pause();setPlaying(false);setBuffering(false);return}
    if(startingRef.current)return;
    setPlayError('');
    if(existing){startPlayback(existing);return}
    startingRef.current=true;setBuffering(true);
    void load().then(startPlayback).catch(error=>{setPlaying(false);setBuffering(false);setPlayError(error instanceof Error?error.message:'Playback failed. Tap play to retry.')}).finally(()=>{startingRef.current=false});
  };
  const seek=(e:React.ChangeEvent<HTMLInputElement>)=>{const value=Number(e.target.value);if(audioRef.current)audioRef.current.currentTime=value;setCurrent(value)};
  const cycle=()=>{const next=rate===1?1.5:rate===1.5?2:1;setRate(next);if(audioRef.current)audioRef.current.playbackRate=next};
  const fmt=(x:number)=>`${Math.floor(x/60)}:${String(Math.floor(x%60)).padStart(2,'0')}`;
  const progress=duration>0?Math.min(1,current/duration):0;
  return <div className="voice-player" ref={playerRef}>
    <button className="voice-play-btn" onClick={toggle} aria-label={playError|| (buffering?'Preparing voice':playing?'Pause voice':'Play voice')} title={playError||undefined} aria-invalid={playError&&!playError.startsWith('Audio is ready')?true:undefined}>{buffering?<RefreshCw className="voice-play-loading" size={16}/>:playing?<Pause size={17}/>:<Play size={17}/>}</button>
    <div className="voice-player-main">
      <div className="voice-wave voice-wave-player" aria-hidden="true">{Array.from({length:28},(_,i)=>{const height=6+Math.round((Math.sin(i*1.73)+1)*5+(Math.cos(i*.47)+1)*2);const played=progress>=(i+1)/28;return <i key={i} style={{height:`${height}px`,animationDelay:`-${((i*7)%17)*.055}s`,animationDuration:`${.42+(i%5)*.12}s`,background:played?'var(--primary)':undefined}} className={playing?'active':'static'}/>})}</div>
      <input className="voice-seek" type="range" min="0" max={Math.max(duration,0.1)} step="0.01" value={Math.min(current,duration||0)} onChange={seek} aria-label="Voice playback position"/>
      <div className="voice-player-meta"><span>{fmt(current)}</span><span>{fmt(duration)}</span></div>
      {playError&&<small className="voice-player-error" data-kind={playError.startsWith('Audio is ready')?'ready':'error'} role={playError.startsWith('Audio is ready')?'status':'alert'}>{playError}</small>}
    </div>
    <button className="voice-speed-btn" onClick={cycle} title="Playback speed">{rate}x</button>
  </div>;
},(previous,next)=>previous.v===next.v&&previous.bucket===next.bucket);
function VoiceBubble({v,current,onDeleteForMe,onDeleteForEveryone,onAddFriend,onReply,onReplyJump,timeFormat,counts,mine,onToggleReaction}:{v:VoiceMessage;current:boolean;onDeleteForMe:()=>void;onDeleteForEveryone:()=>void;onAddFriend:()=>void;onReply:()=>void;onReplyJump:(id:string,isVoice:boolean)=>void;timeFormat:TimeFormat;counts:Record<string,number>;mine:string[];onToggleReaction:(r:string)=>Promise<void>}){const [menu,setMenu]=useState(false);const countryName=iso31661.find(c=>c.alpha2===v.country)?.name??v.country;const subdivisionName=iso31662.find(s=>s.code===v.subdivision)?.name??v.subdivision.split('-').pop()??v.subdivision;return <article id={`voice-${v.id}`} className={`private-message public-message private-voice-message ${current?'mine':''} ${menu?'menu-open':''}`}><div className="message-identity"><img className="message-avatar" src={avatarSrc(v.avatar_id)} alt=""/><div><strong>{v.name}</strong><span>{flag(v.country)} {subdivisionName}, {countryName}</span></div></div> {(v.reply_to_voice_id||v.reply_to_message_id)&&<button className="reply-preview voice-reply-preview" onClick={()=>onReplyJump((v.reply_to_voice_id||v.reply_to_message_id)!,Boolean(v.reply_to_voice_id))}><ReplyIcon size={13}/><span><b>{v.reply_to_name||'User'}</b>{v.reply_to_preview||'Reply'}</span></button>}<div className="private-bubble private-voice-bubble"><VoicePlayer key={v.id} v={v}/><button className="voice-menu-btn" onClick={()=>setMenu(x=>!x)} aria-label="Voice message options" title="Voice message options"><MoreVertical size={18}/></button>{menu&&<div className="private-item-menu voice-menu">{!current&&<button onClick={()=>{onAddFriend();setMenu(false)}}><UserRound size={14}/> Add Friend</button>}<button onClick={()=>{onDeleteForMe();setMenu(false)}}><Trash2 size={14}/> Delete for me</button>{current&&<button className="danger" onClick={()=>{onDeleteForEveryone();setMenu(false)}}><Trash2 size={14}/> Delete for everyone</button>}<button onClick={()=>setMenu(false)}><X size={14}/> Cancel</button></div>}</div><div className="private-item-actions voice-reactions">{REACTIONS.map(r=><button key={r} className={mine.includes(r)?'reacted':''} onClick={()=>void onToggleReaction(r)}>{r}{counts[r]?<small>{counts[r]}</small>:null}</button>)}<button onClick={onReply} aria-label="Reply" title="Reply"><ReplyIcon size={13}/></button><time>{formatMessageTime(v.created_at,timeFormat)}</time></div></article>}

function PrivateChatModal({mode,roomName,setRoomName,joinCode,setJoinCode,error,busy,onClose,onCreate,onJoin}:{mode:'create'|'join';roomName:string;setRoomName:(v:string)=>void;joinCode:string;setJoinCode:(v:string)=>void;error:string;busy:boolean;onClose:()=>void;onCreate:()=>void;onJoin:()=>void}){return <div className="private-modal-backdrop" role="dialog" aria-modal="true"><div className="private-modal"><div className="panel-head"><div><b>{mode==='create'?<><LockKeyhole size={17}/> CREATE PRIVATE CHAT</>:<><KeyRound size={17}/> JOIN PRIVATE CHAT</>}</b><span>{mode==='create'?'Create a private room with a unique 8-character private code':'Enter the 8-character private code'}</span></div><button onClick={onClose}><X/></button></div>{mode==='create'?<><label>Room Name</label><input maxLength={40} value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="e.g. Friends Room" autoFocus/></>:<><label>Private Code</label><input maxLength={8} value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="8-character private code" autoFocus/></>}{error&&<div className="private-error">{error.replace(/room code/gi, 'private code')}</div>}<div className="private-modal-actions private-code-modal-actions"><button className="private-modal-cancel clear-cancel-btn" onClick={onClose}>CANCEL</button><button className="primary-btn" disabled={busy} onClick={mode==='create'?onCreate:onJoin}>{busy?'PLEASE WAIT...':mode==='create'?'CREATE ROOM':'JOIN ROOM'}</button></div></div></div>}
function PrivateRoomView({profile,room,messages,setMessages,text,setText,sending,onSend,onClose,onCopy,replyTarget,setReplyTarget,currentUserId,sendError,privateOnline,privateTyping,onTyping,sound,onMembers,onAddFriend,privateRecording,onRecording}:{profile:Profile;room:any;messages:any[];setMessages:React.Dispatch<React.SetStateAction<any[]>>;text:string;setText:(v:string)=>void;sending:boolean;onSend:()=>void;onClose:()=>void;onCopy:(m:any)=>void;replyTarget:any;setReplyTarget:(v:any)=>void;currentUserId:string;sendError:string;privateOnline:number;privateTyping:boolean;onTyping:(value:string)=>void;sound:boolean;onMembers:()=>void;onAddFriend:(userId:string)=>void;privateRecording:boolean;onRecording:(active:boolean)=>void}){
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
  const [privateSearchOpen,setPrivateSearchOpen]=useState(false);
  const [privateClearConfirmOpen,setPrivateClearConfirmOpen]=useState(false);
  const [privateMenuOpen,setPrivateMenuOpen]=useState(false);
  const [privateEmojiOpen,setPrivateEmojiOpen]=useState(false);
  const [menuId,setMenuId]=useState<string|null>(null);
  const [editingMessageId,setEditingMessageId]=useState<string|null>(null);
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
    const {data,error}=await supabase.from('private_voice_messages').select('*').eq('room_id',room.id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100);
    if(error){console.error('Private voice database query failed:',error);setPrivateError(`Could not load private voice messages: ${error.message}`);return;}
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
    let privateVoiceChangesReady=false;
    const ch=supabase.channel('private-media-'+room.id)
      .on('system',{},(payload:any)=>{
        if(payload?.extension!=='postgres_changes')return;
        privateVoiceChangesReady=payload.status==='ok';
        if(!privateVoiceChangesReady)void loadVoices();
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'private_voice_messages',filter:'room_id=eq.'+room.id},
        payload=>{if(localDeleted['v:'+payload.new.id])return;const v=payload.new as any;setVoices(prev=>prev.some(x=>x.id===v.id)?prev:[...prev,v].sort((a,b)=>a.created_at.localeCompare(b.created_at)))})
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'private_voice_messages',filter:'room_id=eq.'+room.id},
        payload=>setVoices(prev=>prev.filter(v=>v.id!==payload.old.id)))
      .subscribe((status:string,subscribeError:any)=>{
        if(status==='SUBSCRIBED'){privateVoiceChangesReady=true;void loadVoices()}
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){privateVoiceChangesReady=false;if(subscribeError)console.warn('Private voice realtime connection issue:',subscribeError)}
      });
    const poll=window.setInterval(()=>{if(!privateVoiceChangesReady)void loadVoices()},5000);
    return()=>{void supabase.removeChannel(ch);window.clearInterval(poll);audioRef.current?.pause();if(timerRef.current)window.clearInterval(timerRef.current)};
  },[room.id,localDeleted]);

  useEffect(()=>{void loadReactions()},[messages.length,voices.length,currentUserId]);
  useEffect(()=>{
    const now=Date.now();
    const messageTimers:number[]=[];
    const voiceTimers:number[]=[];
    for(const message of messages){
      const delay=new Date(message.expires_at).getTime()-now;
      if(delay<=0){setMessages(prev=>prev.filter(item=>item.id!==message.id));continue}
      if(delay<2147483647)messageTimers.push(window.setTimeout(()=>setMessages(prev=>prev.filter(item=>item.id!==message.id)),delay+25));
    }
    for(const voice of voices){
      const delay=new Date(voice.expires_at).getTime()-now;
      if(delay<=0){setVoices(prev=>prev.filter(item=>item.id!==voice.id));continue}
      if(delay<2147483647)voiceTimers.push(window.setTimeout(()=>{setVoices(prev=>prev.filter(item=>item.id!==voice.id));if(playingId===voice.id){audioRef.current?.pause();audioRef.current=null;setPlayingId(null);setPlayingElapsed(0)}},delay+25));
    }
    return()=>{messageTimers.forEach(window.clearTimeout);voiceTimers.forEach(window.clearTimeout)};
  },[messages,voices,playingId]);

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
  const editPrivateMessage=async(id:string,body:string)=>{
    const message=messages.find((item:any)=>item.id===id);
    if(!message||message.user_id!==currentUserId||!canEditMessage(message)){setPrivateError('This message is outside the 5-minute edit window.');return false;}
    const {data,error}=await supabase.rpc('edit_private_message',{p_message_id:id,p_body:body});
    if(error){setPrivateError(error.message||'Could not edit this message.');return false;}
    if(!data){setPrivateError('Could not edit this message.');return false;}
    setMessages(prev=>prev.map((item:any)=>item.id===id?{...item,...data}:item));
    setPrivateError('');
    return true;
  };

  const uploadPrivateVoice=async(blob:Blob,duration:number)=>{
    setPrivateError('');setVoiceBusy(true);
    const tempId='optimistic-private-voice-'+crypto.randomUUID();
    const localUrl=URL.createObjectURL(blob);
    const reply=replyTargetForPrivateRef.current;
    const optimistic={id:tempId,room_id:room.id,user_id:currentUserId,name:profile.name,country:profile.country,subdivision:profile.subdivision,avatar_id:profile.avatarId,audio_url:localUrl,storage_path:null,duration_ms:duration,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+24*60*60*1000).toISOString(),reply_to_message_id:reply?.reply_to_voice_id?null:reply?.id||null,reply_to_voice_id:reply?.reply_to_voice_id||null,reply_to_preview:reply?.body||null,reply_to_name:reply?.name||null,pending:true};
    setVoices(prev=>[...prev,optimistic].sort((a,b)=>a.created_at.localeCompare(b.created_at)));
    try{
      const userId=currentUserId;if(!userId)throw new Error('Authentication required');const rawMime=(blob.type||'audio/webm').split(';')[0].trim().toLowerCase();const mime=rawMime==='audio/mp4'||rawMime==='audio/x-m4a'?'audio/mp4':'audio/webm';const ext=mime==='audio/mp4'?'m4a':'webm';const path=room.id+'/' +userId+'/private-'+crypto.randomUUID()+'.'+ext;
      const normalizedBlob=new Blob([blob],{type:mime});
      const up=await supabase.storage.from('private-voice-messages').upload(path,normalizedBlob,{contentType:mime,upsert:false,cacheControl:'0'});
      if(up.error)throw up.error;
      const replyToMessageId=reply?.reply_to_voice_id?null:(reply?.id&&!String(reply.id).startsWith('voice-reply-')?reply.id:null);
      const replyToVoiceId=reply?.reply_to_voice_id||null;
      let rpcResult=await supabase.rpc('send_private_voice',{p_room_id:room.id,p_name:profile.name,p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatarId,p_audio_url:path,p_storage_path:path,p_duration_ms:duration,p_reply_to_id:replyToMessageId,p_reply_to_voice_id:replyToVoiceId});
      if(rpcResult.error && /PGRST202|Could not find the function|function public\.send_private_voice|schema cache/i.test(rpcResult.error.message||'')){
        rpcResult=await supabase.rpc('send_private_voice',{p_room_id:room.id,p_name:profile.name,p_country:profile.country,p_subdivision:profile.subdivision,p_avatar_id:profile.avatarId,p_audio_url:path,p_storage_path:path,p_duration_ms:duration,p_reply_to_voice_id:replyToVoiceId});
      }
      if(rpcResult.error){await supabase.storage.from('private-voice-messages').remove([path]);throw rpcResult.error;}
      const message=Array.isArray(rpcResult.data)?rpcResult.data[0]:rpcResult.data;
      if(message)setVoices(prev=>[...prev.filter(v=>v.id!==tempId&&v.id!==message.id),message].sort((a,b)=>a.created_at.localeCompare(b.created_at)));
      URL.revokeObjectURL(localUrl);
      setReplyTargetForPrivate(null);
      playPrivateAction('/sounds/send.wav');
      return true;
    }catch(e:any){setVoices(prev=>prev.filter(v=>v.id!==tempId));URL.revokeObjectURL(localUrl);setPrivateError(e?.message||'Could not send private voice message.');return false}
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

  const clearPrivateChatLocally=()=>{
    const next={...localDeleted};
    messages.forEach((m:any)=>{next['m:'+m.id]=true});
    voices.forEach((v:any)=>{next['v:'+v.id]=true});
    persistDeleted(next);
    setMessages([]);
    setVoices([]);
    setSearch('');
    setPrivateSearchOpen(false);
  };

  const filteredText=messages.filter((m:any)=>!localDeleted['m:'+m.id]&&(!search||`${m.name} ${m.body} ${m.country} ${m.subdivision}`.toLowerCase().includes(search.toLowerCase())));
  const beginPrivateReply=(item:any,isVoice=false)=>{const target=isVoice?{...item,id:`voice-reply-${item.id}`,reply_to_voice_id:item.id,body:`Voice message • ${formatDuration(item.duration_ms)}`} : item;setReplyTargetForPrivate(target);setText('');requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.private-composer textarea')?.focus())};
  const filteredVoices=voices.filter(v=>!localDeleted['v:'+v.id]&&(!search||v.name.toLowerCase().includes(search.toLowerCase())));
  const all=[...filteredText.map(m=>({kind:'text' as const,data:m})),...filteredVoices.map(v=>({kind:'voice' as const,data:v}))].sort((a,b)=>a.data.created_at.localeCompare(b.data.created_at));
  const jumpToPrivateReply=(id:string,isVoice:boolean)=>{const targetId=isVoice?`pv-${id}`:`pm-${id}`;document.getElementById(targetId)?.scrollIntoView({behavior:'smooth',block:'center'});setHighlightedPrivateId(targetId);window.setTimeout(()=>setHighlightedPrivateId(x=>x===targetId?null:x),1500)};

  return <div className="private-room-shell">
    <div className="private-room-head">
      <div><b><LockKeyhole size={17}/> {room.name}</b><span>Private chat · Private code: <strong>{room.join_code}</strong></span><span className="private-online-status"><i></i>{privateOnline} Online</span></div>
      <div className="private-room-actions">
        <button className="header-icon" onClick={()=>void navigator.clipboard?.writeText(room.join_code)} title="Copy join code"><Copy size={16}/></button><Suspense fallback={null}><PrivateCallCenter roomId={room.id} currentUserId={currentUserId} currentUserName={profile.name} sound={sound}/></Suspense><button className="private-members-btn" onClick={onMembers} title="Private chat members" aria-label="Private chat members"><Users size={16}/> MEMBERS</button>
        <div className="private-room-menu-wrap"><button className="header-more-trigger private-room-more-trigger" onClick={()=>setPrivateMenuOpen(v=>!v)} aria-label="Private chat options" title="Private chat options"><MoreVertical size={19}/></button>{privateMenuOpen&&<div className="private-room-menu"><button onClick={()=>{setPrivateSearchOpen(true);setPrivateMenuOpen(false)}}><Search size={17}/><span>Search messages</span></button><button onClick={()=>{setPrivateClearConfirmOpen(true);setPrivateMenuOpen(false)}}><Trash2 size={17}/><span>Clear Chat</span></button></div>}</div>
        <button className="private-leave-btn" onClick={onClose}>LEAVE</button>
      </div>
    </div>

    {privateSearchOpen&&<div className="private-chat-search"><Search size={16}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search messages..." aria-label="Search private messages"/><span>{all.length}/{messages.length+voices.length}</span><button onClick={()=>{setSearch('');setPrivateSearchOpen(false)}} aria-label="Close search"><X size={15}/></button></div>}

    {(sendError||privateError)&&<div className="private-error">{sendError||privateError}<button onClick={()=>setPrivateError('')} aria-label="Dismiss"><X size={14}/></button></div>}

    <div className="private-message-list">
      {all.length===0?<div className="empty private-empty-state"><div className="private-lock-animation" aria-hidden="true"><video className="private-lock-video" autoPlay muted playsInline loop preload="auto"><source src="/animations/private-chat-lock-bubbles.webm" type="video/webm"/></video></div><h2>Private chat</h2><p>Only joined members can see these messages.</p></div>:
      all.map(item=>item.kind==='text'?
        <article key={'m-'+item.data.id} id={'pm-'+item.data.id} className={`private-message ${item.data.user_id===currentUserId?"mine":""} ${highlightedPrivateId===`pm-${item.data.id}`?"highlighted":""}`}>
          <div className="message-identity"><img className="message-avatar" src={avatarSrc(Number(item.data.avatar_id))} alt=""/><div><strong>{item.data.name}</strong><span>{flag(item.data.country)} {item.data.subdivision}</span></div></div>
          {(item.data.reply_to_id||item.data.reply_to_voice_id)&&<button className="reply-preview" onClick={()=>jumpToPrivateReply((item.data.reply_to_voice_id||item.data.reply_to_id)!,Boolean(item.data.reply_to_voice_id))}><ReplyIcon size={13}/><span><b>{item.data.reply_to_name||'User'}</b>{item.data.reply_to_preview||'Reply'}</span></button>}
          {editingMessageId===item.data.id?<InlineMessageEditor value={item.data.body} onSave={body=>editPrivateMessage(item.data.id,body)} onCancel={()=>setEditingMessageId(null)}/>:<div className="private-bubble"><span>{item.data.body}</span><time>{item.data.edited_at?'Edited · ':''}{formatMessageTime(item.data.created_at,'12h')}</time></div>}
          <div className="private-item-actions">
            {REACTIONS.map(r=><button key={r} className={mine[item.data.id]?.includes(r)?'reacted':''} onClick={()=>void toggleReaction(item.data.id,false,r)}>{r}{reactions[item.data.id]?.[r]?<small>{reactions[item.data.id][r]}</small>:null}</button>)}
            <button onClick={()=>{setReplyTargetForPrivate(item.data);setText('');requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.private-composer textarea')?.focus())}} aria-label="Reply"><ReplyIcon size={13}/></button>
            <button onClick={()=>void onCopy(item.data)} aria-label="Copy"><Copy size={13}/></button>
            <button onClick={()=>setMenuId(menuId==='m'+item.data.id?null:'m'+item.data.id)} aria-label="Message options"><MoreVertical size={15}/></button>
            {menuId==='m'+item.data.id&&<div className="private-item-menu">{item.data.user_id!==currentUserId&&<button onClick={()=>{onAddFriend(item.data.user_id);setMenuId(null)}}><UserRound size={14}/> Add Friend</button>}{item.data.user_id===currentUserId&&canEditMessage(item.data)&&<button onClick={()=>{setEditingMessageId(item.data.id);setMenuId(null)}}><Pencil size={14}/> Edit message</button>}<button onClick={()=>deleteForMe(item.data.id,false)}>Delete for me</button>{item.data.user_id===currentUserId&&<button className="danger" onClick={()=>void deleteForEveryone(item.data.id,false)}>Delete for everyone</button>}<button onClick={()=>setMenuId(null)}><X size={14}/> Cancel</button></div>}
          </div>
        </article>
      :
        <article key={'v-'+item.data.id} id={'pv-'+item.data.id} className={`private-message private-voice-message ${item.data.user_id===currentUserId?"mine":""} ${highlightedPrivateId===`pv-${item.data.id}`?"highlighted":""}`}>
          <div className="message-identity"><img className="message-avatar" src={avatarSrc(Number(item.data.avatar_id))} alt=""/><div><strong>{item.data.name}</strong><span>{flag(item.data.country)} {item.data.subdivision}</span></div></div>
          {(item.data.reply_to_voice_id||item.data.reply_to_message_id)&&<button className="reply-preview voice-reply-preview" onClick={()=>jumpToPrivateReply((item.data.reply_to_voice_id||item.data.reply_to_message_id)!,Boolean(item.data.reply_to_voice_id))}><ReplyIcon size={13}/><span><b>{item.data.reply_to_name||'User'}</b>{item.data.reply_to_preview||'Reply'}</span></button>}
          <div className="private-bubble private-voice-bubble"><VoicePlayer v={item.data} bucket="private-voice-messages"/></div>
          <div className="private-item-actions">
            {REACTIONS.map(r=><button key={r} className={mine[item.data.id]?.includes(r)?'reacted':''} onClick={()=>void toggleReaction(item.data.id,true,r)}>{r}{reactions[item.data.id]?.[r]?<small>{reactions[item.data.id][r]}</small>:null}</button>)}
            <button onClick={()=>{setReplyTargetForPrivate({...item.data,id:`voice-reply-${item.data.id}`,reply_to_voice_id:item.data.id,body:`Voice message • ${formatDuration(item.data.duration_ms||0)}`});setText('');requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.private-composer textarea')?.focus())}} aria-label="Reply to voice message" title="Reply"><ReplyIcon size={13}/></button>
            <button onClick={()=>void onCopy({body:'Voice message'})} aria-label="Copy"><Copy size={13}/></button>
            <button onClick={()=>setMenuId(menuId==='v'+item.data.id?null:'v'+item.data.id)} aria-label="Voice options"><MoreVertical size={15}/></button>
            {menuId==='v'+item.data.id&&<div className="private-item-menu">{item.data.user_id!==currentUserId&&<button onClick={()=>{onAddFriend(item.data.user_id);setMenuId(null)}}><UserRound size={14}/> Add Friend</button>}<button onClick={()=>deleteForMe(item.data.id,true)}>Delete for me</button>{item.data.user_id===currentUserId&&<button className="danger" onClick={()=>void deleteForEveryone(item.data.id,true)}>Delete for everyone</button>}<button onClick={()=>setMenuId(null)}><X size={14}/> Cancel</button></div>}
          </div>
        </article>
      )}
    </div>

    {privateClearConfirmOpen&&<div className="clear-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="private-clear-modal-title"><div className="clear-modal"><div className="clear-modal-icon"><Trash2 size={20}/></div><h3 id="private-clear-modal-title">Clear Private Chat?</h3><p>Clear all currently visible private messages on this device?</p><span>Messages on other devices will not be deleted.</span><div className="clear-modal-actions"><button className="private-modal-cancel clear-cancel-btn" onClick={()=>setPrivateClearConfirmOpen(false)}>CANCEL</button><button className="clear-confirm-btn" onClick={()=>{clearPrivateChatLocally();setPrivateClearConfirmOpen(false)}}>CLEAR CHAT</button></div></div></div>}

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
        <div className="tools private-tools"><button className="icon-btn" onClick={()=>setPrivateEmojiOpen(v=>!v)} aria-label="Emoji"><Smile size={19}/></button>{privateEmojiOpen&&<EmojiPicker className="private-emoji-picker" onSelect={emoji=>{const next=text+emoji;setText(next);onTyping(next);setPrivateEmojiOpen(false)}} />}</div>
        <textarea value={text} maxLength={500} onChange={e=>{const value=e.target.value;setText(value);onTyping(value)}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onSend()}}} placeholder="Type a private message..." rows={1}/>
        <button className="voice-btn" disabled={sending||voiceBusy||recording} onClick={()=>void startVoice()} aria-label="Record private voice message"><Mic size={18}/></button>
        <button className={`send-btn ${(sending||voiceBusy)?'is-sending':''}`} disabled={!text.trim()||sending||voiceBusy} onClick={onSend}><Send size={18}/></button>
      </div>
    }

  </div>
}


function PrivateMembersModal({room,members,blockedMembers,loading,error,currentUserId,isOwner,onClose,onRefresh,onRemove,onBlock,onUnblock,onAddFriend}:{room:any;members:any[];blockedMembers:any[];loading:boolean;error:string;currentUserId:string;isOwner:boolean;onClose:()=>void;onRefresh:()=>void;onRemove:(m:any)=>Promise<void>;onBlock:(m:any)=>Promise<void>;onUnblock:(m:any)=>void;onAddFriend:(userId:string)=>void}){
  const [pendingAction,setPendingAction]=useState<{kind:'remove'|'block';member:any}|null>(null);
  const [actionBusy,setActionBusy]=useState(false);
  const card=(m:any,blocked=false)=>{
    const countryName=iso31661.find(c=>c.alpha2===m.country)?.name||m.country||'Country not set';
    const stateName=iso31662.find(x=>x.code===m.subdivision)?.name||m.subdivision||'State not set';
    return <div className={`private-member-card ${blocked?'blocked':''}`} key={`${blocked?'b':'m'}-${m.user_id}`}>
      <img className="private-member-avatar" src={avatarSrc(Number(m.avatar_id))} alt=""/>
      <div className="private-member-info"><div><strong>{m.name||'User'}</strong>{m.is_owner&&<span className="private-admin-badge">ADMIN</span>}</div><span>{m.country?flag(m.country):'--'} {stateName}, {countryName}</span></div>
      {m.user_id!==currentUserId&&<button className="private-member-action" onClick={()=>onAddFriend(m.user_id)} title="Add Friend" aria-label={`Add ${m.name||'member'} as friend`}>ADD FRIEND</button>}
      {isOwner&&m.user_id!==currentUserId&&!m.is_owner&&<div className="private-member-actions">{blocked?<button onClick={()=>onUnblock(m)} className="private-member-action unblock">UNBLOCK</button>:<><button onClick={()=>setPendingAction({kind:'remove',member:m})} className="private-member-action remove">REMOVE</button><button onClick={()=>setPendingAction({kind:'block',member:m})} className="private-member-action block">BLOCK</button></>}</div>}
    </div>
  };
  const confirmMemberAction=async()=>{
    if(!pendingAction||actionBusy)return;
    setActionBusy(true);
    try{
      if(pendingAction.kind==='remove')await onRemove(pendingAction.member);
      else await onBlock(pendingAction.member);
      setPendingAction(null);
    }finally{setActionBusy(false)}
  };
  return <>
    <div className="private-members-backdrop" role="dialog" aria-modal="true">
      <div className="private-members-panel">
        <div className="private-members-head"><div><b><Users size={17}/> PRIVATE CHAT MEMBERS</b><span>{room.name} · {members.length} member{members.length===1?'':'s'}</span></div><div><button className="private-members-control" onClick={onRefresh} title="Refresh members" aria-label="Refresh members"><RefreshCw size={17} strokeWidth={2.2}/></button><button className="private-members-control" onClick={onClose} title="Close" aria-label="Close"><X size={18} strokeWidth={2.2}/></button></div></div>
        {error&&<div className="private-error">{error}</div>}
        <div className="private-members-list">{loading?<div className="private-members-empty">Loading members...</div>:members.length===0?<div className="private-members-empty">No active members.</div>:members.map(m=>card(m))}{isOwner&&blockedMembers.length>0&&<section className="private-blocked-section"><div><strong>BLOCKED</strong> <span>{blockedMembers.length}</span></div>{blockedMembers.map(m=>card(m,true))}</section>}</div>
        <div className="private-members-footer"><span>{isOwner?'You are the room admin.':'Room admin is the creator.'}</span><button className="private-modal-cancel" onClick={onClose}>CLOSE</button></div>
      </div>
    </div>
    {pendingAction&&<ActionDialog title={pendingAction.kind==='remove'? `Remove ${pendingAction.member.name||'this member'}?`:`Block ${pendingAction.member.name||'this member'} from this private chat?`} message={pendingAction.kind==='remove'?'They will be removed from this private chat.':'Confirm that you want to block this member from the private chat.'} confirmLabel={pendingAction.kind==='remove'?'Remove member':'Block member'} icon={pendingAction.kind==='remove'?<Trash2 size={22}/>:<Ban size={22}/>} busy={actionBusy} busyLabel="Updating…" onConfirm={confirmMemberAction} onCancel={()=>{if(!actionBusy)setPendingAction(null)}}/>}
  </>;
}

function YourPrivateChatsModal({rooms,loading,error,pinnedRoomIds,currentRoomId,currentUserId,onRefresh,onTogglePin,onClose,onEnter,onDelete,onRename}:{rooms:any[];loading:boolean;error:string;pinnedRoomIds:string[];currentRoomId:string|null;currentUserId:string;onRefresh:()=>void;onTogglePin:(room:any)=>void;onClose:()=>void;onEnter:(room:any)=>void;onDelete:(room:any)=>void;onRename:(room:any)=>void}){
  return <div className="modal-backdrop your-private-chats-backdrop">
    <div className="your-private-chats-modal">
      <div className="your-private-chats-head">
        <div>
          <b><Users size={17}/> YOUR PRIVATE CHATS</b>
          <span>Created and joined private rooms</span>
        </div>
        <button onClick={onClose} aria-label="Close"><X size={18}/></button>
      </div>

      <div className="your-private-chats-list">
        {error&&<div className="your-private-chats-error" role="alert"><span>{error}</span><button onClick={onRefresh}><RefreshCw size={14}/> Retry</button></div>}
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
                <span>{owner?'Created by you':'Joined private chat'} · Private code: <b>{room.join_code}</b></span>
              </div>
            </div>

            <div className="your-private-chat-actions">
              <button className={`your-private-pin-btn ${pinnedRoomIds.includes(room.id)?'is-pinned':''}`} onClick={()=>onTogglePin(room)} aria-label={pinnedRoomIds.includes(room.id)?'Unpin private chat':'Pin private chat'} aria-pressed={pinnedRoomIds.includes(room.id)} title={pinnedRoomIds.includes(room.id)?'Unpin private chat':'Pin private chat'}><Pin size={15}/></button>
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

function FeedbackPanel({profile,onClose}:{profile:Profile;onClose:()=>void}){
  const [type,setType]=useState<'bug'|'feedback'|'not-working'>('bug');
  const [description,setDescription]=useState('');
  const [page,setPage]=useState('');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState('');
  const submit=async()=>{
    const body=description.trim();
    if(body.length<5){setError('Please describe the issue in at least 5 characters.');return}
    setBusy(true);setError('');
    try{
      const payload={type,description:body,page:page.trim().slice(0,120),profile:{name:profile.name,country:profile.country,subdivision:profile.subdivision}};
      const {data,error}=await supabase.functions.invoke('submit-feedback',{body:payload});
      if(error) throw new Error(await edgeFunctionErrorMessage(error,'Could not submit the report. Please try again.'));
      if(!data?.ok) throw new Error(data?.error||'The report was not confirmed. Please try again.');
      setDone(true);
    }catch(e:any){setError(e?.message||'Could not submit the report. Please try again.');}
    finally{setBusy(false)}
  };
  return <div className="feedback-backdrop" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
    <div className="feedback-panel">
      <div className="panel-head"><div><b><Bell size={17}/> FEEDBACK / BUG REPORT</b><span>Tell us what happened and help improve Zynyro.</span></div><button onClick={onClose} aria-label="Close"><X/></button></div>
      {done ? <div className="feedback-success"><div className="feedback-success-icon"><Check size={22}/></div><h3>Report submitted</h3><p>Thanks. Your report has been sent for review.</p><button className="primary-btn" onClick={onClose}>DONE</button></div> : <>
        <label>Report type</label>
        <div className="feedback-types"><button className={type === 'bug' ? 'active' : ''} onClick={() => setType('bug')}><Bug size={17}/> Bug / Error</button><button className={type === 'feedback' ? 'active' : ''} onClick={() => setType('feedback')}><MessageCircle size={17}/> Feedback</button><button className={type === 'not-working' ? 'active' : ''} onClick={() => setType('not-working')}><AlertTriangle size={17}/> Something not working</button></div>
        <label>What happened?</label>
        <textarea className="feedback-textarea" maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the problem or feedback..." autoFocus/>
        <label>Page / feature <span className="feedback-optional">optional</span></label>
        <input className="feedback-input" maxLength={120} value={page} onChange={e=>setPage(e.target.value)} placeholder="Example: Private Chat / Voice Call"/>
        {error&&<div className="feedback-error">{error}</div>}
        <div className="feedback-actions"><button className="private-modal-cancel" onClick={onClose} disabled={busy}>CANCEL</button><button className="primary-btn feedback-submit" onClick={()=>void submit()} disabled={busy||description.trim().length<5}>{busy?'SUBMITTING...':'SUBMIT REPORT'}</button></div>
        <small className="feedback-note">Reports are delivered through the secure backend. Your receiving email addresses are not exposed in the app.</small>
      </>}
    </div>
  </div>
}

function SettingsPanel({profile,settings,accountPassword,onAccountPasswordChange,onClose,onSave,onLogout,onDeleteChats}:{profile:Profile;settings:any;accountPassword:string;onAccountPasswordChange:(pin:string)=>void;onClose:()=>void;onSave:(p:Profile,s:any)=>Promise<void>;onLogout:()=>Promise<void>;onDeleteChats:()=>Promise<void>}){
 const [p,setP]=useState(profile);const [s,setS]=useState(settings);const [avatarStyle,setAvatarStyle]=useState(avatarPickerStyleForId(profile.avatarId));const [publicUid,setPublicUid]=useState<number|null>(null);const [passwordConfigured,setPasswordConfigured]=useState(()=>/^\d{5}$/.test(accountPassword));const [credentialLoading,setCredentialLoading]=useState(true);const [newPassword,setNewPassword]=useState('');const [confirmNewPassword,setConfirmNewPassword]=useState('');const [currentPassword,setCurrentPassword]=useState('');const [changePasswordOpen,setChangePasswordOpen]=useState(false);const [showPassword,setShowPassword]=useState(false);const [passwordBusy,setPasswordBusy]=useState(false);const [credentialMessage,setCredentialMessage]=useState('');const [credentialError,setCredentialError]=useState('');const [confirmAction,setConfirmAction]=useState<null|'logout'|'delete'>(null);const [confirmStep,setConfirmStep]=useState<1|2>(1);const [consent,setConsent]=useState(false);const [actionBusy,setActionBusy]=useState(false);const [actionError,setActionError]=useState('');const [savingSettings,setSavingSettings]=useState(false);const [settingsSaveError,setSettingsSaveError]=useState('');
 useEffect(()=>{let live=true;const loadCredential=async()=>{const [profileResult,statusResult]=await Promise.all([supabase.from('profiles').select('public_uid').maybeSingle(),supabase.functions.invoke('account-recovery',{body:{action:'status'}})]);if(!live)return;if(profileResult.data?.public_uid)setPublicUid(Number(profileResult.data.public_uid));if(statusResult.error){setCredentialError('Could not load the saved password. Log in again with your UID and password to show it here.');setCredentialLoading(false);return}const configured=Boolean(statusResult.data?.configured)||/^\d{5}$/.test(accountPassword);setPasswordConfigured(configured);if(profileResult.data?.public_uid==null&&statusResult.data?.publicUid)setPublicUid(Number(statusResult.data.publicUid));const savedPin=typeof statusResult.data?.pin==='string'&&/^\d{5}$/.test(statusResult.data.pin)?statusResult.data.pin:'';if(savedPin){onAccountPasswordChange(savedPin)}else if(configured&&accountPassword){void supabase.functions.invoke('account-recovery',{body:{action:'remember-password',pin:accountPassword}}).catch(()=>{})};if(live)setCredentialLoading(false)};void loadCredential();return()=>{live=false}},[]);
 const nameValid=p.name.trim().length>=2&&p.name.trim().length<=32;const cleanName=(value:string)=>value.trim().replace(/\s+/g,' ');const defaultTextSize=(value:any)=>value||'medium';const defaultTimeFormat=(value:any)=>value||'12h';
 const dirty=cleanName(p.name)!==cleanName(profile.name)||p.avatarId!==profile.avatarId||p.themeId!==profile.themeId||defaultTextSize(s.textSize)!==defaultTextSize(settings.textSize)||Boolean(s.sound)!==Boolean(settings.sound)||defaultTimeFormat(s.timeFormat)!==defaultTimeFormat(settings.timeFormat);
 useEffect(()=>{const t=THEMES.find(x=>x.id===p.themeId)||THEMES[0];applyTheme(t);document.documentElement.style.setProperty('--font-size',String(TEXT_SIZES[s.textSize as TextSize]||TEXT_SIZES.medium)+'px')},[p.themeId,s.textSize]);
 const closeWithoutSaving=()=>{const t=THEMES.find(x=>x.id===profile.themeId)||THEMES[0];applyTheme(t);document.documentElement.style.setProperty('--font-size',String(TEXT_SIZES[settings.textSize as TextSize]||TEXT_SIZES.medium)+'px');onClose()};
 const saveSettings=async()=>{if(savingSettings||!dirty||!nameValid)return;setSavingSettings(true);setSettingsSaveError('');try{await onSave({...p,name:cleanName(p.name)},{...s,timeFormat:defaultTimeFormat(s.timeFormat)})}catch(error){setSettingsSaveError(error instanceof Error?error.message:'Could not save settings. Please try again.')}finally{setSavingSettings(false)}};
 const savePassword=async()=>{setCredentialError('');setCredentialMessage('');if(!/^\d{5}$/.test(newPassword)){setCredentialError('Enter exactly 5 digits.');return}if(newPassword!==confirmNewPassword){setCredentialError('Passwords do not match.');return}if(!/^\d{10}$/.test(String(publicUid||''))){setCredentialError('Could not load your UID. Close Settings and try again.');return}if(!/^\d{5}$/.test(currentPassword)){setCredentialError('Enter your current 5-digit password.');return}setPasswordBusy(true);try{const {data,error}=await supabase.functions.invoke('account-recovery',{body:{action:'change-password-with-credentials',publicUid:String(publicUid),currentPin:currentPassword,newPin:newPassword}});if(error||!data?.configured)throw new Error(data?.error||await edgeFunctionErrorMessage(error,'Could not update your password. Please try again.'));onAccountPasswordChange(newPassword);setPasswordConfigured(true);setNewPassword('');setConfirmNewPassword('');setCurrentPassword('');setChangePasswordOpen(false);setShowPassword(false);setCredentialMessage('Your password has been changed.')}catch(error){setCredentialError(error instanceof Error?error.message:'Could not update your password.')}finally{setPasswordBusy(false)}};
 const copyValue=async(value:string,label:string)=>{try{await navigator.clipboard.writeText(value);setCredentialMessage(label+' copied.');setCredentialError('')}catch{setCredentialError('Clipboard access was blocked. Select and copy it manually.')}};
 const openAction=(action:'logout'|'delete')=>{setConfirmAction(action);setConfirmStep(1);setConsent(false);setActionError('')};const cancelAction=()=>{if(actionBusy)return;setConfirmAction(null);setConfirmStep(1);setConsent(false);setActionError('')};
 const runConfirmedAction=async()=>{if(!confirmAction||!consent)return;setActionBusy(true);setActionError('');try{if(confirmAction==='logout')await onLogout();else await onDeleteChats();}catch(error){setActionError(error instanceof Error?error.message:'Could not complete this action.')}finally{setActionBusy(false)}};
 return <div className="modal-backdrop"><div className="settings-panel"><div className="panel-head settings-panel-head"><div><b><Settings size={17}/> SETTINGS</b><span>Personalize your chat experience</span></div><button type="button" onClick={closeWithoutSaving} aria-label="Close settings" title="Close settings"><X/></button></div>
  <div className="settings-uid-card"><span>YOUR UNIQUE USER ID</span><div className="settings-credential-row"><strong>UID : {publicUid||'Assigning...'}</strong><button type="button" aria-label="Copy UID" title="Copy UID" disabled={!publicUid} onClick={()=>void copyValue(String(publicUid),'UID')}><Copy size={15}/></button></div>
   <div className="settings-credential-row account-password-row"><label htmlFor="settings-account-password">Your Password</label><div className="settings-account-password"><input id="settings-account-password" value={accountPassword} type={showPassword?'text':'password'} readOnly placeholder={credentialLoading?'Loading saved password...':credentialError?'Log in with UID and password to show it':passwordConfigured?'Log in again with UID and password':'Set during new account setup'} aria-label="Your 5-digit password"/><button type="button" disabled={!accountPassword} onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'} title={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button><button type="button" disabled={!accountPassword} onClick={()=>void copyValue(accountPassword,'Password')} aria-label="Copy password" title="Copy password"><Copy size={15}/></button></div></div>
   <small>Use this UID and password to log in on another device. Your password stays active until you change it.</small>
   {credentialLoading&&<small className="settings-recovery-message" role="status">Loading your saved account password...</small>}
   {passwordConfigured&&accountPassword&&!changePasswordOpen&&<button type="button" className="settings-password-save" onClick={()=>{setCurrentPassword('');setNewPassword('');setConfirmNewPassword('');setChangePasswordOpen(true);setCredentialError('');setCredentialMessage('')}}>CHANGE YOUR PASSWORD</button>}
   {passwordConfigured&&accountPassword&&changePasswordOpen&&<div className="settings-password-editor"><label htmlFor="settings-current-password">Current 5-digit password</label><div className="settings-account-password"><input id="settings-current-password" inputMode="numeric" maxLength={5} autoComplete="current-password" type={showPassword?'text':'password'} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value.replace(/\D/g,'').slice(0,5))} placeholder="Enter current password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button></div><label htmlFor="settings-new-password">New 5-digit password</label><div className="settings-account-password"><input id="settings-new-password" inputMode="numeric" maxLength={5} autoComplete="new-password" type={showPassword?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value.replace(/\D/g,'').slice(0,5))} placeholder="Enter 5 digits"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button></div><label htmlFor="settings-confirm-password">Confirm new 5-digit password</label><div className="settings-account-password"><input id="settings-confirm-password" inputMode="numeric" pattern="[0-9]*" maxLength={5} autoComplete="new-password" type={showPassword?'text':'password'} value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value.replace(/\D/g,'').slice(0,5))} placeholder="Confirm new password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button></div><button type="button" className="settings-password-save" disabled={passwordBusy||currentPassword.length!==5||newPassword.length!==5||confirmNewPassword.length!==5} onClick={()=>void savePassword()}>{passwordBusy?'SAVING...':'UPDATE PASSWORD'}</button><button type="button" className="private-modal-cancel" disabled={passwordBusy} onClick={()=>setChangePasswordOpen(false)}>CANCEL</button></div>}
   {(credentialMessage||credentialError)&&<small className={credentialError?'settings-recovery-error':'settings-recovery-message'} role={credentialError?'alert':'status'}>{credentialError||credentialMessage}</small>}
   <small className="settings-recovery-note">Your password is encrypted on your account and can be shown or copied on devices where you log in.</small>
  </div>
  <label><UserRound size={15}/> Name / Nickname</label><input className="settings-name-input" maxLength={32} value={p.name} onChange={e=>setP({...p,name:e.target.value})} placeholder="Enter a nickname..." autoComplete="nickname"/>
  <label><Image size={15}/> Change Avatar <small className="avatar-total">{AVATAR_PICKER_AVATARS.filter(a=>a.style===avatarStyle).length} in {avatarStyle}</small></label><div className="avatar-style-tabs compact-tabs" role="tablist" aria-label="Avatar designs">{AVATAR_PICKER_STYLES.map(style=><button type="button" role="tab" aria-selected={avatarStyle===style.name} className={avatarStyle===style.name?'active':''} key={style.slug} onClick={()=>setAvatarStyle(style.name)}>{style.name}</button>)}</div><div className="avatar-grid compact">{AVATAR_PICKER_AVATARS.filter(a=>a.style===avatarStyle).map(a=><button type="button" className={'avatar '+(p.avatarId===a.id?'selected':'')} key={a.id} onClick={()=>setP({...p,avatarId:a.id})} aria-label={a.letter?a.letter+' letter':a.style+' avatar '+(a.variant+1)} title={a.letter?a.letter+' · '+a.style:a.style+' · '+(a.variant+1)}><img src={a.src} alt={a.letter?a.letter+' letter':a.style+' avatar '+(a.variant+1)}/></button>)}</div>
  <label><Palette size={15}/> Change Theme</label><div className="theme-grid compact-themes">{THEMES.map(t=><button type="button" className={'theme-tile '+(p.themeId===t.id?'selected':'')} key={t.id} style={{background:t.bg,borderColor:t.primary}} onClick={()=>setP({...p,themeId:t.id})}><span style={{background:t.primary}}></span><strong>{t.name}</strong></button>)}</div>
  <label>Text Size</label><div className="segmented">{(['small','medium','large','xl'] as TextSize[]).map(k=><button type="button" className={s.textSize===k?'active':''} key={k} onClick={()=>setS({...s,textSize:k})}>{k==='xl'?'Extra Large':k[0].toUpperCase()+k.slice(1)}</button>)}</div>
  <label><Bell size={15}/> Sound</label><div className="segmented two"><button type="button" className={s.sound?'active':''} onClick={()=>setS({...s,sound:true})}><Volume2 size={15}/> ON</button><button type="button" className={!s.sound?'active':''} onClick={()=>setS({...s,sound:false})}><MicOff size={15}/> OFF</button></div>
  <label><Clock3 size={15}/> Clock Format</label><div className="segmented two"><button type="button" className={defaultTimeFormat(s.timeFormat)==='12h'?'active':''} onClick={()=>setS({...s,timeFormat:'12h'})}>12-hour</button><button type="button" className={defaultTimeFormat(s.timeFormat)==='24h'?'active':''} onClick={()=>setS({...s,timeFormat:'24h'})}>24-hour</button></div>
  <section className="settings-account-actions"><h3>Account</h3><button type="button" className="settings-logout-btn" onClick={()=>openAction('logout')}><LogOut size={16}/> Log Out</button><button type="button" className="settings-delete-chats-btn" onClick={()=>openAction('delete')}><Trash2 size={16}/> Delete All Chats</button><small>Delete All Chats permanently removes text and voice messages you sent. Messages from other people stay in their chats.</small></section>
  {settingsSaveError&&<small className="settings-action-error" role="alert">{settingsSaveError}</small>}<div className="settings-actions"><button type="button" className="private-modal-cancel clear-cancel-btn" onClick={closeWithoutSaving} disabled={savingSettings}>CANCEL</button><button type="button" className="primary-btn" disabled={!dirty||!nameValid||savingSettings} onClick={()=>void saveSettings()}>{savingSettings?'SAVING...':'SAVE SETTINGS'} {!savingSettings&&<Check size={17}/>}</button></div>
  </div>{confirmAction&&<div className="settings-confirm-backdrop" role="presentation"><section className="settings-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="account-action-title"><header><h2 id="account-action-title">{confirmAction==='logout'?'Log Out?':'Delete All Chats?'}</h2><button type="button" onClick={cancelAction} disabled={actionBusy} aria-label="Close confirmation"><X size={18}/></button></header>{confirmStep===1?<><div className="settings-warning-copy"><AlertTriangle size={20}/><p>Before continuing, save both your UID and 5-digit password somewhere safe. You need both to restore this account on another device.</p></div><div className="settings-confirm-actions"><button type="button" className="private-modal-cancel" onClick={cancelAction}>CANCEL</button><button type="button" className="primary-btn" onClick={()=>{setConfirmStep(2);setConsent(false)}}>CONTINUE</button></div></>:<><label className="settings-consent-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{confirmAction==='logout'?'I understand that without my saved UID and password, I may permanently lose access to this account and its chats.':'I understand this permanently deletes messages and voice notes sent by my account from public, friend and private chats for everyone. Messages sent by other people, my account and friend list will remain.'}</span></label>{actionError&&<small className="settings-action-error" role="alert">{actionError}</small>}<div className="settings-confirm-actions"><button type="button" className="private-modal-cancel" onClick={()=>{setConfirmStep(1);setConsent(false);setActionError('')}} disabled={actionBusy}>BACK</button><button type="button" className={confirmAction==='delete'?'settings-confirm-delete':'primary-btn'} disabled={!consent||actionBusy} onClick={()=>void runConfirmedAction()}>{actionBusy?'PLEASE WAIT...':confirmAction==='logout'?'LOG OUT':'DELETE MESSAGES'}</button></div></>}</section></div>}</div>;
}
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





















