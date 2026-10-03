import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, MessageCircle, Search, UserPlus, Users, X, Mic, Square, Play, Pause, Send, MoreVertical, Ban, Pin, PinOff, Trash2, UserRound, Smile, Plus, Clock3 } from 'lucide-react';
import { supabase } from './lib/supabase';
import { iso31661, iso31662 } from 'iso-3166';
import FriendsCallCenter from './FriendsCallCenter';
import ActionDialog from './ActionDialog';
import { AVATARS, EMOJIS } from './data/catalog';
import { clearRemoteActivity, updateRemoteActivity } from './lib/realtimeActivity';
import EmojiPicker from './EmojiPicker';
import InlineMessageEditor from './InlineMessageEditor';
import PollComposer from './PollComposer';
import PollCard, { type ChatPoll } from './PollCard';
import { MessageSearchFilters, emptySearchFilters, matchesMessageSearch, type SearchFilters } from './MessageSearchFilters';
import { containsMention, renderMentionText } from './lib/mentions';
import SafeMessageText from './SafeMessageText';
import type { ChatTextContext } from './lib/reconnectQueue';

type Props={userId:string;profile:{name:string;country:string;subdivision:string;avatarId:number};onQueueText:(context:ChatTextContext,targetId:string|null,body:string,replyToId?:string|null)=>void;onScheduleText:(recipientId:string,body:string,onCreated:()=>void)=>void;onSaveMessage:(context:ChatTextContext,id:string)=>Promise<void>;onClose:()=>void;sound?:boolean;mentionNotifications?:boolean;onMention?:(sender:string)=>void;onUnreadChange?:(count:number)=>void};
type Person={user_id:string;name:string;country?:string;subdivision?:string;showCountry?:boolean;showSubdivision?:boolean;avatar_id?:number;public_uid?:number;online?:boolean;last_seen?:string};
type ChatItem={id:string;sender_id:string;recipient_id:string;body?:string;storage_path?:string;duration_ms?:number;file_size?:number;created_at:string;expires_at?:string;edited_at?:string|null;kind:'text'|'voice';reply_to?:string|null;sending?:boolean};
type ConfirmRequest={title:string;message:string;confirmLabel:string;onConfirm:()=>Promise<void>};
const FRIEND_REACTIONS=['👍','❤️','😂','😮','😢','🙏'];
const COUNTRY_NAMES=new Map(iso31661.map(x=>[x.alpha2,x.name]));
const SUBDIVISION_NAMES=new Map(iso31662.map(x=>[x.code,x.name]));
const avatar=(id:number)=>AVATARS.find(a=>a.id===id)?.src||AVATARS[0].src;
const locationOf=(p:Person)=>{const parts:string[]=[];if(p.showSubdivision!==false&&p.subdivision)parts.push(SUBDIVISION_NAMES.get(p.subdivision)||p.subdivision);if(p.showCountry!==false&&p.country)parts.push(COUNTRY_NAMES.get(p.country)||p.country);return parts.join(', ')||'Location hidden'};
const fmt=(n:number)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const pinnedKey=(userId:string)=>`zynyro-pinned-friends-v1:${userId}`;
const readPinned=(userId:string):string[]=>{try{const value=JSON.parse(localStorage.getItem(pinnedKey(userId))||'[]');return Array.isArray(value)?value.filter((x:any)=>typeof x==='string'):[]}catch{return[]}};
const mapRequestName=(id:string,_rows:any[],people:Person[],friends:Person[])=>[...people,...friends].find(p=>p.user_id===id)?.name||'User';
export default function FriendsPanel({userId,profile,onQueueText,onScheduleText,onSaveMessage,onClose,onUnreadChange,onMention,mentionNotifications=true,sound=true}:Props){
 const [tab,setTab]=useState<'friends'|'requests'|'find'>('friends');
 const [friends,setFriends]=useState<Person[]>([]),[incoming,setIncoming]=useState<any[]>([]),[outgoing,setOutgoing]=useState<any[]>([]),[people,setPeople]=useState<Person[]>([]);
 const [loading,setLoading]=useState(true),[peopleLoading,setPeopleLoading]=useState(false),[peopleLoaded,setPeopleLoaded]=useState(false),[chatLoading,setChatLoading]=useState(false);
 const [selected,setSelected]=useState<Person|null>(null),[messages,setMessages]=useState<ChatItem[]>([]),[draft,setDraft]=useState(''),[query,setQuery]=useState(''),[chatSearch,setChatSearch]=useState(''),[chatFilters,setChatFilters]=useState<SearchFilters>(emptySearchFilters),[replyTo,setReplyTo]=useState<ChatItem|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [onlineIds,setOnlineIds]=useState<string[]>([]),[unread,setUnread]=useState<Record<string,number>>({}),[blockedIds,setBlockedIds]=useState<string[]>([]),[pinnedIds,setPinnedIds]=useState<string[]>(()=>readPinned(userId)),[openFriendMenu,setOpenFriendMenu]=useState<string|null>(null),[recording,setRecording]=useState(false),[recorded,setRecorded]=useState<Blob|null>(null),[seconds,setSeconds]=useState(0),[recordedDuration,setRecordedDuration]=useState(0),[playing,setPlaying]=useState<string|null>(null),[friendTyping,setFriendTyping]=useState(false),[friendRecording,setFriendRecording]=useState(false);
 const [openMessageMenu,setOpenMessageMenu]=useState<string|null>(null);
 const [editingMessageId,setEditingMessageId]=useState<string|null>(null);
 const [friendReactions,setFriendReactions]=useState<Record<string,Record<string,{count:number;mine:boolean}>>>({});
 const [recordingStream,setRecordingStream]=useState<MediaStream|null>(null),[recordingFinishing,setRecordingFinishing]=useState(false);
 const [chatToolsOpen,setChatToolsOpen]=useState(false),[chatSearchOpen,setChatSearchOpen]=useState(false),[friendEmojiOpen,setFriendEmojiOpen]=useState(false),[polls,setPolls]=useState<ChatPoll[]>([]),[pollComposerOpen,setPollComposerOpen]=useState(false),[pollBusy,setPollBusy]=useState(false),[pollError,setPollError]=useState(''),[votingPollId,setVotingPollId]=useState('');
 const [confirmation,setConfirmation]=useState<ConfirmRequest|null>(null),[reactionTarget,setReactionTarget]=useState<ChatItem|null>(null);
 useEffect(()=>setPinnedIds(readPinned(userId)),[userId]);
 useEffect(()=>{setChatToolsOpen(false);setChatSearchOpen(false);setChatSearch('');setChatFilters(emptySearchFilters);setPolls([]);setFriendEmojiOpen(false);setMessages([]);setFriendReactions({});setReplyTo(null);setEditingMessageId(null);setFriendTyping(false);setFriendRecording(false);cancelRecord();audio.current?.pause();setPlaying(null)},[selected?.user_id]);
 const recorder=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]),stream=useRef<MediaStream|null>(null),timer=useRef<number|undefined>(undefined),audio=useRef<HTMLAudioElement|null>(null),voiceUrlCache=useRef(new Map<string,{url:string;expiresAt:number}>()),recordStarted=useRef(0),listRef=useRef<HTMLDivElement>(null),chatChannel=useRef<any>(null),stickToBottom=useRef(true),loadSequence=useRef(0),peopleLoadInFlight=useRef(false),readSequence=useRef<Record<string,number>>({});
 const typingActive=useRef(false),typingHeartbeat=useRef<number|undefined>(undefined),typingStop=useRef<number|undefined>(undefined),recordingHeartbeat=useRef<number|undefined>(undefined),typingUsers=useRef(new Set<string>()),typingTimers=useRef(new Map<string,number>()),recordingUsers=useRef(new Set<string>()),recordingTimers=useRef(new Map<string,number>());
 const load=async()=>{
  const sequence=++loadSequence.current;
  setError('');
  try{
   const [fr,req,blockedRows]=await Promise.all([
    supabase.from('friendships').select('user_a,user_b,created_at').or(`user_a.eq.${userId},user_b.eq.${userId}`),
    supabase.from('friend_requests').select('*').or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).eq('status','pending'),
    supabase.from('friend_blocks').select('blocked_id').eq('blocker_id',userId)
   ]);
   if(sequence!==loadSequence.current)return;
   if(fr.error||req.error){setError(fr.error?.message||req.error?.message||'Could not load friends.');setLoading(false);return}
   const ids=(fr.data||[]).map((r:any)=>r.user_a===userId?r.user_b:r.user_a);
   const requestRows=req.data||[];
   const blockedList=(blockedRows.data||[]).map((r:any)=>r.blocked_id as string);
   const friendIds=[...new Set([...ids,...blockedList])];
   const candidateIds=[...new Set([...friendIds,...requestRows.map((r:any)=>r.sender_id),...requestRows.map((r:any)=>r.recipient_id)].filter((id:string)=>id&&id!==userId))];
   const [directoryResult,profileResult]=candidateIds.length?await Promise.all([
    supabase.rpc('get_friend_directory',{p_user_ids:candidateIds}),
     supabase.from('profiles').select('user_id,name,country,subdivision,show_country,show_subdivision,avatar_id,public_uid').in('user_id',candidateIds)
   ]):[{data:[],error:null},{data:[],error:null}];
   if(sequence!==loadSequence.current)return;
   if(directoryResult.error)setError(directoryResult.error.message);if(profileResult.error)setError(profileResult.error.message);
    const map=new Map<string,Person>();(directoryResult.data||[]).forEach((p:any)=>map.set(p.user_id,{user_id:p.user_id,name:p.name||'User',country:p.country,subdivision:p.subdivision,avatar_id:p.avatar_id,public_uid:p.public_uid}));(profileResult.data||[]).forEach((p:any)=>map.set(p.user_id,{user_id:p.user_id,name:p.name||'User',country:p.show_country===false?'':p.country,subdivision:p.show_subdivision===false?'':p.subdivision,showCountry:p.show_country!==false,showSubdivision:p.show_subdivision!==false,avatar_id:p.avatar_id,public_uid:p.public_uid}));
   const basePeople=[...map.values()];
   setPeople(current=>{const merged=new Map(current.map(p=>[p.user_id,p]));basePeople.forEach(p=>merged.set(p.user_id,p));return [...merged.values()]});
   setBlockedIds(blockedList);
   setFriends(friendIds.map((id:string)=>map.get(id)||{user_id:id,name:'Unknown user',country:'',subdivision:''}));
   setIncoming(requestRows.filter((r:any)=>r.recipient_id===userId));setOutgoing(requestRows.filter((r:any)=>r.sender_id===userId));
   setLoading(false);
   if(!friendIds.length){setUnread({});onUnreadChange?.(0);return}
   const readVersions={...readSequence.current};
   void Promise.all([
    supabase.from('friend_message_reads').select('friend_id,last_read_at').eq('user_id',userId).in('friend_id',friendIds),
    supabase.from('friend_messages').select('sender_id,created_at').eq('recipient_id',userId).gt('expires_at',new Date().toISOString()).in('sender_id',friendIds),
    supabase.from('friend_voice_messages').select('sender_id,created_at').eq('recipient_id',userId).gt('expires_at',new Date().toISOString()).in('sender_id',friendIds)
   ]).then(([readRows,msgRows,voiceRows])=>{
    if(sequence!==loadSequence.current)return;
    const cursors=new Map((readRows.data||[]).map((r:any)=>[r.friend_id,r.last_read_at]));
    const counts:Record<string,number>={};[...(msgRows.data||[]),...(voiceRows.data||[])].forEach((m:any)=>{if(readSequence.current[m.sender_id]!==readVersions[m.sender_id])return;if(!cursors.has(m.sender_id)||new Date(m.created_at)>new Date(String(cursors.get(m.sender_id))))counts[m.sender_id]=(counts[m.sender_id]||0)+1});
    setUnread(counts);onUnreadChange?.(Object.values(counts).reduce((a,b)=>a+b,0));
   }).catch((e:any)=>{if(sequence===loadSequence.current)setError(e?.message||'Could not load unread messages.')});
  }catch(e:any){if(sequence===loadSequence.current){setError(e?.message||'Could not load friends.');setLoading(false)}}
 };
 const loadPeople=useCallback(async()=>{
  if(peopleLoadInFlight.current)return;
  peopleLoadInFlight.current=true;setPeopleLoading(true);
  try{
   const [publicResult,profileResult]=await Promise.all([
    supabase.from('messages').select('user_id,name,country,subdivision,avatar_id,created_at').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(500),
     supabase.from('profiles').select('user_id,name,country,subdivision,show_country,show_subdivision,avatar_id,public_uid').limit(1000)
   ]);
   const {data:publicRows,error:publicError}=publicResult;
   const {data:profileRows,error:profileError}=profileResult;
   if(publicError)throw publicError;
   if(profileError)setError(profileError.message);
   const rows=(publicRows||[]).filter((r:any)=>r.user_id&&r.user_id!==userId);
   const candidateIds=[...new Set(rows.map((r:any)=>r.user_id as string))];
   const {data:directory,error:directoryError}=candidateIds.length?await supabase.rpc('get_friend_directory',{p_user_ids:candidateIds}):{data:[],error:null};
   if(directoryError)throw directoryError;
    const map=new Map<string,Person>();(directory||[]).forEach((p:any)=>map.set(p.user_id,{user_id:p.user_id,name:p.name||'User',country:p.country,subdivision:p.subdivision,avatar_id:p.avatar_id,public_uid:p.public_uid}));(profileRows||[]).forEach((p:any)=>{if(p.user_id!==userId)map.set(p.user_id,{user_id:p.user_id,name:p.name||'User',country:p.show_country===false?'':p.country,subdivision:p.show_subdivision===false?'':p.subdivision,showCountry:p.show_country!==false,showSubdivision:p.show_subdivision!==false,avatar_id:p.avatar_id,public_uid:p.public_uid})});(rows||[]).forEach((r:any)=>{if(!map.has(r.user_id))map.set(r.user_id,{user_id:r.user_id,name:r.name||'User',country:r.country,subdivision:r.subdivision,avatar_id:r.avatar_id})});
   setPeople(current=>{const merged=new Map(current.map(p=>[p.user_id,p]));map.forEach(p=>merged.set(p.user_id,p));return [...merged.values()]});
   setPeopleLoaded(true);
  }catch(e:any){setError(e?.message||'Could not find people.');setPeopleLoaded(true)}
  finally{peopleLoadInFlight.current=false;setPeopleLoading(false)}
 },[userId]);
 useEffect(()=>{if(tab==='find'&&!peopleLoaded)void loadPeople()},[tab,peopleLoaded,loadPeople]);
 useEffect(()=>{void load();const ch=supabase.channel(`friends-presence-global`,{config:{presence:{key:userId}}}).on('presence',{event:'sync'},()=>{const state=ch.presenceState();setOnlineIds(Object.keys(state))}).subscribe(async status=>{if(status==='SUBSCRIBED')await ch.track({user_id:userId,online_at:new Date().toISOString()})});return()=>{loadSequence.current++;void supabase.removeChannel(ch);if(timer.current)window.clearInterval(timer.current);stream.current?.getTracks().forEach(t=>t.stop());audio.current?.pause()}},[userId]);
 const markRead=async(friendId:string)=>{readSequence.current[friendId]=(readSequence.current[friendId]||0)+1;const {error}=await supabase.from('friend_message_reads').upsert({user_id:userId,friend_id:friendId,last_read_at:new Date().toISOString()},{onConflict:'user_id,friend_id'});if(!error)setUnread(v=>({...v,[friendId]:0}))};
 const loadPolls=async(friendId:string)=>{const pair=`and(created_by.eq.${userId},recipient_id.eq.${friendId}),and(created_by.eq.${friendId},recipient_id.eq.${userId})`;const {data,error}=await supabase.from('chat_polls').select('*').eq('context','friend').or(pair).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(50);if(error){setPollError(error.message);return}const rows=(data||[]) as any[];const {data:votes,error:voteError}=rows.length?await supabase.from('chat_poll_votes').select('poll_id,user_id,option_index').in('poll_id',rows.map(p=>p.id)):{data:[],error:null as any};if(voteError){setPollError(voteError.message);return}setPollError('');setPolls(rows.map(p=>({...p,votes:(votes||[]).filter((v:any)=>v.poll_id===p.id)})))};
 useEffect(()=>{if(!selected){setPolls([]);return}setPolls([]);void loadPolls(selected.user_id);const timer=window.setInterval(()=>void loadPolls(selected.user_id),12000);return()=>window.clearInterval(timer)},[selected?.user_id]);
 const createFriendPoll=async(question:string,options:string[])=>{if(!selected)return;setPollBusy(true);setPollError('');const {error}=await supabase.rpc('create_chat_poll',{p_context:'friend',p_room_id:null,p_recipient_id:selected.user_id,p_question:question,p_options:options});if(error)setPollError(error.message);else{setPollComposerOpen(false);await loadPolls(selected.user_id)}setPollBusy(false)};
 const voteFriendPoll=async(pollId:string,index:number)=>{if(!selected)return;setVotingPollId(pollId);const {error}=await supabase.rpc('cast_chat_poll_vote',{p_poll_id:pollId,p_option_index:index});if(error)setPollError(error.message);await loadPolls(selected.user_id);setVotingPollId('')};
 const loadReactions=useCallback(async()=>{if(!selected){setFriendReactions({});return}const ids=messages.filter(m=>!m.id.startsWith('pending-')).map(m=>m.id);if(!ids.length){setFriendReactions({});return}const {data,error}=await supabase.from('friend_message_reactions').select('message_id,message_kind,user_id,reaction').in('message_id',ids);if(error){setError('Could not load message reactions.');return}const next:Record<string,Record<string,{count:number;mine:boolean}>>={};(data||[]).forEach((row:any)=>{const key=`${row.message_kind}:${row.message_id}`;next[key]??={};const value=next[key][row.reaction]||{count:0,mine:false};value.count++;value.mine=value.mine||row.user_id===userId;next[key][row.reaction]=value});setFriendReactions(next)},[messages,selected?.user_id,userId]);
 const warmVoiceUrl=useCallback(async(path:string,messageExpiresAt?:string)=>{const now=Date.now();const remaining=messageExpiresAt?Math.ceil((new Date(messageExpiresAt).getTime()-now)/1000):300;if(remaining<=0)return null;const cached=voiceUrlCache.current.get(path);if(cached&&cached.expiresAt>Date.now()&&(!messageExpiresAt||cached.expiresAt<new Date(messageExpiresAt).getTime()))return cached.url;const lifetime=Math.max(1,Math.min(300,remaining));const {data,error}=await supabase.storage.from('friend-voice-messages').createSignedUrl(path,lifetime);if(error||!data?.signedUrl)return null;voiceUrlCache.current.set(path,{url:data.signedUrl,expiresAt:Math.min(now+(lifetime-3)*1000, messageExpiresAt?new Date(messageExpiresAt).getTime():Number.POSITIVE_INFINITY)});return data.signedUrl},[]);
 useEffect(()=>{if(!selected){setFriendReactions({});return}void loadReactions();const poll=window.setInterval(()=>void loadReactions(),10000);return()=>window.clearInterval(poll)},[selected?.user_id,loadReactions]);
 useEffect(()=>{
  if(!selected){setChatLoading(false);return}
  let live=true,firstFetch=true;
  setChatLoading(true);
  const acceptIncoming=(raw:any,kind:'text'|'voice')=>{
   if(!live||!raw||!((raw.sender_id===userId&&raw.recipient_id===selected.user_id)||(raw.sender_id===selected.user_id&&raw.recipient_id===userId)))return;
   if(raw.expires_at&&new Date(raw.expires_at).getTime()<=Date.now())return;
   const incoming={...raw,kind} as ChatItem;
   setMessages(prev=>{
    if(prev.some(m=>m.id===incoming.id))return prev;
    const optimistic=prev.find(m=>m.id.startsWith('pending-')&&m.sending&&m.kind===kind&&m.sender_id===incoming.sender_id&&m.recipient_id===incoming.recipient_id&&(kind==='text'?m.body===incoming.body:Math.abs((m.duration_ms||0)-(incoming.duration_ms||0))<1200)&&Math.abs(new Date(m.created_at).getTime()-new Date(incoming.created_at).getTime())<30000);
    const next=optimistic?prev.map(m=>m.id===optimistic.id?incoming:m):[...prev,incoming];
    return next.sort((a,b)=>a.created_at.localeCompare(b.created_at));
   });
   if(kind==='voice'&&incoming.storage_path)void warmVoiceUrl(incoming.storage_path,incoming.expires_at);
   void supabase.from('friend_message_hidden').select('message_id').eq('user_id',userId).eq('message_kind',kind).eq('message_id',incoming.id).maybeSingle().then(({data})=>{if(data&&live)setMessages(prev=>prev.filter(m=>m.id!==incoming.id))});
   if(incoming.sender_id!==userId){void markRead(incoming.sender_id);if(kind==='text'&&mentionNotifications&&containsMention(incoming.body||'',profile.name))onMention?.(incoming.sender_id===selected.user_id?selected.name:'Friend');}
  };
  const fetchMessages=async()=>{
   try{
    const [t,v]=await Promise.all([
     supabase.from('friend_messages').select('*').or(`and(sender_id.eq.${userId},recipient_id.eq.${selected.user_id}),and(sender_id.eq.${selected.user_id},recipient_id.eq.${userId})`).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(200),
     supabase.from('friend_voice_messages').select('*').or(`and(sender_id.eq.${userId},recipient_id.eq.${selected.user_id}),and(sender_id.eq.${selected.user_id},recipient_id.eq.${userId})`).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100)
    ]);
    if(!live)return;
    if(t.error||v.error)setError(t.error?.message||v.error?.message||'Could not load messages.');
    else{
     const textRows=t.data||[],voiceRows=v.data||[],textIds=textRows.map((x:any)=>x.id),voiceIds=voiceRows.map((x:any)=>x.id);
     const [hiddenText,hiddenVoice]=await Promise.all([
      textIds.length?supabase.from('friend_message_hidden').select('message_id').eq('user_id',userId).eq('message_kind','text').in('message_id',textIds):Promise.resolve({data:[]}),
      voiceIds.length?supabase.from('friend_message_hidden').select('message_id').eq('user_id',userId).eq('message_kind','voice').in('message_id',voiceIds):Promise.resolve({data:[]})
     ]);
     if(!live)return;
     const hidden=new Set([...(hiddenText.data||[]).map((x:any)=>x.message_id),...(hiddenVoice.data||[]).map((x:any)=>x.message_id)]);
     setMessages(prev=>{
      const merged=new Map<string,ChatItem>();
      [...textRows.map((x:any)=>({...x,kind:'text' as const})),...voiceRows.map((x:any)=>({...x,kind:'voice' as const}))].forEach((m:any)=>{if(!hidden.has(m.id))merged.set(m.id,m)});
      prev.forEach(m=>{if(m.id.startsWith('pending-')||(!hidden.has(m.id)&&!merged.has(m.id)&&(!m.expires_at||new Date(m.expires_at).getTime()>Date.now())))merged.set(m.id,m)});
      return [...merged.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at));
     });
     const latestVoice=voiceRows.at(-1);if(latestVoice?.storage_path)void warmVoiceUrl(latestVoice.storage_path,latestVoice.expires_at);
    }
    if(firstFetch){firstFetch=false;setChatLoading(false)}
    void markRead(selected.user_id);
   }catch(e:any){if(live){setError(e?.message||'Could not load messages.');if(firstFetch){firstFetch=false;setChatLoading(false)}}}
  };
  let postgresChangesReady=false;
  const ch=supabase.channel(`friend-chat-${[userId,selected.user_id].sort().join('-')}`)
   .on('system',{},(payload:any)=>{
    if(payload?.extension!=='postgres_changes')return;
    postgresChangesReady=payload.status==='ok';
    if(!postgresChangesReady)void fetchMessages();
   })
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'friend_messages'},(payload:any)=>acceptIncoming(payload.new,'text'))
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'friend_messages'},(payload:any)=>setMessages(prev=>prev.filter(m=>m.id!==payload.old.id)))
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'friend_messages'},(payload:any)=>setMessages(prev=>prev.map(m=>m.id===payload.new.id?{...m,...payload.new}:m)))
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'friend_voice_messages'},(payload:any)=>acceptIncoming(payload.new,'voice'))
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'friend_voice_messages'},(payload:any)=>setMessages(prev=>prev.filter(m=>m.id!==payload.old.id)))
    .on('broadcast',{event:'typing'},({payload}:any)=>{
     if(payload?.userId!==selected.user_id)return;
     updateRemoteActivity(typingUsers.current,typingTimers.current,payload.userId,Boolean(payload?.active),3200,ids=>setFriendTyping(ids.includes(selected.user_id)));
    })
    .on('broadcast',{event:'recording'},({payload}:any)=>{
     if(payload?.userId!==selected.user_id)return;
     updateRemoteActivity(recordingUsers.current,recordingTimers.current,payload.userId,Boolean(payload?.active),6500,ids=>setFriendRecording(ids.includes(selected.user_id)));
    })
   .subscribe((status:string,subscribeError:any)=>{
    if(status==='SUBSCRIBED'){postgresChangesReady=true;void fetchMessages()}
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){postgresChangesReady=false;if(subscribeError)console.warn('Friend chat realtime connection issue:',subscribeError)}
   });
  chatChannel.current=ch;
  void fetchMessages();
  const fallback=window.setInterval(()=>{if(!postgresChangesReady)void fetchMessages()},5000);
  return()=>{live=false;window.clearInterval(fallback);sendTyping(false);sendRecording(false);clearRemoteActivity(typingUsers.current,typingTimers.current,ids=>setFriendTyping(ids.includes(selected.user_id)));clearRemoteActivity(recordingUsers.current,recordingTimers.current,ids=>setFriendRecording(ids.includes(selected.user_id)));setChatLoading(false);chatChannel.current=null;void supabase.removeChannel(ch)};
 },[selected?.user_id,userId,warmVoiceUrl]);
 useEffect(()=>{const timers:number[]=[];const now=Date.now();for(const message of messages){if(!message.expires_at)continue;const delay=new Date(message.expires_at).getTime()-now;if(delay<=0){setMessages(prev=>prev.filter(m=>m.id!==message.id));continue}if(delay<2147483647)timers.push(window.setTimeout(()=>{setMessages(prev=>prev.filter(m=>m.id!==message.id));if(playing===message.id){audio.current?.pause();setPlaying(null)}},delay+25))}return()=>timers.forEach(window.clearTimeout)},[messages,playing]);
 useEffect(()=>{const el=listRef.current;if(!el||!stickToBottom.current)return;const behavior=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';const frame=window.requestAnimationFrame(()=>el.scrollTo({top:el.scrollHeight,behavior}));return()=>window.cancelAnimationFrame(frame)},[messages]);
 const sendRequest=async(id:string)=>{setBusy(true);setError('');const {error}=await supabase.rpc('send_friend_request',{p_recipient_id:id});if(error)setError(error.message);else await load();setBusy(false)};
 const respond=async(id:string,accept:boolean)=>{setBusy(true);setError('');const {error}=await supabase.rpc('respond_friend_request',{p_request_id:id,p_accept:accept});if(error)setError(error.message);else await load();setBusy(false)};
 const cancel=async(id:string)=>{setBusy(true);setError('');const {error}=await supabase.rpc('cancel_friend_request',{p_request_id:id});if(error)setError(error.message);else await load();setBusy(false)};
 const sendTyping=(active:boolean)=>{
  if(typingStop.current)window.clearTimeout(typingStop.current);
  if(!active){
   if(typingHeartbeat.current)window.clearInterval(typingHeartbeat.current);
   typingHeartbeat.current=undefined;typingActive.current=false;typingStop.current=undefined;
   if(selected)void chatChannel.current?.send({type:'broadcast',event:'typing',payload:{userId,active:false}});
   return;
  }
  if(!selected)return;
  const send=()=>void chatChannel.current?.send({type:'broadcast',event:'typing',payload:{userId,active:true}});
  if(!typingActive.current){typingActive.current=true;send();typingHeartbeat.current=window.setInterval(send,1000)}
  typingStop.current=window.setTimeout(()=>sendTyping(false),1500);
 };
 const sendRecording=(active:boolean)=>{
  if(recordingHeartbeat.current)window.clearInterval(recordingHeartbeat.current);
  recordingHeartbeat.current=undefined;
  if(!selected)return;
  const send=()=>void chatChannel.current?.send({type:'broadcast',event:'recording',payload:{userId,active}});
  send();
  if(active)recordingHeartbeat.current=window.setInterval(send,1500);
 };
 const send=async()=>{const body=draft.trim();if(!body||!selected||busy)return;if(body.length>500){setError('Messages must be 500 characters or fewer.');return}const recipient=selected.user_id;if(!navigator.onLine){onQueueText('friend',recipient,body,replyTo?.kind==='text'?replyTo.id:null);setDraft('');setReplyTo(null);setError('Message added to Reconnect Queue. It will retry when you are online.');return}const tempId=`pending-${crypto.randomUUID()}`;const optimistic:ChatItem={id:tempId,sender_id:userId,recipient_id:recipient,body,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+24*60*60*1000).toISOString(),kind:'text',reply_to:replyTo?.kind==='text'?replyTo.id:null,sending:true};setBusy(true);setError('');setMessages(v=>[...v,optimistic]);sendTyping(false);setDraft('');setReplyTo(null);const {data,error}=await supabase.from('friend_messages').insert({sender_id:userId,recipient_id:recipient,body,reply_to:optimistic.reply_to}).select('*').single();if(error){setMessages(v=>v.filter(m=>m.id!==tempId));setDraft(v=>v||body);setError(error.message)}else if(data){setMessages(v=>v.some(m=>m.id===data.id)?v.filter(m=>m.id!==tempId):v.map(m=>m.id===tempId?{...data,kind:'text'}:m))}setBusy(false)};
 const editMessage=async(m:ChatItem,body:string)=>{const age=Date.now()-new Date(m.created_at).getTime();if(m.kind!=='text'||m.sender_id!==userId||m.sending||age<0||age>=5*60*1000||(m.expires_at&&new Date(m.expires_at).getTime()<=Date.now())){setError('This message is outside the 5-minute edit window.');return false}const {data,error}=await supabase.rpc('edit_friend_message',{p_message_id:m.id,p_body:body});if(error){setError(error.message||'Could not edit this message.');return false}if(!data){setError('Could not edit this message.');return false}setMessages(prev=>prev.map(item=>item.id===m.id?{...item,...data}:item));setError('');return true};
 const startRecord=async()=>{if(recording||recordingFinishing||busy||!selected)return;try{if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Voice recording is not supported in this browser.');const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});stream.current=s;setRecordingStream(s);setRecorded(null);setRecordingFinishing(false);const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x))||'';const r=new MediaRecorder(s,mime?{mimeType:mime,audioBitsPerSecond:24000}:undefined);recorder.current=r;chunks.current=[];recordStarted.current=Date.now();r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=()=>{sendRecording(false);recorder.current=null;s.getTracks().forEach(t=>t.stop());stream.current=null;setRecordingStream(null);setRecordingFinishing(false);const blob=new Blob(chunks.current,{type:r.mimeType||'audio/webm'});chunks.current=[];const elapsed=Math.min(60000,Date.now()-recordStarted.current);if(elapsed<500){setError('Voice message is too short.');setRecorded(null)}else if(blob.size>358400){setError('Voice message is too large. Record a shorter message.');setRecorded(null)}else if(blob.size>0){setRecorded(blob);setRecordedDuration(elapsed)}else setError('Recording was empty.')};r.start(250);setError('');setRecording(true);sendRecording(true);setSeconds(0);timer.current=window.setInterval(()=>setSeconds(v=>{if(v>=59){stopRecord();return 60}return v+1}),1000)}catch(e:any){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setRecordingStream(null);setRecording(false);setRecordingFinishing(false);setError(e?.message||'Could not access microphone.')}};
 const stopRecord=()=>{sendRecording(false);if(timer.current)window.clearInterval(timer.current);timer.current=undefined;const active=recorder.current;if(active?.state==='recording'){setRecording(false);setRecordingFinishing(true);active.stop()}else setRecording(false)};
 const cancelRecord=()=>{sendRecording(false);if(timer.current)window.clearInterval(timer.current);timer.current=undefined;const active=recorder.current;recorder.current=null;if(active){active.onstop=null;if(active.state!=='inactive')active.stop()}stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;chunks.current=[];setRecordingStream(null);setRecording(false);setRecordingFinishing(false);setSeconds(0);setRecorded(null);setRecordedDuration(0)};
 const sendVoice=async()=>{if(!selected||!recorded||busy)return;const blob=recorded,recipient=selected.user_id,reply=replyTo,path=`${userId}/${crypto.randomUUID()}.${blob.type.includes('mp4')?'m4a':'webm'}`,tempId=`pending-${crypto.randomUUID()}`,duration=Math.max(500,Math.min(60000,recordedDuration));const optimistic:ChatItem={id:tempId,sender_id:userId,recipient_id:recipient,storage_path:path,duration_ms:duration,file_size:blob.size,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+24*60*60*1000).toISOString(),kind:'voice',reply_to:reply?.kind==='voice'?reply.id:null,sending:true};setBusy(true);setError('');setMessages(v=>[...v,optimistic]);try{const up=await supabase.storage.from('friend-voice-messages').upload(path,blob,{contentType:blob.type.split(';')[0]||'audio/webm',upsert:false,cacheControl:'0'});if(up.error)throw up.error;const {data,error}=await supabase.from('friend_voice_messages').insert({sender_id:userId,recipient_id:recipient,storage_path:path,duration_ms:duration,file_size:blob.size,reply_to:reply?.kind==='voice'?reply.id:null}).select('*').single();if(error){await supabase.storage.from('friend-voice-messages').remove([path]);throw error}if(data){const sent={...data,kind:'voice' as const};setMessages(v=>v.some(m=>m.id===data.id)?v.filter(m=>m.id!==tempId):v.map(m=>m.id===tempId?sent:m));void warmVoiceUrl(path,data.expires_at)}setRecorded(null);setSeconds(0);setRecordedDuration(0);setReplyTo(null)}catch(e:any){setMessages(v=>v.filter(m=>m.id!==tempId));setError(e?.message||'Could not send voice message.')}finally{setBusy(false)}};
 const playVoice=async(m:ChatItem)=>{try{if(m.sending||!m.storage_path)return;if(playing===m.id){audio.current?.pause();setPlaying(null);return}audio.current?.pause();const url=await warmVoiceUrl(m.storage_path,m.expires_at);if(!url)throw new Error('Audio unavailable');const a=new Audio(url);a.preload='auto';audio.current=a;a.onended=()=>setPlaying(null);setPlaying(m.id);await a.play()}catch(e:any){setPlaying(null);setError(e?.message||'Could not play voice message.')}};
 const hideMessage=async(m:ChatItem)=>{const {error}=await supabase.from('friend_message_hidden').upsert({user_id:userId,message_id:m.id,message_kind:m.kind},{onConflict:'user_id,message_id,message_kind'});if(error)setError(error.message);else setMessages(v=>v.filter(x=>x.id!==m.id||x.kind!==m.kind))};
 const deleteEveryone=(m:ChatItem)=>{if(m.sender_id!==userId)return;setConfirmation({title:'Delete this message for everyone?',message:'This will remove the message for both you and your friend. This action cannot be undone.',confirmLabel:'Delete message',onConfirm:async()=>{const table=m.kind==='text'?'friend_messages':'friend_voice_messages';const {error}=await supabase.from(table).delete().eq('id',m.id).eq('sender_id',userId);if(error)setError(error.message);else {if(m.kind==='voice'&&m.storage_path)await supabase.storage.from('friend-voice-messages').remove([m.storage_path]);setMessages(v=>v.filter(x=>x.id!==m.id||x.kind!==m.kind))}}})};
 const react=(m:ChatItem)=>setReactionTarget(m);
 const saveReaction=async(target:ChatItem,emoji:string)=>{const alreadyMine=friendReactions[`${target.kind}:${target.id}`]?.[emoji]?.mine;const result=alreadyMine?await supabase.from('friend_message_reactions').delete().eq('message_id',target.id).eq('message_kind',target.kind).eq('user_id',userId).eq('reaction',emoji):await supabase.from('friend_message_reactions').upsert({message_id:target.id,message_kind:target.kind,user_id:userId,reaction:emoji},{onConflict:'message_id,message_kind,user_id'});if(result.error){setError(result.error.message);return false}await loadReactions();return true};
 const applyReaction=async(emoji:string)=>{if(!reactionTarget)return;if(await saveReaction(reactionTarget,emoji))setReactionTarget(null)};
 const clearChat=()=>{if(!selected)return;setConfirmation({title:'Clear this chat?',message:'This removes messages from your view only. Your friend will keep their copy.',confirmLabel:'Clear chat',onConfirm:async()=>{const rows=messages.map(m=>({user_id:userId,message_id:m.id,message_kind:m.kind}));if(rows.length){const {error}=await supabase.from('friend_message_hidden').upsert(rows,{onConflict:'user_id,message_id,message_kind'});if(error){setError(error.message);return}}setMessages([]);setChatSearch('')}})};
 const unblock=async(p:Person)=>{setBusy(true);const {error}=await supabase.rpc('unblock_friend',{p_user_id:p.user_id});if(error)setError(error.message);else await load();setBusy(false)};
 const togglePin=(p:Person)=>{const next=pinnedIds.includes(p.user_id)?pinnedIds.filter(id=>id!==p.user_id):[...pinnedIds,p.user_id];setPinnedIds(next);try{localStorage.setItem(pinnedKey(userId),JSON.stringify(next))}catch{setError('Could not save pinned friends on this device.')}setOpenFriendMenu(null)};
 const toggleBlock=async(p:Person)=>{if(blockedIds.includes(p.user_id)){await unblock(p);setOpenFriendMenu(null);return}setOpenFriendMenu(null);setConfirmation({title:`Block ${p.name}?`,message:'You can unblock this person later from your friends list.',confirmLabel:'Block friend',onConfirm:async()=>{setBusy(true);const {error}=await supabase.rpc('block_friend',{p_user_id:p.user_id});if(error)setError(error.message);else {if(selected?.user_id===p.user_id)setSelected(null);await load()}setBusy(false)}})};
 const deleteFriend=async(p:Person)=>{setOpenFriendMenu(null);setConfirmation({title:`Remove ${p.name} from friends?`,message:'Your existing messages with this person will not be deleted.',confirmLabel:'Remove friend',onConfirm:async()=>{const {error}=await supabase.rpc('delete_friend',{p_user_id:p.user_id});if(error)setError(error.message);else {if(selected?.user_id===p.user_id)setSelected(null);await load()}}})};
 const filtered=(tab==='friends'?friends:people).filter(p=>p.name.toLowerCase().includes(query.toLowerCase())&&!(tab==='find'&&friends.some(f=>f.user_id===p.user_id))).sort((a,b)=>Number(pinnedIds.includes(b.user_id))-Number(pinnedIds.includes(a.user_id)));
 const filteredMessages=messages.filter(m=>matchesMessageSearch(m,m.kind,chatSearch,chatFilters));
 return <div className="friends-overlay" role="dialog" aria-modal="true" aria-label="Friends"><section className={`friends-panel ${selected?'friends-panel-chat':'friends-panel-list'}`}>
 <header><div className="friends-heading"><Users/><div><b>Friends</b><small>Connect with people around the world</small></div></div><button className="friends-close" onClick={onClose} aria-label="Close"><X/></button></header>
 <FriendsCallCenter userId={userId} name={profile.name} avatarId={profile.avatarId||1} friend={selected} sound={sound} blocked={!!selected&&blockedIds.includes(selected.user_id)} onBack={()=>setSelected(null)} headerActions={<div className="friend-chat-tools-menu-wrap" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setChatToolsOpen(false)}} onKeyDown={e=>{if(e.key==='Escape')setChatToolsOpen(false)}}><button type="button" className="friend-chat-tools-menu-trigger" aria-label="Chat options" title="Chat options" aria-controls="friend-chat-tools-menu" aria-expanded={chatToolsOpen} onClick={()=>setChatToolsOpen(v=>!v)}><MoreVertical size={18}/></button>{chatToolsOpen&&<div className="friend-chat-tools-menu" id="friend-chat-tools-menu" role="menu"><button type="button" role="menuitem" onClick={()=>{setChatToolsOpen(false);setChatSearchOpen(true)}}><Search size={15}/> Search messages</button><button type="button" role="menuitem" onClick={()=>{setChatToolsOpen(false);setPollError('');setPollComposerOpen(true)}}><Plus size={15}/> Create a poll</button><button type="button" role="menuitem" className="destructive" onClick={()=>{setChatToolsOpen(false);void clearChat()}}><Trash2 size={15}/> Clear chat</button></div>}</div>}/>

 {selected?<><div className="friend-chat-head"><img src={avatar(selected.avatar_id||1)} alt=""/><div className="friend-chat-identity"><b>{selected.name}</b><small>{locationOf(selected)}</small><small className={onlineIds.includes(selected.user_id)?'friend-online':'friend-offline'}>{onlineIds.includes(selected.user_id)?'Online':'Offline'}</small></div></div>{chatSearchOpen&&<div className="friend-chat-tools"><label><Search size={15}/><input autoFocus value={chatSearch} onChange={e=>setChatSearch(e.target.value)} placeholder="Search messages"/></label><button type="button" className="friend-close-search-btn" onClick={()=>{setChatSearchOpen(false);setChatSearch('')}} title="Close search" aria-label="Close search"><X size={16}/></button></div>}{chatSearchOpen&&<MessageSearchFilters query={chatSearch} onQueryChange={setChatSearch} filters={chatFilters} onFiltersChange={setChatFilters} messages={messages} showQuery={false}/>}<div className="friend-chat-messages" ref={listRef} onScroll={e=>{const el=e.currentTarget;stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<140}}>{pollError&&<small className="feature-modal-error poll-inline-error" role="alert">{pollError}</small>}{polls.map(poll=><PollCard key={poll.id} poll={poll} userId={userId} busy={votingPollId===poll.id} onVote={index=>void voteFriendPoll(poll.id,index)}/>)}{chatLoading&&messages.length===0?<div className="friend-chat-loading" role="status" aria-label="Loading messages">{Array.from({length:3},(_,i)=><div className="friend-loading-row" key={i}><i/><span><b/><small/></span></div>)}</div>:filteredMessages.map(m=><article key={`${m.kind}-${m.id}`} className={`friend-message-row ${m.sender_id===userId?'mine':''}`}><img className="friend-message-avatar" src={m.sender_id===userId?avatar(profile.avatarId||1):avatar(selected.avatar_id||1)} alt=""/><div className="friend-message-content"><div className="friend-message-name">{m.sender_id===userId?'You':selected.name}</div><div className="friend-bubble">{m.reply_to&&<small className="friend-reply-quote">↪ Reply to message</small>}{m.kind==='text'?(editingMessageId===m.id?<InlineMessageEditor value={m.body||''} onSave={body=>editMessage(m,body)} onCancel={()=>setEditingMessageId(null)}/>:<p><SafeMessageText text={m.body||''} renderText={value=>renderMentionText(value)}/></p>):<button className="friend-voice-play" disabled={m.sending} onClick={()=>void playVoice(m)}>{playing===m.id?<Pause size={17}/>:<Play size={17}/>} {m.sending?'Sending voice…':<>Voice message · {fmt((m.duration_ms||0)/1000)}</>}</button>}<small className="friend-message-time">{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}{m.sender_id===userId?(m.sending?' · Sending':' · Sent'):''}{m.edited_at?' · Edited':''}</small></div>{Object.entries(friendReactions[`${m.kind}:${m.id}`]||{}).length>0&&<div className="friend-reaction-summary" aria-label="Message reactions">{Object.entries(friendReactions[`${m.kind}:${m.id}`]||{}).map(([emoji,reaction])=><button type="button" key={emoji} className={reaction.mine?'active':''} aria-pressed={reaction.mine} aria-label={`${emoji}, ${reaction.count} reactions`} onClick={()=>void saveReaction(m,emoji)}><span>{emoji}</span><small>{reaction.count}</small></button>)}</div>}<div className="friend-message-actions"><button type="button" onClick={()=>setReplyTo(m)}><span>↶</span> Reply</button><button type="button" onClick={()=>void react(m)}>React</button><div className="friend-message-menu-wrap" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpenMessageMenu(null)}} onKeyDown={e=>{if(e.key==="Escape")setOpenMessageMenu(null)}}><button type="button" className="friend-message-menu-trigger" aria-label="More message actions" title="More message actions" aria-controls={`message-actions-${m.kind}-${m.id}`} aria-expanded={openMessageMenu===`${m.kind}:${m.id}`} onClick={()=>setOpenMessageMenu(v=>v===`${m.kind}:${m.id}`?null:`${m.kind}:${m.id}`)}><MoreVertical size={16}/></button>{openMessageMenu===`${m.kind}:${m.id}`&&<div className="friend-message-menu" id={`message-actions-${m.kind}-${m.id}`} role="group" aria-label="More message actions"><button type="button" onClick={()=>{setOpenMessageMenu(null);if(m.body)void navigator.clipboard?.writeText(m.body)}}>Copy</button>{m.kind==='text'&&<button type="button" onClick={()=>{setOpenMessageMenu(null);void onSaveMessage('friend',m.id)}}>Save privately</button>}<button type="button" className="destructive" onClick={()=>{setOpenMessageMenu(null);void hideMessage(m)}}>Delete for Me</button>{m.sender_id===userId&&m.kind==='text'&&!m.sending&&Date.now()-new Date(m.created_at).getTime()<5*60*1000&&(!m.expires_at||new Date(m.expires_at).getTime()>Date.now())&&<button type="button" onClick={()=>{setOpenMessageMenu(null);setEditingMessageId(m.id)}}>Edit message</button>}{m.sender_id===userId&&<button type="button" className="destructive" onClick={()=>{setOpenMessageMenu(null);void deleteEveryone(m)}}>Delete for Everyone</button>}</div>}</div></div></div></article>)}</div>{friendRecording&&<small className="friend-recording-label">{selected.name} is recording…</small>}{friendTyping&&<small className="friend-recording-label">{selected.name} is typing…</small>}{recording||recorded||recordingFinishing?<div className={`friend-voice-composer ${recording?'is-recording':recordingFinishing?'is-preparing':'is-ready'}`}><div className="friend-voice-status" aria-live="polite"><i className="friend-voice-dot"/><span>{recording?'Recording':recordingFinishing?'Preparing voice':'Voice ready'}</span><strong>{fmt(recording?seconds:recordedDuration/1000)}</strong></div>{recording&&<FriendLiveRecordingWaveform stream={recordingStream}/>}<div className="friend-voice-actions"><button type="button" className="friend-voice-cancel" onClick={cancelRecord} disabled={busy} aria-label="Cancel recording" title="Cancel recording"><X size={17}/></button><button type="button" className="friend-voice-primary" onClick={recording?stopRecord:()=>void sendVoice()} disabled={busy||recordingFinishing} aria-label={recording?'Stop recording':recordingFinishing?'Preparing voice message':busy?'Sending voice message':'Send voice message'} title={recording?'Stop recording':'Send voice message'}>{recording?<><Square size={15} fill="currentColor"/><span>Stop</span></>:recordingFinishing?<span>Preparing…</span>:<><Send size={17}/><span>{busy?'Sending…':'Send voice'}</span></>}</button></div></div>:<form className="friend-compose" onSubmit={e=>{e.preventDefault();void send()}}><div className="friend-emoji-tools"><button type="button" className="friend-emoji-btn" onClick={()=>setFriendEmojiOpen(v=>!v)} aria-label="Choose emoji" title="Choose emoji" aria-expanded={friendEmojiOpen}><Smile size={18}/></button>{friendEmojiOpen&&<EmojiPicker className="friend-emoji-picker" onSelect={emoji=>{setDraft(v=>v+emoji);sendTyping(true);setFriendEmojiOpen(false)}}/>}</div><input value={draft} maxLength={500} onChange={e=>{setDraft(e.target.value);sendTyping(!!e.target.value)}} placeholder="Write a message… Use @name to mention" aria-label="Message"/><button type="button" className="friend-mic-btn friend-schedule-btn" disabled={busy||!draft.trim()} onClick={()=>selected&&onScheduleText(selected.user_id,draft,()=>setDraft(''))} aria-label="Schedule message" title="Schedule message"><Clock3 size={17}/></button><button type="button" className="friend-mic-btn" disabled={busy} onClick={()=>void startRecord()} aria-label="Record voice" title="Record voice"><Mic size={17}/></button><button type="submit" className="friend-send-btn" disabled={busy||!draft.trim()} aria-label="Send message" title="Send message"><Send size={17}/></button></form>}{replyTo&&<div className="friend-reply-preview">Replying to {replyTo.kind==='text'?(replyTo.body||'message'):'voice message'}<button type="button" onClick={()=>setReplyTo(null)}><X size={15}/></button></div>}</>:<>
 <nav className="friends-tabs"><button className={tab==='friends'?'active':''} onClick={()=>setTab('friends')}>Friends ({friends.length})</button><button className={tab==='requests'?'active':''} onClick={()=>setTab('requests')}>Requests {incoming.length>0&&<i>{incoming.length}</i>}</button><button className={tab==='find'?'active':''} onClick={()=>setTab('find')}>Find people</button></nav>
 {tab!=='requests'&&<label className="friends-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={tab==='find'?'Search people':'Search friends'}/></label>}
 <div className="friends-list" aria-busy={loading||(tab==='find'&&peopleLoading)}>{loading||(tab==='find'&&peopleLoading)?<div className="friends-loading" role="status" aria-label="Loading friends">{Array.from({length:3},(_,i)=><div className="friend-loading-row" key={i}><i/><span><b/><small/></span></div>)}</div>:tab==='requests'?<>{incoming.length?incoming.map(r=><div className="friend-row" key={r.id}><div className="friend-avatar"><Users/></div><div className="friend-details"><b>{mapRequestName(r.sender_id,incoming,people,friends)}</b><small>Wants to be your friend</small></div><div className="friend-request-actions"><button className="friend-action" disabled={busy} onClick={()=>void respond(r.id,true)}><Check size={16}/> Accept</button><button className="friend-action friend-reject" disabled={busy} onClick={()=>void respond(r.id,false)}>Reject</button></div></div>):<p className="friends-empty">No incoming requests.</p>}{outgoing.length>0&&<><div className="friends-section-label">SENT REQUESTS</div>{outgoing.map(r=><div className="friend-row" key={r.id}><div className="friend-avatar"><UserPlus/></div><div className="friend-details"><b>{mapRequestName(r.recipient_id,outgoing,people,friends)}</b><small>Request pending</small></div><button className="friend-action friend-reject" disabled={busy} onClick={()=>void cancel(r.id)}>Cancel request</button></div>)}</>}</>:filtered.length?filtered.map(p=><div className={`friend-row ${openFriendMenu===p.user_id?'friend-menu-open':''}`} key={p.user_id}><img className="friend-avatar" src={avatar(p.avatar_id||1)} alt=""/><div className="friend-details"><b>{p.name}{tab==='friends'&&pinnedIds.includes(p.user_id)?<Pin size={12} className="friend-pinned-indicator" aria-label="Pinned"/>:null}</b><small className="friend-location">{locationOf(p)}</small><small><i className={onlineIds.includes(p.user_id)?'friend-status-dot online':'friend-status-dot'}/>{blockedIds.includes(p.user_id)?'Blocked':onlineIds.includes(p.user_id)?'Online':p.last_seen?`Last seen ${new Date(p.last_seen).toLocaleString()}`:'Offline'}{tab==='friends'&&unread[p.user_id]>0?` · ${unread[p.user_id]} unread`:''}</small></div>{tab==='friends'?<><button className="friend-action" disabled={busy||blockedIds.includes(p.user_id)} onClick={()=>{setSelected(p);void markRead(p.user_id)}}><MessageCircle size={16}/> Message</button><div className="friend-options-wrap"><button type="button" className="friend-action friend-options-trigger" title="Friend options" aria-label={`Options for ${p.name}`} aria-expanded={openFriendMenu===p.user_id} onClick={()=>setOpenFriendMenu(v=>v===p.user_id?null:p.user_id)}><MoreVertical size={18}/></button>{openFriendMenu===p.user_id&&<div className="friend-options-menu" role="menu"><button type="button" disabled={busy} onClick={()=>toggleBlock(p)}>{blockedIds.includes(p.user_id)?<UserPlus size={16}/>:<Ban size={16}/>} {blockedIds.includes(p.user_id)?'Unblock':'Block'}</button><button type="button" onClick={()=>togglePin(p)}>{pinnedIds.includes(p.user_id)?<PinOff size={16}/>:<Pin size={16}/>} {pinnedIds.includes(p.user_id)?'Unpin':'Pin'}</button><button type="button" disabled={busy} onClick={()=>{setOpenFriendMenu(null);void deleteFriend(p)}}><Trash2 size={16}/> Delete Friend</button></div>}</div></>:<button className="friend-action" disabled={busy||outgoing.some(r=>r.recipient_id===p.user_id)} onClick={()=>void sendRequest(p.user_id)}><UserPlus size={16}/>{outgoing.some(r=>r.recipient_id===p.user_id)?'Requested':'Add friend'}</button>}</div>):<p className="friends-empty">{tab==='find'?(query?'No people match this name.':'No people found yet. People appear here after a recent Public Chat post or profile is available.'):query?'No friends match this name.':'No friends yet.'}</p>}</div></>}
 {error&&<p className="friends-error" role="alert">{error}</p>}
 </section>
 {pollComposerOpen&&selected&&<PollComposer onClose={()=>{setPollComposerOpen(false);setPollError('')}} onCreate={(question,options)=>void createFriendPoll(question,options)} busy={pollBusy} error={pollError}/>}
 {confirmation&&<ActionDialog title={confirmation.title} message={confirmation.message} confirmLabel={confirmation.confirmLabel} onConfirm={async()=>{await confirmation.onConfirm();setConfirmation(null)}} onCancel={()=>setConfirmation(null)} onError={error=>setError(error instanceof Error?error.message:'Could not complete this action.')}/>}
 {reactionTarget&&<div className="friend-reaction-dialog-backdrop" onClick={event=>{if(event.target===event.currentTarget)setReactionTarget(null)}}><section className="friend-reaction-dialog" role="dialog" aria-modal="true" aria-labelledby="friend-reaction-title" onKeyDown={event=>{if(event.key==='Escape')setReactionTarget(null)}}><div className="friend-reaction-dialog-head"><div><span><Smile size={18}/></span><div><h2 id="friend-reaction-title">React to message</h2><p>Choose an emoji reaction</p></div></div><button type="button" onClick={()=>setReactionTarget(null)} aria-label="Close reactions"><X size={18}/></button></div><div className="friend-reaction-choices">{FRIEND_REACTIONS.map((emoji,index)=><button type="button" key={emoji} autoFocus={index===0} onClick={()=>void applyReaction(emoji)} aria-label={`React with ${emoji}`}>{emoji}</button>)}</div></section></div>}
 </div>
}

