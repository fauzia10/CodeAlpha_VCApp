import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

// Global registry to map stream UUIDs to standard browser MediaStream objects
if (typeof window !== 'undefined') {
  window.webMediaStreams = window.webMediaStreams || new Map();
}

const wrapStream = (stream) => {
  if (stream && !stream.toURL) {
    const id = stream.id || Math.random().toString(36).substring(2);
    stream.toURL = () => id;
    if (typeof window !== 'undefined') {
      window.webMediaStreams.set(id, stream);
    }
  }
  return stream;
};

const mediaDevices = {
  getUserMedia: async (constraints) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('Media devices not available in this environment');
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return wrapStream(stream);
  },
  getDisplayMedia: async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('Media devices not available in this environment');
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    return wrapStream(stream);
  }
};

const RTCPeerConnection = typeof window !== 'undefined' ? (window.RTCPeerConnection || window.webkitRTCPeerConnection) : null;
const RTCIceCandidate = typeof window !== 'undefined' ? window.RTCIceCandidate : null;
const RTCSessionDescription = typeof window !== 'undefined' ? window.RTCSessionDescription : null;

// Standard web browser implementation for React Native Web video grids
const RTCView = ({ streamURL, stream, style, objectFit, mirror, muted = false }) => {
  const videoRef = useRef(null);

  const activeStream = stream || (typeof window !== 'undefined' && window.webMediaStreams
    ? window.webMediaStreams.get(streamURL)
    : null);

  useEffect(() => {
    if (videoRef.current && activeStream) {
      if (videoRef.current.srcObject !== activeStream) {
        videoRef.current.srcObject = activeStream;
      }
      videoRef.current.play().catch(err => console.warn('video play error', err));
    }
  }, [activeStream]);

  return (
    <View style={style}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        controls={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: objectFit || 'cover',
          transform: mirror ? 'scaleX(-1)' : 'none',
          backgroundColor: '#0f172a',
          border: 'none',
        }}
      />
    </View>
  );
};

const MediaStream = typeof window !== 'undefined' ? window.MediaStream : null;

export {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  wrapStream as wrapMediaStream,
  MediaStream
};
