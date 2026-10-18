import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Mic, MicOff, Phone, PhoneCall, PhoneOff, Volume2, VolumeX, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AVATARS } from './data/catalog';
import { claimVoiceCall, flushCallIceCandidates, ownsVoiceCall, queueCallIceCandidate, releaseVoiceCall, requestVoiceCallStream, startIncomingCallRingtone, stopIncomingCallRingtone, type PendingCallIce } from './callAudio';

type Friend = { user_id:string; name:string; avatar_id?:number };
type Call = { id:string; callerId:string; callerName:string; callerAvatar:number; recipientId:string; recipientName:string; recipientAvatar:number };
type Props = { userId:string; name:string; avatarId:number; friend:Friend|null; sound:boolean; blocked:boolean; onBack:()=>void; headerActions?:ReactNode };
const ICE:RTCConfiguration={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const avatar=(id:number)=>AVATARS.find(x=>x.id===id)?.src||AVATARS[0].src;
const publishInbox=async(to:string,event:string,payload:any)=>{const ch=supabase.channel(`friend-call-inbox-${to}`);try{await new Promise<void>((resolve,reject)=>{const timeout=window.setTimeout(()=>reject(new Error('Call signaling timed out. Check your connection and retry.')),12000);ch.subscribe((s:string)=>{if(s==='SUBSCRIBED'){window.clearTimeout(timeout);resolve()}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'||s==='CLOSED'){window.clearTimeout(timeout);reject(new Error('Call signaling connection failed.'))}})});await ch.send({type:'broadcast',event,payload})}finally{await supabase.removeChannel(ch)}};

export default function FriendsCallCenter({userId,name,avatarId,friend,sound,blocked,onBack,headerActions}:Props){
 const [incoming,setIncoming]=useState<Call|null>(null),[active,setActive]=useState<Call|null>(null),[status,setStatus]=useState<'calling'|'connecting'|'connected'>('calling'),[muted,setMuted]=useState(false),[speakerMuted,setSpeakerMuted]=useState(false),[speakerVolume,setSpeakerVolume]=useState(.42),[remote,setRemote]=useState<MediaStream|null>(null),[error,setError]=useState('');
 const inbox=useRef<any>(null),room=useRef<any>(null),stream=useRef<MediaStream|null>(null),micRequest=useRef<Promise<MediaStream>|null>(null),peer=useRef<RTCPeerConnection|null>(null),peerRequest=useRef<Promise<RTCPeerConnection>|null>(null),pendingIce=useRef<PendingCallIce>(new Map()),offerPending=useRef(false),callRef=useRef<Call|null>(null),incomingRef=useRef<Call|null>(null),mounted=useRef(true),callOwner=useRef(Symbol('friends-voice-call')),callStarting=useRef(false),ringtoneOwner=useRef(Symbol('friends-call-ringtone'));
 useEffect(()=>{incomingRef.current=incoming},[incoming]);
 useEffect(()=>{if(incoming&&sound)startIncomingCallRingtone(ringtoneOwner.current,true);else stopIncomingCallRingtone(ringtoneOwner.current);return()=>stopIncomingCallRingtone(ringtoneOwner.current)},[incoming?.id,sound]);
 const cleanup=useCallback(async()=>{releaseVoiceCall(callOwner.current);try{peer.current?.close()}catch{}peer.current=null;peerRequest.current=null;pendingIce.current.clear();offerPending.current=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;micRequest.current=null;setRemote(null);if(room.current){await supabase.removeChannel(room.current);room.current=null}callRef.current=null;incomingRef.current=null;if(mounted.current){setActive(null);setIncoming(null);setMuted(false);setSpeakerMuted(false)}},[]);
 const mic=useCallback(async()=>{if(stream.current?.getAudioTracks().some(track=>track.readyState==='live'))return stream.current;if(micRequest.current)return micRequest.current;const owner=callOwner.current;const request=requestVoiceCallStream().then(value=>{if(!ownsVoiceCall(owner)){value.getTracks().forEach(track=>track.stop());throw new Error('Call was cancelled before the microphone was ready.')}stream.current=value;const settings=value.getAudioTracks()[0]?.getSettings();if(settings?.echoCancellation!==true||settings?.noiseSuppression===false||settings?.autoGainControl===true)setError('Echo reduction may be limited by this browser. Lower the call speaker volume or use headphones to prevent feedback.');return value}).finally(()=>{if(micRequest.current===request)micRequest.current=null});micRequest.current=request;return request},[]);
 const send=(event:string,payload:any)=>{if(room.current)void room.current.send({type:'broadcast',event,payload})};
 const setupRoom=useCallback(async(call:Call)=>{
  const ch=supabase.channel(`friend-call-${call.id}`,{config:{presence:{key:userId},broadcast:{self:false,ack:true}}});room.current=ch;
  const ensure=async()=>{
   if(peer.current&&peer.current.connectionState!=='closed')return peer.current;
   if(peerRequest.current)return peerRequest.current;
   const request=(async()=>{
    const local=await mic();
    const track=local.getAudioTracks().find(value=>value.readyState==='live');
    if(!track)throw new Error('The microphone track ended. Please retry the call.');
    if(!ownsVoiceCall(callOwner.current))throw new Error('The call ended before the connection was ready.');
    const pc=new RTCPeerConnection(ICE);
    if(!pc.getSenders().some(sender=>sender.track?.id===track.id))pc.addTrack(track,local);
    peer.current=pc;
    pc.ontrack=e=>{if(e.track.kind!=='audio')return;const incomingStream=e.streams[0]||new MediaStream([e.track]);setRemote(previous=>previous===incomingStream?previous:incomingStream)};
    pc.onicecandidate=e=>{if(e.candidate)send('ice',{from:userId,to:userId===call.callerId?call.recipientId:call.callerId,candidate:e.candidate})};
    pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')setStatus('connected');if(pc.connectionState==='failed')setError('Call connection failed. Check the network, then retry.')};
    return pc;
   })();
   peerRequest.current=request;
   try{return await request}finally{if(peerRequest.current===request)peerRequest.current=null}
  };
  const offerPeer=async(id:string)=>{
   if(userId>=id||offerPending.current)return;
   offerPending.current=true;
   try{const pc=await ensure();if(pc.signalingState!=='stable')return;const offer=await pc.createOffer();await pc.setLocalDescription(offer);send('offer',{from:userId,to:id,description:pc.localDescription||offer})}
   catch(e:any){setError(e?.message||'Could not start call.')}
   finally{offerPending.current=false}
  };
  ch.on('presence',{event:'sync'},()=>{const ids=Object.keys(ch.presenceState()).filter(x=>x!==userId);for(const id of ids)void offerPeer(id)});
  ch.on('presence',{event:'join'},({key}:any)=>{if(key&&key!==userId)void offerPeer(key)});
  ch.on('broadcast' as any,{event:'offer'},async({payload}:any)=>{if(payload?.to!==userId||!payload?.description||!payload?.from)return;try{const pc=await ensure();await pc.setRemoteDescription(payload.description);await flushCallIceCandidates(pendingIce.current,payload.from,pc);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);send('answer',{from:userId,to:payload.from,description:pc.localDescription||answer})}catch(e:any){setError(e?.message||'Could not answer call.')}});
  ch.on('broadcast' as any,{event:'answer'},async({payload}:any)=>{if(payload?.to!==userId||!payload?.description||!peer.current)return;try{await peer.current.setRemoteDescription(payload.description);await flushCallIceCandidates(pendingIce.current,payload.from,peer.current)}catch(e:any){setError(e?.message||'Could not connect call.')}});
  ch.on('broadcast' as any,{event:'ice'},async({payload}:any)=>{if(payload?.to!==userId||!payload?.candidate||!payload?.from)return;const current=peer.current;if(!current||!current.remoteDescription){queueCallIceCandidate(pendingIce.current,payload.from,payload.candidate);return}try{await current.addIceCandidate(payload.candidate)}catch{}});
  ch.on('broadcast' as any,{event:'end'},async({payload}:any)=>{if(payload?.from!==userId)await cleanup()});
  await new Promise<void>((resolve,reject)=>{const timeout=window.setTimeout(()=>reject(new Error('Call signaling timed out. Check your connection and retry.')),15000);ch.subscribe((s:string)=>{if(s==='SUBSCRIBED'){window.clearTimeout(timeout);resolve()}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'||s==='CLOSED'){window.clearTimeout(timeout);reject(new Error('Call signaling connection failed.'))}})});
  await ch.track({userId,name,joinedAt:new Date().toISOString()});
 },[cleanup,mic,name,userId]);
 useEffect(()=>{mounted.current=true;const ch=supabase.channel(`friend-call-inbox-${userId}`,{config:{broadcast:{self:false,ack:true}}});inbox.current=ch;
  ch.on('broadcast' as any,{event:'invite'},({payload}:any)=>{if(!payload?.call||payload.call.recipientId!==userId)return;if(callRef.current||incomingRef.current){void publishInbox(payload.call.callerId,'busy',{callId:payload.call.id,from:userId});return}setError('');incomingRef.current=payload.call;setIncoming(payload.call)});
  ch.on('broadcast' as any,{event:'accepted'},({payload}:any)=>{if(callRef.current?.id===payload?.callId)setStatus('connecting')});
  ch.on('broadcast' as any,{event:'declined'},({payload}:any)=>{if(callRef.current?.id===payload?.callId){setError('Your friend declined the call.');void cleanup()}});
  ch.on('broadcast' as any,{event:'busy'},({payload}:any)=>{if(callRef.current?.id===payload?.callId){setError('Your friend is already on another call.');void cleanup()}});
  ch.on('broadcast' as any,{event:'cancel'},({payload}:any)=>{if(incomingRef.current?.id===payload?.callId){incomingRef.current=null;setIncoming(null)}});
  ch.subscribe();return()=>{mounted.current=false;void supabase.removeChannel(ch);inbox.current=null;void cleanup()};
 },[userId,cleanup]);
 useEffect(()=>()=>{void cleanup()},[cleanup]);
 const start=async()=>{if(!friend||blocked||active||callStarting.current)return;setError('');callStarting.current=true;if(!claimVoiceCall(callOwner.current)){callStarting.current=false;setError('End the other voice call before starting this one.');return}try{const {data,error:e}=await supabase.rpc('check_friend_call_target',{p_user_id:friend.user_id});if(e)throw e;if(!data)throw new Error('Voice calls are unavailable for this friend.');await mic();const call:Call={id:crypto.randomUUID(),callerId:userId,callerName:name,callerAvatar:avatarId,recipientId:friend.user_id,recipientName:friend.name,recipientAvatar:friend.avatar_id||1};callRef.current=call;setActive(call);setStatus('calling');await setupRoom(call);void publishInbox(call.recipientId,'invite',{call}).catch((e:any)=>{setError(e?.message||'Could not send call invitation.');void cleanup()})}catch(e:any){setError(e?.name==='NotAllowedError'?'Microphone permission was denied.':e?.message||'Could not start the call.');await cleanup()}finally{callStarting.current=false}};
 const accept=async()=>{const call=incoming;if(!call||callStarting.current)return;setError('');callStarting.current=true;if(!claimVoiceCall(callOwner.current)){callStarting.current=false;setError('End the other voice call before accepting this one.');return}try{const {data,error:e}=await supabase.rpc('check_friend_call_target',{p_user_id:call.callerId});if(e)throw e;if(!data)throw new Error('This call is unavailable.');await mic();callRef.current=call;incomingRef.current=null;setActive(call);setIncoming(null);setStatus('connecting');await setupRoom(call);void publishInbox(call.callerId,'accepted',{callId:call.id,from:userId})}catch(e:any){setError(e?.message||'Could not accept the call.');await cleanup()}finally{callStarting.current=false}};
 const decline=()=>{if(incoming)void publishInbox(incoming.callerId,'declined',{callId:incoming.id,from:userId});incomingRef.current=null;setIncoming(null)};
 const end=async()=>{send('end',{from:userId});if(active)void publishInbox(userId===active.callerId?active.recipientId:active.callerId,'cancel',{callId:active.id,from:userId});await cleanup()};
 const toggleMic=()=>{const next=!muted;stream.current?.getAudioTracks().forEach(t=>t.enabled=!next);setMuted(next)};
 return <>
  {friend&&<div className="friend-chat-call-actions"><button type="button" className="friend-back-icon-btn" onClick={onBack} title="Back to friends" aria-label="Back to friends"><ArrowLeft size={19}/></button><button type="button" className="friend-call-trigger" disabled={blocked||!!active} onClick={()=>void start()} title={blocked?'Unblock this friend to call':'Voice call'} aria-label="Start voice call"><PhoneCall size={17}/><span>Call</span></button>{headerActions}</div>}
  {error&&<div className="friend-call-toast" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Dismiss"><X size={14}/></button></div>}
  {incoming&&<div className="private-call-backdrop" role="alertdialog" aria-modal="true"><div className="private-incoming-call"><div className="private-incoming-icon"><PhoneCall size={28}/></div><span className="private-call-kicker">INCOMING VOICE CALL</span><img className="friend-call-avatar" src={avatar(incoming.callerAvatar)} alt=""/><h3>{incoming.callerName}</h3><p>Friends voice call</p><div className="private-incoming-actions"><button className="private-call-decline" onClick={decline}><PhoneOff size={17}/> DECLINE</button><button className="private-call-accept" onClick={()=>void accept()}><Phone size={17}/> ACCEPT</button></div></div></div>}
  {active&&<div className="private-active-call friend-active-call"><div className="private-active-call-head"><div><span>FRIENDS VOICE CALL</span><strong>{status==='connected'?'CONNECTED':status==='connecting'?'CONNECTING...':'CALLING...'}</strong></div></div><div className="private-active-participants"><div className="private-active-person"><img className="friend-call-avatar" src={avatar(userId===active.callerId?active.recipientAvatar:active.callerAvatar)} alt=""/><span>{userId===active.callerId?active.recipientName:active.callerName}</span>{remote&&<audio autoPlay playsInline muted={speakerMuted} ref={el=>{if(el){el.volume=speakerVolume;if(el.srcObject!==remote){el.srcObject=remote;void el.play().catch(()=>setError('Call audio is blocked by your browser. Check site sound permissions.'))}}}}/>}</div></div><div className="private-active-controls"><label className="call-speaker-volume"><Volume2 size={15}/><span>Speaker</span><input type="range" min="0.1" max="0.85" step="0.05" value={speakerVolume} aria-label="Call speaker volume" onChange={event=>setSpeakerVolume(Number(event.target.value))}/><output>{Math.round(speakerVolume*100)}%</output></label><button onClick={toggleMic} className={muted?'active':''} title={muted?'Turn microphone on':'Mute microphone'}>{muted?<MicOff size={18}/>:<Mic size={18}/>}<span>{muted?'MIC OFF':'MIC ON'}</span></button><button onClick={()=>setSpeakerMuted(v=>!v)} className={speakerMuted?'active':''} title={speakerMuted?'Unmute call audio':'Mute call audio'}>{speakerMuted?<VolumeX size={18}/>:<Volume2 size={18}/>}<span>{speakerMuted?'SOUND OFF':'SOUND ON'}</span></button><button className="danger" onClick={()=>void end()}><PhoneOff size={18}/><span>END</span></button></div></div>}
 </>;
}
