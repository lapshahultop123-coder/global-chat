import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Phone, PhoneCall, PhoneOff, Mic, MicOff, Volume2, VolumeX, X, Users, ShieldOff, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AVATARS } from './data/catalog';
import { claimVoiceCall, flushCallIceCandidates, ownsVoiceCall, queueCallIceCandidate, releaseVoiceCall, requestVoiceCallStream, type PendingCallIce } from './callAudio';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

type Member = { user_id:string; name:string; avatar_id:number; is_blocked_by_me?:boolean; has_blocked_me?:boolean };
type ActiveCall = { id:string; callerId:string; callerName:string; participantIds:string[]; startedAt:number };

type Props = {
  roomId:string;
  currentUserId:string;
  currentUserName:string;
  sound:boolean;
};

function avatarSrc(id:number){return AVATARS.find(a=>a.id===id)?.src ?? AVATARS[0].src;}

export default function PrivateCallCenter({roomId,currentUserId,currentUserName,sound}:Props){
  const [members,setMembers]=useState<Member[]>([]);
  const [panelOpen,setPanelOpen]=useState(false);
  const [incoming,setIncoming]=useState<{id:string;callerId:string;callerName:string;participantIds:string[]}|null>(null);
  const [activeCall,setActiveCall]=useState<ActiveCall|null>(null);
  const [callStatus,setCallStatus]=useState<'idle'|'calling'|'connecting'|'connected'|'ended'>('idle');
  const [muted,setMuted]=useState(false);
  const [speakerMuted,setSpeakerMuted]=useState(false);
  const [speakerVolume,setSpeakerVolume]=useState(0.6);
  const [selected,setSelected]=useState<string[]>([]);
  const [error,setError]=useState('');
  const [remoteStreams,setRemoteStreams]=useState<Record<string,MediaStream>>({});
  const [remoteNames,setRemoteNames]=useState<Record<string,string>>({});
  const [blocked,setBlocked]=useState<Member[]>([]);
  const incomingRef=useRef<typeof incoming>(null);
  useEffect(()=>{incomingRef.current=incoming},[incoming]);

  const roomChannelRef=useRef<any>(null);
  const callChannelRef=useRef<any>(null);
  const localStreamRef=useRef<MediaStream|null>(null);
  const peersRef=useRef<Record<string,RTCPeerConnection>>({});
  const callRef=useRef<ActiveCall|null>(null);
  const mountedRef=useRef(true);
  const callOwnerRef=useRef(Symbol('private-voice-call'));
  const callStartingRef=useRef(false);
  const localStreamRequestRef=useRef<Promise<MediaStream>|null>(null);
  const peerRequestsRef=useRef<Record<string,Promise<RTCPeerConnection>>>({});
  const pendingIceRef=useRef<PendingCallIce>(new Map());
  const offerPendingRef=useRef<Set<string>>(new Set());

  const loadMembers=useCallback(async()=>{
    const {data,error}=await supabase.rpc('get_private_call_members',{p_room_id:roomId});
    if(error){setError(error.message);return;}
    const rows=(data||[]) as Member[];
    setMembers(rows.filter(x=>x.user_id!==currentUserId && !x.has_blocked_me));
    setBlocked(rows.filter(x=>x.is_blocked_by_me));
  },[roomId,currentUserId]);

  useEffect(()=>{void loadMembers();},[loadMembers]);

  const beep=useCallback((kind:'ring'|'end')=>{
    if(!sound)return;
    const src=kind==='ring'?'/sounds/receive.wav':'/sounds/send.wav';
    const a=new Audio(src);a.volume=.38;void a.play().catch(()=>{});
  },[sound]);

  const clearPeers=useCallback(()=>{
    Object.values(peersRef.current).forEach(pc=>{try{pc.onicecandidate=null;pc.ontrack=null;pc.close()}catch{}});
    peersRef.current={};
    peerRequestsRef.current={};
    pendingIceRef.current.clear();
    offerPendingRef.current.clear();
    setRemoteStreams({});
  },[]);

  const leaveCallChannel=useCallback(async()=>{
    if(callChannelRef.current){try{await supabase.removeChannel(callChannelRef.current)}catch{}callChannelRef.current=null;}
  },[]);

  const cleanupCall=useCallback(async()=>{
    releaseVoiceCall(callOwnerRef.current);
    clearPeers();
    localStreamRef.current?.getTracks().forEach(t=>t.stop());
    localStreamRef.current=null;
    localStreamRequestRef.current=null;
    await leaveCallChannel();
    callRef.current=null;incomingRef.current=null;
    if(mountedRef.current){setActiveCall(null);setIncoming(null);setMuted(false);setSpeakerMuted(false);setCallStatus('idle');}
  },[clearPeers,leaveCallChannel]);

  const sendCallEvent=useCallback((event:string,payload:any)=>{
    const ch=callChannelRef.current;
    if(ch)void ch.send({type:'broadcast',event,payload});
  },[]);

  const ensureLocalStream=useCallback(async()=>{
    const existing=localStreamRef.current;
    if(existing?.getAudioTracks().some(track=>track.readyState==='live'))return existing;
    if(localStreamRequestRef.current)return localStreamRequestRef.current;
    const owner=callOwnerRef.current;
    const request=requestVoiceCallStream().then(stream=>{
      if(!ownsVoiceCall(owner)){stream.getTracks().forEach(track=>track.stop());throw new Error('Call was cancelled before the microphone was ready.');}
      localStreamRef.current=stream;
      const micSettings=stream.getAudioTracks()[0]?.getSettings();
      if(micSettings?.echoCancellation===false||micSettings?.noiseSuppression===false||micSettings?.autoGainControl===true)setError('Your browser could not apply all echo-control settings. Use headphones or lower speaker volume to prevent echo.');
      return stream;
    }).finally(()=>{if(localStreamRequestRef.current===request)localStreamRequestRef.current=null});
    localStreamRequestRef.current=request;
    return request;
  },[]);

  const ensurePeer=useCallback(async(remoteId:string)=>{
    const existing=peersRef.current[remoteId];
    if(existing&&existing.connectionState!=='closed')return existing;
    const pending=peerRequestsRef.current[remoteId];
    if(pending)return pending;
    const request=(async()=>{
      const stream=await ensureLocalStream();
      const audioTrack=stream.getAudioTracks().find(track=>track.readyState==='live');
      if(!audioTrack)throw new Error('The microphone track ended. Please retry the call.');
      if(!ownsVoiceCall(callOwnerRef.current))throw new Error('The call ended before the peer connection was ready.');
      const pc=new RTCPeerConnection(ICE_SERVERS);
      if(!pc.getSenders().some(sender=>sender.track?.id===audioTrack.id))pc.addTrack(audioTrack,stream);
      peersRef.current[remoteId]=pc;
      pc.onicecandidate=e=>{if(e.candidate)sendCallEvent('ice',{from:currentUserId,to:remoteId,candidate:e.candidate});};
      pc.ontrack=e=>{
        if(e.track.kind!=='audio')return;
        const s=e.streams[0]||new MediaStream([e.track]);
        setRemoteStreams(prev=>prev[remoteId]===s?prev:{...prev,[remoteId]:s});
      };
      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='failed'||pc.connectionState==='closed'){
          if(peersRef.current[remoteId]===pc)delete peersRef.current[remoteId];
          pendingIceRef.current.delete(remoteId);
          setRemoteStreams(prev=>{const next={...prev};delete next[remoteId];return next;});
          if(pc.connectionState==='failed')setError('Call connection failed. Check the network, then restart the call.');
        }
        const anyConnected=Object.values(peersRef.current).some(x=>x.connectionState==='connected');
        if(anyConnected)setCallStatus('connected');
      };
      return pc;
    })();
    peerRequestsRef.current[remoteId]=request;
    try{return await request}finally{if(peerRequestsRef.current[remoteId]===request)delete peerRequestsRef.current[remoteId]}
  },[currentUserId,ensureLocalStream,sendCallEvent]);

  const maybeOffer=useCallback(async(remoteId:string)=>{
    if(currentUserId>=remoteId||offerPendingRef.current.has(remoteId))return;
    offerPendingRef.current.add(remoteId);
    try{
      const pc=await ensurePeer(remoteId);
      if(pc.signalingState!=='stable')return;
      const offer=await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendCallEvent('offer',{from:currentUserId,to:remoteId,description:pc.localDescription||offer});
    }catch(error){setError(error instanceof Error?error.message:'Could not start the voice call.')}
    finally{offerPendingRef.current.delete(remoteId)}
  },[currentUserId,ensurePeer,sendCallEvent]);

  const joinCallChannel=useCallback(async(call:ActiveCall)=>{
    const ch=supabase.channel(`private-call-${call.id}`,{config:{presence:{key:currentUserId},broadcast:{self:false,ack:true}}});
    ch.on('presence',{event:'sync'},async()=>{
      const state=ch.presenceState() as Record<string,any[]>;
      const ids=Object.keys(state).filter(id=>id!==currentUserId);
      for(const id of ids)void maybeOffer(id);
    });
    ch.on('presence',{event:'join'},async({key}:any)=>{if(key&&key!==currentUserId)void maybeOffer(key);});
    ch.on('broadcast' as any,{event:'join-call'},({payload}:any)=>{if(payload?.userId!==currentUserId)void maybeOffer(payload.userId);});
    ch.on('broadcast' as any,{event:'offer'},async({payload}:any)=>{
      if(payload?.to!==currentUserId||!payload?.description)return;
      try{const pc=await ensurePeer(payload.from);await pc.setRemoteDescription(payload.description);await flushCallIceCandidates(pendingIceRef.current,payload.from,pc);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);sendCallEvent('answer',{from:currentUserId,to:payload.from,description:pc.localDescription||answer});}catch(e:any){setError(e?.message||'Could not establish the voice call.');}
    });
    ch.on('broadcast' as any,{event:'answer'},async({payload}:any)=>{
      if(payload?.to!==currentUserId||!payload?.description)return;
      const pc=peersRef.current[payload.from];if(!pc)return;
      try{await pc.setRemoteDescription(payload.description);await flushCallIceCandidates(pendingIceRef.current,payload.from,pc);}catch(e:any){setError(e?.message||'Could not complete the voice call.');}
    });
    ch.on('broadcast' as any,{event:'ice'},async({payload}:any)=>{
      if(payload?.to!==currentUserId||!payload?.from||!payload?.candidate)return;
      const pc=peersRef.current[payload.from];
      if(!pc||!pc.remoteDescription){queueCallIceCandidate(pendingIceRef.current,payload.from,payload.candidate);return;}
      try{await pc.addIceCandidate(payload.candidate);}catch{}
    });
    ch.on('broadcast' as any,{event:'end-call'},async({payload}:any)=>{
      if(payload?.from!==currentUserId){await cleanupCall();}
    });
    ch.on('broadcast' as any,{event:'leave-call'},({payload}:any)=>{
      if(payload?.userId&&peersRef.current[payload.userId]){try{peersRef.current[payload.userId].close()}catch{}delete peersRef.current[payload.userId];pendingIceRef.current.delete(payload.userId);offerPendingRef.current.delete(payload.userId);setRemoteStreams(prev=>{const next={...prev};delete next[payload.userId];return next;});}
    });
    callChannelRef.current=ch;
    await new Promise<void>((resolve,reject)=>{const timeout=window.setTimeout(()=>reject(new Error('Call signaling timed out. Check your connection and retry.')),15000);ch.subscribe((status:string)=>{if(status==='SUBSCRIBED'){window.clearTimeout(timeout);resolve()}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){window.clearTimeout(timeout);reject(new Error('Call connection failed.'))}})});
    await ch.track({userId:currentUserId,name:currentUserName,joinedAt:new Date().toISOString()});
    await ch.send({type:'broadcast',event:'join-call',payload:{userId:currentUserId}});
  },[cleanupCall,currentUserId,currentUserName,ensurePeer,maybeOffer,sendCallEvent]);

  const startCall=async()=>{
    setError('');
    if(callStartingRef.current||callRef.current)return;
    const targets=[...selected];
    if(!targets.length){setError('Select at least one member.');return;}
    callStartingRef.current=true;
    if(!claimVoiceCall(callOwnerRef.current)){callStartingRef.current=false;setError('End the other voice call before starting this one.');return;}
    try{
      const {data,error:checkError}=await supabase.rpc('check_private_call_targets',{p_room_id:roomId,p_target_ids:targets});
      if(checkError)throw checkError;
      const allowed=(data||[]).filter((x:any)=>x.allowed).map((x:any)=>x.user_id);
      if(!allowed.length){releaseVoiceCall(callOwnerRef.current);setError('Those members cannot receive a call because of a call block.');return;}
      await ensureLocalStream();
      const id=crypto.randomUUID();
      const call={id,callerId:currentUserId,callerName:currentUserName,participantIds:[currentUserId,...allowed],startedAt:Date.now()};
      callRef.current=call;setActiveCall(call);setCallStatus('calling');setPanelOpen(false);setSelected([]);
      await joinCallChannel(call);
      if(roomChannelRef.current)void roomChannelRef.current.send({type:'broadcast',event:'call-invite',payload:{callId:id,callerId:currentUserId,callerName:currentUserName,participantIds:call.participantIds}});
    }catch(e:any){setError(e?.name==='NotAllowedError'?'Microphone permission was denied. Please allow microphone access.':e?.message||'Could not start the voice call.');await cleanupCall();}
    finally{callStartingRef.current=false;}
  };

  const acceptCall=async()=>{
    const inc=incoming;if(!inc)return;
    if(callStartingRef.current||callRef.current)return;
    callStartingRef.current=true;
    if(!claimVoiceCall(callOwnerRef.current)){callStartingRef.current=false;setError('End the other voice call before accepting this one.');return;}
    try{
      const {data,error:checkError}=await supabase.rpc('check_private_call_targets',{p_room_id:roomId,p_target_ids:[inc.callerId]});
      if(checkError)throw checkError;
      if(!data?.[0]?.allowed)throw new Error('This call is blocked.');
      await ensureLocalStream();
      const call={id:inc.id,callerId:inc.callerId,callerName:inc.callerName,participantIds:inc.participantIds,startedAt:Date.now()};
      callRef.current=call;incomingRef.current=null;setIncoming(null);setActiveCall(call);setCallStatus('connecting');
      await joinCallChannel(call);
      if(roomChannelRef.current)void roomChannelRef.current.send({type:'broadcast',event:'call-accepted',payload:{callId:inc.id,userId:currentUserId}});
    }catch(e:any){setError(e?.message||'Could not join the voice call.');incomingRef.current=null;setIncoming(null);await cleanupCall();}
    finally{callStartingRef.current=false;}
  };

  const declineCall=()=>{if(incoming&&roomChannelRef.current)void roomChannelRef.current.send({type:'broadcast',event:'call-declined',payload:{callId:incoming.id,userId:currentUserId}});incomingRef.current=null;setIncoming(null);};

  const endCall=async()=>{const call=callRef.current;if(call){sendCallEvent('end-call',{from:currentUserId});if(roomChannelRef.current)void roomChannelRef.current.send({type:'broadcast',event:'call-cancelled',payload:{callId:call.id,from:currentUserId}});}await cleanupCall();};
  const toggleMute=()=>{const next=!muted;localStreamRef.current?.getAudioTracks().forEach(t=>{t.enabled=!next});setMuted(next);};

  const toggleBlock=async(member:Member,shouldBlock:boolean)=>{
    setError('');
    const {error}=await supabase.rpc('set_private_call_block',{p_room_id:roomId,p_user_id:member.user_id,p_blocked:shouldBlock});
    if(error){setError(error.message);return;}
    setSelected(prev=>shouldBlock?prev.filter(id=>id!==member.user_id):prev);
    await loadMembers();
  };

  const callableMembers=useMemo(()=>members.filter(m=>!m.is_blocked_by_me&&!m.has_blocked_me),[members]);
  const allCallableSelected=callableMembers.length>0&&callableMembers.every(m=>selected.includes(m.user_id));
  const toggleSelectAll=()=>{
    setSelected(allCallableSelected?[]:callableMembers.map(m=>m.user_id));
  };

  const toggleSpeaker=()=>{
    setSpeakerMuted(prev=>!prev);
  };

  useEffect(()=>{
    mountedRef.current=true;
    const ch=supabase.channel(`private-room-call-control-${roomId}`,{config:{broadcast:{self:false,ack:true}}});
    ch.on('broadcast' as any,{event:'call-invite'},({payload}:any)=>{
      if(!payload?.participantIds?.includes(currentUserId)||payload.callerId===currentUserId)return;
      if(callRef.current||incomingRef.current){void ch.send({type:'broadcast',event:'call-declined',payload:{callId:payload.callId,userId:currentUserId}});return;}
      const call={id:payload.callId,callerId:payload.callerId,callerName:payload.callerName,participantIds:payload.participantIds};incomingRef.current=call;setIncoming(call);beep('ring');
    });
    ch.on('broadcast' as any,{event:'call-accepted'},({payload}:any)=>{if(callRef.current?.id===payload?.callId)setCallStatus('connecting');});
    ch.on('broadcast' as any,{event:'call-declined'},({payload}:any)=>{if(callRef.current?.id===payload?.callId&&payload.userId)setError(`${remoteNames[payload.userId]||'A member'} declined the call.`);});
    ch.on('broadcast' as any,{event:'call-cancelled'},({payload}:any)=>{if(incomingRef.current?.id===payload?.callId){incomingRef.current=null;setIncoming(null);}});
    ch.subscribe();roomChannelRef.current=ch;
    return()=>{mountedRef.current=false;void supabase.removeChannel(ch);roomChannelRef.current=null;void cleanupCall();};
  },[roomId,currentUserId,beep,cleanupCall]);

  useEffect(()=>()=>{void cleanupCall()},[cleanupCall]);

  const participantNames=useMemo(()=>members.reduce((acc,m)=>(acc[m.user_id]=m.name,acc),{[currentUserId]:currentUserName} as Record<string,string>),[members,currentUserId,currentUserName]);
  useEffect(()=>{setRemoteNames(participantNames)},[participantNames]);

  const activeParticipants=activeCall?.participantIds||[];

  return <>
    <button className="private-call-btn" onClick={()=>{setError('');void loadMembers();setPanelOpen(true)}} title="Voice call" aria-label="Voice call"><PhoneCall size={16}/><span>CALL</span></button>

    {panelOpen&&<div className="private-call-backdrop" role="dialog" aria-modal="true"><div className="private-call-panel">
      <div className="private-call-head"><div><b><PhoneCall size={17}/> VOICE CALL</b><span>Select one member or use Select All to call every available member in this private chat.</span></div><button onClick={()=>setPanelOpen(false)} aria-label="Close"><X size={18}/></button></div>
      {error&&<div className="private-call-error">{error}</div>}
      <div className="private-call-list-head"><span>{callableMembers.length} available member{callableMembers.length===1?'':'s'}</span><button type="button" className="private-call-select-all" onClick={toggleSelectAll} disabled={!callableMembers.length} title={allCallableSelected?'Clear all selections':'Select all available members'}>{allCallableSelected?<CheckSquare size={15}/>:<Square size={15}/>}<span>{allCallableSelected?'CLEAR ALL':'SELECT ALL'}</span></button></div>
      <div className="private-call-list">
        {members.length===0?<div className="private-call-empty">No callable members in this private chat.</div>:members.map(m=>{
          const checked=selected.includes(m.user_id);
          return <div className="private-call-member" key={m.user_id}><img src={avatarSrc(Number(m.avatar_id))} alt=""/><div><strong>{m.name||'User'}</strong><small>{m.has_blocked_me?'Call blocked by this member':'Available for voice call'}</small></div><label className="private-call-check"><input type="checkbox" checked={checked} disabled={Boolean(m.has_blocked_me)} onChange={()=>setSelected(prev=>checked?prev.filter(x=>x!==m.user_id):[...prev,m.user_id])}/><span>{checked?'SELECTED':'SELECT'}</span></label><button className="private-call-block-btn" onClick={()=>void toggleBlock(m,!m.is_blocked_by_me)} title={m.is_blocked_by_me?'Unblock calls':'Block calls'}>{m.is_blocked_by_me?<ShieldCheck size={16}/>:<ShieldOff size={16}/>}<span>{m.is_blocked_by_me?'UNBLOCK':'BLOCK'}</span></button></div>;
        })}
      </div>
      {blocked.length>0&&<div className="private-call-blocked"><b>CALL BLOCKED</b><span>{blocked.map(m=>m.name).join(', ')}</span></div>}
      <div className="private-call-actions"><button className="private-modal-cancel" onClick={()=>setPanelOpen(false)}>CANCEL</button><button className="private-call-start" disabled={!selected.length} onClick={()=>void startCall()}><Phone size={16}/> {selected.length>1?'START GROUP CALL':'START VOICE CALL'}</button></div>
    </div></div>}

    {incoming&&<div className="private-call-backdrop" role="alertdialog" aria-modal="true"><div className="private-incoming-call"><div className="private-incoming-icon"><PhoneCall size={28}/></div><span className="private-call-kicker">INCOMING VOICE CALL</span><h3>{incoming.callerName}</h3><p>{incoming.participantIds.length>2?`Group call · ${incoming.participantIds.length} invited`: 'Private one-to-one call'}</p><div className="private-incoming-actions"><button className="private-call-decline" onClick={declineCall}><PhoneOff size={17}/> DECLINE</button><button className="private-call-accept" onClick={()=>void acceptCall()}><Phone size={17}/> ACCEPT</button></div></div></div>}

    {activeCall&&<div className="private-active-call"><div className="private-active-call-head"><div><span>VOICE CALL</span><strong>{callStatus==='connected'?'CONNECTED':callStatus==='calling'?'CALLING...':callStatus==='connecting'?'CONNECTING...':'CALLING...'}</strong></div></div><div className="private-active-participants">{activeParticipants.map(id=><div key={id} className="private-active-person"><div className="private-active-avatar">{id===currentUserId?<Mic size={17}/>:<Users size={17}/>}</div><span>{id===currentUserId?'You':remoteNames[id]||'Member'}</span>{id!==currentUserId&&remoteStreams[id]&&<audio autoPlay playsInline muted={speakerMuted} ref={el=>{if(el){el.volume=speakerVolume;if(el.srcObject!==remoteStreams[id]){el.srcObject=remoteStreams[id];void el.play().catch(()=>setError('Call audio is blocked by your browser. Check site sound permissions.'))}}}}/>}</div>)}</div><div className="private-active-controls"><label className="call-speaker-volume"><Volume2 size={15}/><span>Speaker</span><input type="range" min="0.2" max="1" step="0.05" value={speakerVolume} aria-label="Call speaker volume" onChange={event=>setSpeakerVolume(Number(event.target.value))}/><output>{Math.round(speakerVolume*100)}%</output></label><button onClick={toggleMute} className={muted?'active':''} title={muted?'Turn microphone on':'Mute microphone'}>{muted?<MicOff size={18}/>:<Mic size={18}/>}<span>{muted?'MIC OFF':'MIC ON'}</span></button><button onClick={toggleSpeaker} className={speakerMuted?'active':''} title={speakerMuted?'Unmute call audio':'Mute call audio'}>{speakerMuted?<VolumeX size={18}/>:<Volume2 size={18}/>}<span>{speakerMuted?'SOUND OFF':'SOUND ON'}</span></button><button className="danger" onClick={()=>void endCall()}><PhoneOff size={18}/><span>END</span></button></div></div>}
    {activeCall&&error&&<div className="private-call-error" role="alert" style={{position:'fixed',right:18,bottom:150,zIndex:5101,width:'min(370px,calc(100vw - 36px))'}}>{error}</div>}
  </>;
}
