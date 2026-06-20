import { RTCPeerConnection } from './webrtc_shims';

// Standard ICE servers configuration (using public Google STUN servers and openrelay TURN/STUN for NAT/firewall traversal)
export const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'f35743f912d940b8b0508f83',
      credential: 'YzB7dMezWkx60I9Q'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'f35743f912d940b8b0508f83',
      credential: 'YzB7dMezWkx60I9Q'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'f35743f912d940b8b0508f83',
      credential: 'YzB7dMezWkx60I9Q'
    }
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
