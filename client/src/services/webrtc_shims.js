import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, MediaStream } from 'react-native-webrtc';

const wrapMediaStream = (stream) => stream;

export {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  wrapMediaStream,
  MediaStream
};