function FriendLiveRecordingWaveform({stream}:{stream:MediaStream|null}){
 const [levels,setLevels]=useState<number[]>(()=>Array.from({length:42},(_,i)=>.16+((i*7)%11)/24));
 useEffect(()=>{
  if(!stream){setLevels([]);return}
  const AudioContextConstructor=(window.AudioContext||(window as any).webkitAudioContext) as typeof AudioContext|undefined;
  if(!AudioContextConstructor)return;
  let context:AudioContext|undefined,source:MediaStreamAudioSourceNode|undefined,analyser:AnalyserNode|undefined,frame=0,lastUpdate=0;
  try{
   context=new AudioContextConstructor();source=context.createMediaStreamSource(stream);analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.74;source.connect(analyser);
   const samples=new Uint8Array(analyser.fftSize);
   const draw=(now:number)=>{if(!analyser)return;if(now-lastUpdate<40){frame=requestAnimationFrame(draw);return}lastUpdate=now;analyser.getByteTimeDomainData(samples);setLevels(Array.from({length:42},(_,i)=>{const start=Math.floor(i*samples.length/42),end=Math.max(start+1,Math.floor((i+1)*samples.length/42));let sum=0;for(let j=start;j<end;j++)sum+=Math.abs(samples[j]-128)/128;return Math.max(.12,Math.min(1,.16+(sum/(end-start))*2.8))}));frame=requestAnimationFrame(draw)};
   void context.resume().catch(()=>{});frame=requestAnimationFrame(draw);
  }catch{}
  return()=>{cancelAnimationFrame(frame);try{source?.disconnect()}catch{}void context?.close().catch(()=>{})};
 },[stream]);
 if(!stream)return null;
 return <div className="friend-live-wave is-live" role="img" aria-label="Live recording waveform">{levels.map((level,i)=><i key={i} style={{height:`${Math.round(6+level*27)}px`}}/>)}</div>;
}
