import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { Alert } from 'react-native';
import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, wrapMediaStream } from '../services/webrtc_shims';
import { AuthContext } from './AuthContext';
import { initializeSocket } from '../services/socket';
import { peerConnectionConfig } from '../services/webrtc';

export const RoomContext = createContext();

export const RoomProvider = ({ children }) => {
  const { token, user } = useContext(AuthContext);

  const [roomId, setRoomId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [whiteboardLines, setWhiteboardLines] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [lastMeetingSummary, setLastMeetingSummary] = useState(null);

  const socketRef = useRef(null);
  const peersRef = useRef({}); // Store RTCPeerConnections mapped by remote socketId
  const localStreamRef = useRef(null); // Reference to avoid stale state closures
  const screenStreamRef = useRef(null); // Store screen sharing stream reference
  const iceCandidateQueues = useRef({}); // Store queued ICE candidates mapped by senderSocketId

  // Synchronize reference with localStream state
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Connect to call room when roomId changes
  useEffect(() => {
    if (roomId && token && user) {
      startCallSession();
    } else if (!roomId) {
      cleanupCallSession();
    }
  }, [roomId, token]);

  const startCallSession = async () => {
    try {
      console.log(`Starting media capture for room: ${roomId}`);
      
      // 1. Request user permission and capture local media (Audio + Video) with nested try-catch fallback
      let stream = null;
      try {
        stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: 'user',
            width: 640,
            height: 480,
            frameRate: 30,
          },
        });
      } catch (err) {
        console.warn('Failed to get media with strict constraints, trying fallback simpler settings:', err);
        try {
          stream = await mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        } catch (fallbackErr) {
          console.warn('Failed to get media with fallback settings, trying audio-only:', fallbackErr);
          try {
            stream = await mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
          } catch (audioErr) {
            console.warn('Failed to get audio, trying video-only:', audioErr);
            try {
              stream = await mediaDevices.getUserMedia({
                audio: false,
                video: true,
              });
            } catch (videoErr) {
              console.warn('No media access granted or available:', videoErr);
              // Handle permission failure gracefully - do not throw
              Alert.alert(
                'Media Access Info',
                'Camera and microphone could not be accessed. You will enter the room in text-and-whiteboard-only mode.'
              );
            }
          }
        }
      }

      if (stream) {
        setLocalStream(stream);
        localStreamRef.current = stream;
      }

      // 2. Initialize Socket.io connection
      const socket = initializeSocket(token);
      socketRef.current = socket;

      // 3. Socket event: On connect, join the specific room
      socket.on('connect', () => {
        console.log(`WebSocket connected: ${socket.id}`);
        socket.emit('join-room', {
          roomId,
          userId: user.id,
          username: user.username,
        });
      });

      // 4. Socket event: Receive the list of existing users already in the room
      socket.on('room-participants', (otherPeers) => {
        console.log(`Received room participants: ${otherPeers.length} active peers`);
        setParticipants(otherPeers);

        // Initiate PeerConnection for each existing user (we are the offer initiator)
        otherPeers.forEach((peer) => {
          createPeerConnection(peer.socketId, true);
        });
      });

      // 5. Socket event: A new peer has joined the room
      socket.on('user-joined', ({ socketId, userId, username }) => {
        console.log(`Peer joined: ${username} on socket ${socketId}`);
        setParticipants((prev) => [...prev, { socketId, userId, username }]);

        // Wait for their offer (we are NOT the offer initiator)
        createPeerConnection(socketId, false);
      });

      // 6. Socket event: Relay WebRTC SDP Offer
      socket.on('receive-offer', async ({ senderSocketId, sdp }) => {
        console.log(`Received SDP offer from peer socket: ${senderSocketId}`);
        let pc = peersRef.current[senderSocketId];
        
        if (!pc) {
          pc = createPeerConnection(senderSocketId, false);
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socketRef.current.emit('send-answer', {
            targetSocketId: senderSocketId,
            sdp: answer,
          });

          // Drain queued ICE candidates
          const queue = iceCandidateQueues.current[senderSocketId] || [];
          while (queue.length > 0) {
            const cand = queue.shift();
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        } catch (err) {
          console.error('Failed to set remote offer or create answer', err);
        }
      });

      // 7. Socket event: Relay WebRTC SDP Answer
      socket.on('receive-answer', async ({ senderSocketId, sdp }) => {
        console.log(`Received SDP answer from peer socket: ${senderSocketId}`);
        const pc = peersRef.current[senderSocketId];
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));

            // Drain queued ICE candidates
            const queue = iceCandidateQueues.current[senderSocketId] || [];
            while (queue.length > 0) {
              const cand = queue.shift();
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          } catch (err) {
            console.error('Failed to set remote answer description', err);
          }
        }
      });

      // 8. Socket event: Relay WebRTC ICE Candidates
      socket.on('receive-ice-candidate', async ({ senderSocketId, candidate }) => {
        console.log(`Received ICE Candidate from peer socket: ${senderSocketId}`);
        const pc = peersRef.current[senderSocketId];
        if (pc) {
          try {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              // Queue candidate if remote description is not set yet
              iceCandidateQueues.current[senderSocketId] = iceCandidateQueues.current[senderSocketId] || [];
              iceCandidateQueues.current[senderSocketId].push(candidate);
            }
          } catch (err) {
            console.error('Failed to add remote ICE Candidate', err);
          }
        }
      });

      // 9. Socket event: A peer has left the room
      socket.on('user-left', ({ socketId, username }) => {
        console.log(`Peer disconnected/left: ${username} (${socketId})`);
        closePeerConnection(socketId);
      });

      // 10. Socket event: Receive Chat Messages
      socket.on('chat-message-receive', (messageObject) => {
        setMessages((prev) => [...prev, messageObject]);
      });

      // 11. Socket event: Receive Whiteboard Drawings
      socket.on('draw-data-receive', (lines) => {
        setWhiteboardLines(lines);
      });

      // 12. Connect after registering all socket event handlers
      socket.connect();

    } catch (error) {
      console.error('Failed to start call session socket setup', error);
      Alert.alert('Connection Error', 'Failed to establish signaling connection');
      setRoomId(null);
    }
  };

  // Instantiates an RTCPeerConnection for a remote peer
  const createPeerConnection = (targetSocketId, isOfferInitiator) => {
    console.log(`Creating RTCPeerConnection for target socket: ${targetSocketId} (initiator: ${isOfferInitiator})`);
    
    const pc = new RTCPeerConnection(peerConnectionConfig);
    peersRef.current[targetSocketId] = pc;

    // Attach local stream tracks to the connection
    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentStream);
      });
    }

    // Handle ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('send-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Handle receiving remote media tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        console.log(`Received remote track stream for socket: ${targetSocketId}`);
        const remoteStream = wrapMediaStream(event.streams[0]);
        setRemoteStreams((prev) => ({
          ...prev,
          [targetSocketId]: remoteStream,
        }));
      }
    };

    // If we are the connection initiator, generate SDP Offer immediately
    if (isOfferInitiator) {
      // Run async negotiation
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socketRef.current) {
            socketRef.current.emit('send-offer', {
              targetSocketId,
              sdp: offer,
            });
          }
        } catch (err) {
          console.error('Failed to create local SDP offer', err);
        }
      })();
    }

    return pc;
  };

  // Tears down connection with a specific peer
  const closePeerConnection = (socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
      delete peersRef.current[socketId];
    }

    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });

    setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
  };

  // Full clean up on leaving a call
  const cleanupCallSession = () => {
    console.log('Cleaning up active call session');

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    Object.keys(peersRef.current).forEach((socketId) => {
      peersRef.current[socketId].close();
    });
    peersRef.current = {};
    iceCandidateQueues.current = {};

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setRoomId(null);
    setRemoteStreams({});
    setParticipants([]);
    setMessages([]);
    setWhiteboardLines([]);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
  };

  const leaveRoom = () => {
    // Notify server we are leaving
    if (socketRef.current && roomId) {
      socketRef.current.emit('leave-room', { roomId });
    }
    
    // Also notify DB via REST API
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000';
    if (roomId && token) {
      fetch(`${API_URL}/api/rooms/${roomId.toLowerCase()}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }).catch((err) => console.error('Failed to notify database of room exit:', err));
    }
    
    cleanupCallSession();
  };

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }

      let freshCameraTrack = null;
      try {
        // Get fresh camera stream track (video only, keep existing audio if any)
        const freshCameraStream = await mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user' },
        });
        freshCameraTrack = freshCameraStream.getVideoTracks()[0];
      } catch (camErr) {
        console.warn('Could not restore camera track after screen sharing stopped:', camErr);
      }

      // Replace track in localStream
      const currentLocalStream = localStreamRef.current;
      if (currentLocalStream && freshCameraTrack) {
        const oldVideoTrack = currentLocalStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          currentLocalStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        currentLocalStream.addTrack(freshCameraTrack);
        setLocalStream(currentLocalStream);
      } else if (currentLocalStream && !freshCameraTrack) {
        // Stop and remove the screen video track from current stream
        const oldVideoTrack = currentLocalStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          currentLocalStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        // If stream has no remaining tracks (e.g. no audio either), clear it completely
        if (currentLocalStream.getTracks().length === 0) {
          setLocalStream(null);
          localStreamRef.current = null;
        } else {
          setLocalStream(currentLocalStream);
        }
      }

      // Replace track in all active RTCPeerConnections
      await Promise.all(
        Object.keys(peersRef.current).map(async (socketId) => {
          const pc = peersRef.current[socketId];
          if (pc && typeof pc.getSenders === 'function') {
            const senders = pc.getSenders();
            const sender = senders.find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              await sender.replaceTrack(freshCameraTrack);
            }
          }
        })
      );

      setIsScreenSharing(false);
    } catch (err) {
      console.error('Error stopping screen share', err);
    }
  };

  const startScreenShare = async () => {
    try {
      console.log('Requesting screen capture...');
      const screenStream = await mediaDevices.getDisplayMedia();
      screenStreamRef.current = screenStream;
      const screenVideoTrack = screenStream.getVideoTracks()[0];

      // Fallback listener in case user stops sharing from native OS controls
      screenVideoTrack.onended = () => {
        stopScreenShare();
      };

      // Replace track in localStream
      const currentLocalStream = localStreamRef.current;
      if (currentLocalStream) {
        const oldVideoTrack = currentLocalStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          currentLocalStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        currentLocalStream.addTrack(screenVideoTrack);
        setLocalStream(currentLocalStream);
      } else {
        // If there was no stream, initialize localStream to screenStream
        setLocalStream(screenStream);
        localStreamRef.current = screenStream;
      }

      // Replace track in all active RTCPeerConnections
      await Promise.all(
        Object.keys(peersRef.current).map(async (socketId) => {
          const pc = peersRef.current[socketId];
          if (pc && typeof pc.getSenders === 'function') {
            const senders = pc.getSenders();
            const sender = senders.find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              await sender.replaceTrack(screenVideoTrack);
            }
          }
        })
      );

      setIsScreenSharing(true);
    } catch (err) {
      console.error('Error starting screen share', err);
      Alert.alert('Screen Share Error', 'Could not access screen capture');
    }
  };

  const toggleScreenShare = async () => {
    if (screenStreamRef.current) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  const sendMessage = (text) => {
    if (!text || !text.trim()) return;
    if (socketRef.current && roomId) {
      socketRef.current.emit('chat-message-send', {
        roomId,
        message: {
          content: text.trim(),
          messageType: 'text',
        },
      });
    }
  };

  const sendFileMessage = (fileName, fileSize, mimeType, downloadUrl) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit('chat-message-send', {
        roomId,
        message: {
          content: `Shared a file: ${fileName}`,
          messageType: 'file',
          fileMetadata: {
            fileName,
            fileSize,
            mimeType,
            downloadUrl,
          },
        },
      });
    }
  };

  const sendWhiteboardData = (lines) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit('draw-data-send', {
        roomId,
        drawData: lines,
      });
    }
  };

  return (
    <RoomContext.Provider
      value={{
        roomId,
        setRoomId,
        localStream,
        setLocalStream,
        remoteStreams,
        setRemoteStreams,
        participants,
        setParticipants,
        messages,
        setMessages,
        whiteboardLines,
        setWhiteboardLines,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        sendMessage,
        sendFileMessage,
        sendWhiteboardData,
        leaveRoom,
        socketRef,
        peersRef,
        lastMeetingSummary,
        setLastMeetingSummary,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};
