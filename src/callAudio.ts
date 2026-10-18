let activeCallOwner: symbol | null = null;

const CALL_RINGTONE_REPEAT_MS = 2_800;
const CALL_RINGTONE_VOLUME = 0.16;
const incomingCallRingtoneOwners = new Set<symbol>();
let incomingCallAudioContext: AudioContext | null = null;
let incomingCallMasterGain: GainNode | null = null;
let incomingCallRingtoneTimer: number | null = null;
let incomingCallCloseTimer: number | null = null;

function playIncomingCallChime(context: AudioContext, masterGain: GainNode): void {
  if (context.state !== 'running') return;

  const firstNoteAt = context.currentTime + 0.02;
  [659.25, 783.99].forEach((frequency, index) => {
    const noteAt = firstNoteAt + index * 0.18;
    const noteEndsAt = noteAt + 0.22;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteAt);
    envelope.gain.setValueAtTime(0.0001, noteAt);
    envelope.gain.exponentialRampToValueAtTime(0.72, noteAt + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.0001, noteEndsAt);
    oscillator.connect(envelope);
    envelope.connect(masterGain);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(noteAt);
    oscillator.stop(noteEndsAt + 0.01);
  });
}

function ensureIncomingCallRingtone(): void {
  if (!incomingCallRingtoneOwners.size || typeof window === 'undefined') return;
  const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;
  if (incomingCallCloseTimer !== null) {
    window.clearTimeout(incomingCallCloseTimer);
    incomingCallCloseTimer = null;
  }

  try {
    if (!incomingCallAudioContext) {
      incomingCallAudioContext = new AudioContextConstructor();
      incomingCallMasterGain = incomingCallAudioContext.createGain();
      incomingCallMasterGain.gain.value = CALL_RINGTONE_VOLUME;
      incomingCallMasterGain.connect(incomingCallAudioContext.destination);
    }

    const context = incomingCallAudioContext;
    const masterGain = incomingCallMasterGain;
    if (!context || !masterGain) return;
    masterGain.gain.cancelScheduledValues(context.currentTime);
    masterGain.gain.setTargetAtTime(CALL_RINGTONE_VOLUME, context.currentTime, 0.025);
    void context.resume().then(() => {
      if (incomingCallAudioContext !== context || !incomingCallRingtoneOwners.size || incomingCallRingtoneTimer !== null) return;
      playIncomingCallChime(context, masterGain);
      incomingCallRingtoneTimer = window.setInterval(() => playIncomingCallChime(context, masterGain), CALL_RINGTONE_REPEAT_MS);
    }).catch(() => {
      // The browser may require a user gesture before it allows call audio.
    });
  } catch {
    // Keep incoming call controls usable if Web Audio is unavailable.
  }
}

export function startIncomingCallRingtone(owner: symbol, enabled: boolean): void {
  if (!enabled) {
    stopIncomingCallRingtone(owner);
    return;
  }
  incomingCallRingtoneOwners.add(owner);
  ensureIncomingCallRingtone();
}

export function stopIncomingCallRingtone(owner: symbol): void {
  incomingCallRingtoneOwners.delete(owner);
  if (incomingCallRingtoneOwners.size || typeof window === 'undefined') return;
  if (incomingCallRingtoneTimer !== null) {
    window.clearInterval(incomingCallRingtoneTimer);
    incomingCallRingtoneTimer = null;
  }

  const context = incomingCallAudioContext;
  const masterGain = incomingCallMasterGain;
  if (!context) return;
  if (masterGain && context.state === 'running') {
    masterGain.gain.cancelScheduledValues(context.currentTime);
    masterGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.025);
  }
  incomingCallCloseTimer = window.setTimeout(() => {
    incomingCallCloseTimer = null;
    if (incomingCallRingtoneOwners.size || incomingCallAudioContext !== context) return;
    incomingCallAudioContext = null;
    incomingCallMasterGain = null;
    void context.close().catch(() => {});
  }, 140);
}

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
