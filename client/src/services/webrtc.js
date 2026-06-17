import { RTCPeerConnection } from './webrtc_shims';

// Standard ICE servers configuration (using public Google STUN servers for development)
export const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
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
