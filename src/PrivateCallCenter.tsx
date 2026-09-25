import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Phone, PhoneCall, PhoneOff, Mic, MicOff, X, Users, ShieldOff, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AVATARS } from './data/catalog';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};
const MAX_PARTICIPANTS = 4;

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
    setRemoteStreams({});
  },[]);

  const leaveCallChannel=useCallback(async()=>{
    if(callChannelRef.current){try{await supabase.removeChannel(callChannelRef.current)}catch{}callChannelRef.current=null;}
  },[]);

  const cleanupCall=useCallback(async()=>{
    clearPeers();
    localStreamRef.current?.getTracks().forEach(t=>t.stop());
    localStreamRef.current=null;
    await leaveCallChannel();
    callRef.current=null;
    if(mountedRef.current){setActiveCall(null);setIncoming(null);setMuted(false);setCallStatus('idle');}
  },[clearPeers,leaveCallChannel]);

  const sendCallEvent=useCallback((event:string,payload:any)=>{
    const ch=callChannelRef.current;
    if(ch)void ch.send({type:'broadcast',event,payload});
  },[]);

  const ensureLocalStream=useCallback(async()=>{
    if(localStreamRef.current)return localStreamRef.current;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Voice calls are not supported by this browser.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    localStreamRef.current=stream;
    return stream;
  },[]);

  const ensurePeer=useCallback(async(remoteId:string)=>{
    if(peersRef.current[remoteId])return peersRef.current[remoteId];
    const pc=new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[remoteId]=pc;
    const stream=await ensureLocalStream();
    stream.getTracks().forEach(t=>pc.addTrack(t,stream));
    pc.onicecandidate=e=>{if(e.candidate)sendCallEvent('ice',{from:currentUserId,to:remoteId,candidate:e.candidate});};
    pc.ontrack=e=>{
      const s=e.streams[0];
      if(s)setRemoteStreams(prev=>({...prev,[remoteId]:s}));
    };
    pc.onconnectionstatechange=()=>{
      if(pc.connectionState==='failed'||pc.connectionState==='closed'){
        setRemoteStreams(prev=>{const next={...prev};delete next[remoteId];return next;});
      }
      const anyConnected=Object.values(peersRef.current).some(x=>x.connectionState==='connected');
      if(anyConnected)setCallStatus('connected');
    };
    return pc;
  },[currentUserId,ensureLocalStream,sendCallEvent]);

  const maybeOffer=useCallback(async(remoteId:string)=>{
    if(currentUserId>=remoteId)return;
    const pc=await ensurePeer(remoteId);
    const offer=await pc.createOffer({offerToReceiveAudio:true});
    await pc.setLocalDescription(offer);
    sendCallEvent('offer',{from:currentUserId,to:remoteId,description:offer});
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
      try{const pc=await ensurePeer(payload.from);await pc.setRemoteDescription(payload.description);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);sendCallEvent('answer',{from:currentUserId,to:payload.from,description:answer});}catch(e:any){setError(e?.message||'Could not establish the voice call.');}
    });
    ch.on('broadcast' as any,{event:'answer'},async({payload}:any)=>{
      if(payload?.to!==currentUserId||!payload?.description)return;
      const pc=peersRef.current[payload.from];if(!pc)return;
      try{await pc.setRemoteDescription(payload.description);}catch(e:any){setError(e?.message||'Could not complete the voice call.');}
    });
    ch.on('broadcast' as any,{event:'ice'},async({payload}:any)=>{
      if(payload?.to!==currentUserId||!payload?.candidate)return;
      const pc=peersRef.current[payload.from];if(!pc)return;
      try{await pc.addIceCandidate(payload.candidate);}catch{}
    });
    ch.on('broadcast' as any,{event:'end-call'},async({payload}:any)=>{
      if(payload?.from!==currentUserId){await cleanupCall();}
    });
    ch.on('broadcast' as any,{event:'leave-call'},({payload}:any)=>{
      if(payload?.userId&&peersRef.current[payload.userId]){try{peersRef.current[payload.userId].close()}catch{}delete peersRef.current[payload.userId];setRemoteStreams(prev=>{const next={...prev};delete next[payload.userId];return next;});}
    });
    callChannelRef.current=ch;
    await new Promise<void>((resolve,reject)=>ch.subscribe((status:string)=>{if(status==='SUBSCRIBED')resolve();else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(new Error('Call connection failed.'))}));
    await ch.track({userId:currentUserId,name:currentUserName,joinedAt:new Date().toISOString()});
    await ch.send({type:'broadcast',event:'join-call',payload:{userId:currentUserId}});
  },[cleanupCall,currentUserId,currentUserName,ensurePeer,maybeOffer,sendCallEvent]);

  const startCall=async()=>{
    setError('');
    const targets=selected.slice(0,MAX_PARTICIPANTS-1);
    if(!targets.length){setError('Select at least one member.');return;}
    try{
      const {data,error:checkError}=await supabase.rpc('check_private_call_targets',{p_room_id:roomId,p_target_ids:targets});
      if(checkError)throw checkError;
      const allowed=(data||[]).filter((x:any)=>x.allowed).map((x:any)=>x.user_id);
      if(!allowed.length){setError('Those members cannot receive a call because of a call block.');return;}
      await ensureLocalStream();
      const id=crypto.randomUUID();
      const call={id,callerId:currentUserId,callerName:currentUserName,participantIds:[currentUserId,...allowed],startedAt:Date.now()};
      callRef.current=call;setActiveCall(call);setCallStatus('calling');setPanelOpen(false);setSelected([]);
      await joinCallChannel(call);
      if(roomChannelRef.current)void roomChannelRef.current.send({type:'broadcast',event:'call-invite',payload:{callId:id,callerId:currentUserId,callerName:currentUserName,participantIds:call.participantIds}});
    }catch(e:any){setError(e?.name==='NotAllowedError'?'Microphone permission was denied. Please allow microphone access.':e?.message||'Could not start the voice call.');await cleanupCall();}
  };

  const acceptCall=async()=>{
    const inc=incoming;if(!inc)return;
    try{
      const {data,error:checkError}=await supabase.rpc('check_private_call_targets',{p_room_id:roomId,p_target_ids:[inc.callerId]});
      if(checkError)throw checkError;
      if(!data?.[0]?.allowed)throw new Error('This call is blocked.');
      await ensureLocalStream();
      const call={id:inc.id,callerId:inc.callerId,callerName:inc.callerName,participantIds:inc.participantIds,startedAt:Date.now()};
      callRef.current=call;setIncoming(null);setActiveCall(call);setCallStatus('connecting');
      await joinCallChannel(call);
      if(roomChannelRef.current)void roomChannelRef.current.send({type:'broadcast',event:'call-accepted',payload:{callId:inc.id,userId:currentUserId}});
    }catch(e:any){setError(e?.message||'Could not join the voice call.');setIncoming(null);}
  };

  const declineCall=()=>{if(incoming&&roomChannelRef.current)void roomChannelRef.current.send({type:'broadcast',event:'call-declined',payload:{callId:incoming.id,userId:currentUserId}});setIncoming(null);};

  const endCall=async()=>{const call=callRef.current;if(call){sendCallEvent('end-call',{from:currentUserId});if(roomChannelRef.current)void roomChannelRef.current.send({type:'broadcast',event:'call-cancelled',payload:{callId:call.id,from:currentUserId}});}await cleanupCall();};
  const toggleMute=()=>{const next=!muted;localStreamRef.current?.getAudioTracks().forEach(t=>{t.enabled=!next});setMuted(next);};

  const toggleBlock=async(member:Member,shouldBlock:boolean)=>{
    setError('');
    const {error}=await supabase.rpc('set_private_call_block',{p_room_id:roomId,p_user_id:member.user_id,p_blocked:shouldBlock});
    if(error){setError(error.message);return;}
    await loadMembers();
  };

  useEffect(()=>{
    mountedRef.current=true;
    const ch=supabase.channel(`private-room-call-control-${roomId}`,{config:{broadcast:{self:false,ack:true}}});
    ch.on('broadcast' as any,{event:'call-invite'},({payload}:any)=>{
      if(!payload?.participantIds?.includes(currentUserId)||payload.callerId===currentUserId)return;
      if(callRef.current||incoming){void ch.send({type:'broadcast',event:'call-declined',payload:{callId:payload.callId,userId:currentUserId}});return;}
      setIncoming({id:payload.callId,callerId:payload.callerId,callerName:payload.callerName,participantIds:payload.participantIds});beep('ring');
    });
    ch.on('broadcast' as any,{event:'call-accepted'},({payload}:any)=>{if(callRef.current?.id===payload?.callId)setCallStatus('connecting');});
    ch.on('broadcast' as any,{event:'call-declined'},({payload}:any)=>{if(callRef.current?.id===payload?.callId&&payload.userId)setError(`${remoteNames[payload.userId]||'A member'} declined the call.`);});
    ch.on('broadcast' as any,{event:'call-cancelled'},({payload}:any)=>{if(incomingRef.current?.id===payload?.callId)setIncoming(null);});
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
      <div className="private-call-head"><div><b><PhoneCall size={17}/> VOICE CALL</b><span>Select one member for a private call or up to {MAX_PARTICIPANTS-1} members for a group call.</span></div><button onClick={()=>setPanelOpen(false)} aria-label="Close"><X size={18}/></button></div>
      {error&&<div className="private-call-error">{error}</div>}
      <div className="private-call-list">
        {members.length===0?<div className="private-call-empty">No callable members in this private chat.</div>:members.map(m=>{
          const checked=selected.includes(m.user_id);
          return <div className="private-call-member" key={m.user_id}><img src={avatarSrc(Number(m.avatar_id))} alt=""/><div><strong>{m.name||'User'}</strong><small>{m.has_blocked_me?'Call blocked by this member':'Available for voice call'}</small></div><label className="private-call-check"><input type="checkbox" checked={checked} disabled={Boolean(m.has_blocked_me)||(!checked&&selected.length>=MAX_PARTICIPANTS-1)} onChange={()=>setSelected(prev=>checked?prev.filter(x=>x!==m.user_id):[...prev,m.user_id])}/><span>{checked?'SELECTED':'SELECT'}</span></label><button className="private-call-block-btn" onClick={()=>void toggleBlock(m,!m.is_blocked_by_me)} title={m.is_blocked_by_me?'Unblock calls':'Block calls'}>{m.is_blocked_by_me?<ShieldCheck size={16}/>:<ShieldOff size={16}/>}<span>{m.is_blocked_by_me?'UNBLOCK':'BLOCK'}</span></button></div>;
        })}
      </div>
      {blocked.length>0&&<div className="private-call-blocked"><b>CALL BLOCKED</b><span>{blocked.map(m=>m.name).join(', ')}</span></div>}
      <div className="private-call-actions"><button className="private-modal-cancel" onClick={()=>setPanelOpen(false)}>CANCEL</button><button className="private-call-start" disabled={!selected.length} onClick={()=>void startCall()}><Phone size={16}/> {selected.length>1?'START GROUP CALL':'START VOICE CALL'}</button></div>
    </div></div>}

    {incoming&&<div className="private-call-backdrop" role="alertdialog" aria-modal="true"><div className="private-incoming-call"><div className="private-incoming-icon"><PhoneCall size={28}/></div><span className="private-call-kicker">INCOMING VOICE CALL</span><h3>{incoming.callerName}</h3><p>{incoming.participantIds.length>2?`Group call · ${incoming.participantIds.length} invited`: 'Private one-to-one call'}</p><div className="private-incoming-actions"><button className="private-call-decline" onClick={declineCall}><PhoneOff size={17}/> DECLINE</button><button className="private-call-accept" onClick={()=>void acceptCall()}><Phone size={17}/> ACCEPT</button></div></div></div>}

    {activeCall&&<div className="private-active-call"><div className="private-active-call-head"><div><span>VOICE CALL</span><strong>{callStatus==='connected'?'Connected':callStatus==='calling'?'Calling…':'Connecting…'}</strong></div><button onClick={()=>void endCall()} title="End call" aria-label="End call"><PhoneOff size={18}/></button></div><div className="private-active-participants">{activeParticipants.map(id=><div key={id} className="private-active-person"><div className="private-active-avatar">{id===currentUserId?<Mic size={17}/>:<Users size={17}/>}</div><span>{id===currentUserId?'You':remoteNames[id]||'Member'}</span>{id!==currentUserId&&remoteStreams[id]&&<audio autoPlay playsInline ref={el=>{if(el&&el.srcObject!==remoteStreams[id])el.srcObject=remoteStreams[id]}}/>}</div>)}</div><div className="private-active-controls"><button onClick={toggleMute} className={muted?'active':''} title={muted?'Unmute microphone':'Mute microphone'}>{muted?<MicOff size={18}/>:<Mic size={18}/>}<span>{muted?'MIC OFF':'MIC ON'}</span></button><button className="danger" onClick={()=>void endCall()}><PhoneOff size={18}/><span>END</span></button></div></div>}
  </>;
}
