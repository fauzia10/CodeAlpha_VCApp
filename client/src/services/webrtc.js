import { RTCPeerConnection } from './webrtc_shims';

// Dynamic ICE servers configuration (supporting both VITE_ and EXPO_PUBLIC_ prefixes)
const turnUrl = process.env.EXPO_PUBLIC_TURN_URL || process.env.VITE_TURN_URL || '';
const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME || process.env.VITE_TURN_USERNAME || '';
const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL || process.env.VITE_TURN_CREDENTIAL || '';

export const isTurnConfigured = turnUrl !== '' && turnUsername !== '' && turnCredential !== '';

console.log(`[WebRTC] TURN configured: ${isTurnConfigured}`);
console.log(`[WebRTC] TURN URL count: ${isTurnConfigured ? 1 : 0}`);

export const peerConnectionConfig = {
  get iceServers() {
    const servers = [
      { urls: 'stun:74.125.250.129:19302' }, // IP for stun.l.google.com
      { urls: 'stun:142.250.14.127:19302' }, // IP for stun1.l.google.com
      { urls: 'stun:142.250.136.127:19302' } // IP for stun2.l.google.com
    ];
    if (isTurnConfigured) {
      // On highly restrictive networks, UDP is dropped. We force TCP to ensure successful relay.
      const tcpUrl = turnUrl.includes(':80') ? turnUrl.replace(':80', ':443') + '?transport=tcp' : turnUrl + '?transport=tcp';
      servers.push(
        {
          urls: tcpUrl,
          username: turnUsername,
          credential: turnCredential
        }
      );
    }
    return servers;
  }
};

/**
 * Creates a new RTCPeerConnection instance
 * @param {Function} onIceCandidate - Event handler for ICE candidates
 * @param {Function} onTrack - Event handler for remote tracks
 * @returns {RTCPeerConnection}
 */
export const createPeerConnection = (onIceCandidate, onTrack) => {
  const pc = new RTCPeerConnection(peerConnectionConfig);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      onTrack(event.streams[0]);
    }
  };

  return pc;
};
