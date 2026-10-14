let activeCallOwner: symbol | null = null;

export function claimVoiceCall(owner: symbol): boolean {
  if (activeCallOwner && activeCallOwner !== owner) return false;
  activeCallOwner = owner;
  return true;
}

export function releaseVoiceCall(owner: symbol): void {
  if (activeCallOwner === owner) activeCallOwner = null;
}

export function ownsVoiceCall(owner: symbol): boolean {
  return activeCallOwner === owner;
}

export type PendingCallIce = Map<string, RTCIceCandidateInit[]>;

export function queueCallIceCandidate(queue: PendingCallIce, peerId: string, candidate: RTCIceCandidateInit): void {
  const pending = queue.get(peerId) ?? [];
  if (pending.length >= 64) return;
  pending.push(candidate);
  queue.set(peerId, pending);
}

export async function flushCallIceCandidates(queue: PendingCallIce, peerId: string, peer: RTCPeerConnection): Promise<void> {
  const pending = queue.get(peerId);
  if (!pending?.length) return;
  queue.delete(peerId);
  for (const candidate of pending) {
    try { await peer.addIceCandidate(candidate); } catch { /* Ignore candidates invalidated by a remote ICE restart. */ }
  }
}

export async function requestVoiceCallStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Voice calls are not supported by this browser.');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      channelCount: 1,
    },
    video: false,
  });
  const liveAudioTracks = stream.getAudioTracks().filter(track => track.readyState === 'live');
  if (liveAudioTracks.length !== 1) {
    stream.getTracks().forEach(track => track.stop());
    throw new Error('The call needs exactly one active microphone track. Check your microphone settings and retry.');
  }
  return stream;
}
