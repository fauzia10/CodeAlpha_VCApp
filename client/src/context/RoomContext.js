import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { Alert } from 'react-native';
import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, wrapMediaStream, MediaStream } from '../services/webrtc_shims';
import { AuthContext } from './AuthContext';
import { initializeSocket } from '../services/socket';
import { peerConnectionConfig, isTurnConfigured } from '../services/webrtc';

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
  
  // Collaboration / Presentation State
  const [toasts, setToasts] = useState([]);
  const [presentationState, setPresentationState] = useState(null); // { type: 'screenshare'|'whiteboard', userId, username }
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const addToast = (message, icon = 'ℹ️', action = null, duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => {
      // Group whiteboard drawing events to prevent spam
      if (icon === '🖌️') {
        const existing = prev.find(t => t.icon === '🖌️' && t.message === message);
        if (existing) return prev; // Do not add duplicate drawing toasts
      }
      return [...prev, { id, message, icon, action, duration }];
    });
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };


  const socketRef = useRef(null);
  const peersRef = useRef({}); // Store RTCPeerConnections mapped by remote socketId
  const localStreamRef = useRef(null); // Reference to avoid stale state closures
  const screenStreamRef = useRef(null); // Store screen sharing stream reference
  const iceCandidateQueues = useRef({}); // Store queued ICE candidates mapped by senderSocketId

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState({
    socketStatus: 'disconnected',
    localStreamStatus: 'none',
    peers: {},
    errors: [],
  });

  const addDiagnosticsError = (message) => {
    setDiagnostics((prev) => ({
      ...prev,
      errors: [
        `${new Date().toLocaleTimeString()}: ${message}`,
        ...prev.errors.slice(0, 19), // Limit to last 20 errors
      ],
    }));
  };

  const clearDiagnosticsErrors = () => {
    setDiagnostics((prev) => ({
      ...prev,
      errors: [],
    }));
  };

  // Synchronize reference with localStream state
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Polling WebRTC stats and states for Diagnostics
  useEffect(() => {
    if (!roomId) return;
    
    const interval = setInterval(() => {
      const activeSocketIds = Object.keys(peersRef.current);
      
      setDiagnostics((prev) => {
        const updatedPeers = { ...prev.peers };
        let changed = false;
        
        Object.keys(updatedPeers).forEach((id) => {
          if (!activeSocketIds.includes(id)) {
            delete updatedPeers[id];
            changed = true;
          }
        });
        
        return changed ? { ...prev, peers: updatedPeers } : prev;
      });

      activeSocketIds.forEach((socketId) => {
        const pc = peersRef.current[socketId];
        if (pc) {
          setDiagnostics((prev) => {
            const updatedPeers = { ...prev.peers };
            const peer = updatedPeers[socketId] || {};
            
            if (
              peer.connectionState !== pc.connectionState ||
              peer.iceConnectionState !== pc.iceConnectionState
            ) {
              updatedPeers[socketId] = {
                ...peer,
                connectionState: pc.connectionState || 'new',
                iceConnectionState: pc.iceConnectionState || 'new',
              };
              return { ...prev, peers: updatedPeers };
            }
            return prev;
          });

          if (typeof pc.getStats === 'function') {
            pc.getStats()
              .then((stats) => {
                let activePair = null;
                stats.forEach((report) => {
                  if (
                    report.type === 'candidate-pair' &&
                    (report.nominated || report.state === 'succeeded')
                  ) {
                    activePair = report;
                  }
                });

                if (activePair) {
                  const localCandidate = stats.get(activePair.localCandidateId);
                  const remoteCandidate = stats.get(activePair.remoteCandidateId);

                  if (localCandidate) {
                    const lType = localCandidate.candidateType || 'unknown';
                    const rType = remoteCandidate ? remoteCandidate.candidateType || 'unknown' : 'unknown';
                    const turnUsed = lType === 'relay' || rType === 'relay';

                    console.log(`[Diagnostics] Active ICE candidate type for peer ${socketId} - Local: ${lType}, Remote: ${rType}. TURN relay used: ${turnUsed}`);

                    setDiagnostics((prev) => {
                      const updatedPeers = { ...prev.peers };
                      const peer = updatedPeers[socketId] || {};
                      
                      if (
                        peer.localCandidateType !== lType ||
                        peer.remoteCandidateType !== rType ||
                        peer.turnUsed !== turnUsed
                      ) {
                        updatedPeers[socketId] = {
                          ...peer,
                          localCandidateType: lType,
                          remoteCandidateType: rType,
                          turnUsed: turnUsed,
                        };
                        return { ...prev, peers: updatedPeers };
                      }
                      return prev;
                    });
                  }
                }
              })
              .catch((err) => {
                console.warn(`[Diagnostics] Failed to getStats for ${socketId}:`, err);
              });
          }
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [roomId]);

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
        setDiagnostics((prev) => ({
          ...prev,
          localStreamStatus: `active (${stream.getTracks().map(t => t.kind).join(', ')})`,
        }));
      } else {
        setDiagnostics((prev) => ({
          ...prev,
          localStreamStatus: 'none',
        }));
      }

      // 2. Initialize Socket.io connection
      setDiagnostics((prev) => ({ ...prev, socketStatus: 'connecting' }));
      const socket = initializeSocket(token);
      socketRef.current = socket;

      // 3. Socket event: On connect, join the specific room
      socket.on('connect', () => {
        console.log(`[Socket] Connected to signaling server with ID: ${socket.id}`);
        setDiagnostics((prev) => ({ ...prev, socketStatus: 'connected' }));
        socket.emit('join-room', {
          roomId,
          userId: user.id,
          username: user.username,
        });
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error', error);
        addDiagnosticsError(`Socket connect_error: ${error.message}`);
        setDiagnostics((prev) => ({ ...prev, socketStatus: 'error' }));
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected', reason);
        setDiagnostics((prev) => ({ ...prev, socketStatus: 'disconnected' }));
      });

      // 4. Socket event: Receive the list of existing users already in the room
      socket.on('room-participants', (otherPeers) => {
        console.log(`[Socket] Received room-participants: ${otherPeers.length} active peers`);
        setParticipants(otherPeers);

        // Initiate PeerConnection for each existing user (we are the offer initiator)
        otherPeers.forEach((peer) => {
          console.log(`[Socket] Initiating peer connection to existing peer: ${peer.username} (${peer.socketId})`);
          createPeerConnection(peer.socketId, true);
        });
      });

      // 5. Socket event: A new peer has joined the room
      socket.on('user-joined', ({ socketId, userId, username }) => {
        console.log(`[Socket] A new peer joined the room: ${username} on socket ${socketId}`);
        setParticipants((prev) => [...prev, { socketId, userId, username }]);
        addToast(`${username} joined the meeting`, '👋');

        // Wait for their offer (we are NOT the offer initiator)
        console.log(`[Socket] Preparing peer connection receiver for joining peer: ${username} (${socketId})`);
        createPeerConnection(socketId, false);
      });

      // 6. Socket event: Relay WebRTC SDP Offer
      socket.on('receive-offer', async ({ senderSocketId, sdp }) => {
        console.log(`[Socket] Received WebRTC SDP Offer from peer socket: ${senderSocketId}`);
        let pc = peersRef.current[senderSocketId];
        
        if (!pc) {
          console.warn(`[Socket] Peer connection for socket ${senderSocketId} not found, creating receiver peer connection...`);
          pc = createPeerConnection(senderSocketId, false);
        }

        try {
          console.log(`[WebRTC] Setting remote description (Offer) for peer socket: ${senderSocketId}`);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          
          console.log(`[WebRTC] Creating SDP Answer for peer socket: ${senderSocketId}`);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log(`[Socket] Sending WebRTC SDP Answer to peer socket: ${senderSocketId} from sender: ${socketRef.current.id}`);
          socketRef.current.emit('send-answer', {
            senderSocketId: socketRef.current.id,
            targetSocketId: senderSocketId,
            sdp: answer,
          });

          // Drain queued ICE candidates
          const queue = iceCandidateQueues.current[senderSocketId] || [];
          console.log(`[WebRTC] Draining ${queue.length} queued ICE candidates for peer socket: ${senderSocketId}`);
          while (queue.length > 0) {
            const cand = queue.shift();
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        } catch (err) {
          console.error(`[WebRTC] Failed to handle received SDP Offer from peer socket ${senderSocketId}:`, err);
          addDiagnosticsError(`Failed to set offer/create answer for ${senderSocketId}: ${err.message}`);
        }
      });

      // 7. Socket event: Relay WebRTC SDP Answer
      socket.on('receive-answer', async ({ senderSocketId, sdp }) => {
        console.log(`[Socket] Received WebRTC SDP Answer from peer socket: ${senderSocketId}`);
        const pc = peersRef.current[senderSocketId];
        if (pc) {
          try {
            console.log(`[WebRTC] Setting remote description (Answer) for peer socket: ${senderSocketId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));

            // Drain queued ICE candidates
            const queue = iceCandidateQueues.current[senderSocketId] || [];
            console.log(`[WebRTC] Draining ${queue.length} queued ICE candidates for peer socket: ${senderSocketId}`);
            while (queue.length > 0) {
              const cand = queue.shift();
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          } catch (err) {
            console.error(`[WebRTC] Failed to set remote description for peer socket ${senderSocketId}:`, err);
            addDiagnosticsError(`Failed to set answer for ${senderSocketId}: ${err.message}`);
          }
        } else {
          console.error(`[WebRTC] No peer connection found for incoming SDP Answer from peer socket: ${senderSocketId}`);
        }
      });

      // 8. Socket event: Relay WebRTC ICE Candidates
      socket.on('receive-ice-candidate', async ({ senderSocketId, candidate }) => {
        console.log(`[Socket] Received remote ICE Candidate from peer socket: ${senderSocketId}`);
        const pc = peersRef.current[senderSocketId];
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            console.log(`[WebRTC] Adding remote ICE Candidate to peer socket: ${senderSocketId}`);
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error(`[WebRTC] Failed to add remote ICE Candidate for peer socket ${senderSocketId}:`, err);
            addDiagnosticsError(`Failed to add ICE candidate for ${senderSocketId}: ${err.message}`);
          }
        } else {
          // Queue candidate if peer connection or remote description is not ready yet
          console.log(`[WebRTC] Peer connection or remote description not ready. Queueing remote ICE Candidate from peer socket: ${senderSocketId}`);
          iceCandidateQueues.current[senderSocketId] = iceCandidateQueues.current[senderSocketId] || [];
          iceCandidateQueues.current[senderSocketId].push(candidate);
        }
      });

      // 9. Socket event: A peer has left the room
      socket.on('user-left', ({ socketId, username }) => {
        console.log(`[Socket] Peer left/disconnected: ${username} (${socketId})`);
        addToast(`${username} left the meeting`, '🚪');
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

      // 12. Socket event: Generic Room Events
      socket.on('room-event-receive', ({ senderId, username, eventType, payload }) => {
        switch (eventType) {
          case 'screen-share-toggle':
            if (payload.isActive) {
              setPresentationState({ type: 'screenshare', userId: senderId, username });
              addToast(`${username} started screen sharing`, '💻', 'presentation');
            } else {
              setPresentationState(null);
              addToast(`${username} stopped screen sharing`, '💻');
            }
            break;
          case 'whiteboard-toggle':
            if (payload.isActive) {
              setPresentationState({ type: 'whiteboard', userId: senderId, username });
              addToast(`${username} opened the whiteboard`, '🎨', 'presentation');
            } else {
              setPresentationState(null);
              addToast(`${username} closed the whiteboard`, '🎨');
            }
            break;
          case 'whiteboard-drawing-state':
            addToast(`${username} is drawing`, '🖌️', null, 2000);
            break;
          case 'media-state-change':
            if (payload.type === 'audio') {
              addToast(`${username} ${payload.isMuted ? 'muted' : 'unmuted'} microphone`, payload.isMuted ? '🔇' : '🎤');
              setActiveSpeakerId(payload.isMuted ? null : senderId);
            }
            if (payload.type === 'video') {
              addToast(`${username} turned ${payload.isMuted ? 'off' : 'on'} camera`, payload.isMuted ? '🚫' : '📷');
            }
            break;
          default:
            break;
        }
      });

      // 13. Connect after registering all socket event handlers
      socket.connect();

    } catch (error) {
      console.error('Failed to start call session socket setup', error);
      addDiagnosticsError(`Session socket setup error: ${error.message}`);
      Alert.alert('Connection Error', 'Failed to establish signaling connection');
      setRoomId(null);
    }
  };

  // Instantiates an RTCPeerConnection for a remote peer
  const createPeerConnection = (targetSocketId, isOfferInitiator) => {
    console.log(`[WebRTC] Creating RTCPeerConnection for target socket: ${targetSocketId} (initiator: ${isOfferInitiator})`);
    
    const pc = new RTCPeerConnection(peerConnectionConfig);
    peersRef.current[targetSocketId] = pc;

    // Attach connectionState event listeners for detailed logging
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${targetSocketId} connectionState changed to: ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${targetSocketId} iceConnectionState changed to: ${pc.iceConnectionState}`);
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Peer ${targetSocketId} signalingState changed to: ${pc.signalingState}`);
    };

    // Attach ICE candidate error listener to log exact failure reason
    pc.onicecandidateerror = (event) => {
      console.warn(`[WebRTC] ICE Candidate error for peer ${targetSocketId}:`, event.errorCode, event.errorText);
      addDiagnosticsError(`ICE error for ${targetSocketId}: Code ${event.errorCode} - ${event.errorText || 'Server unreachable or credentials rejected'}`);
    };

    // Attach local stream tracks to the connection
    const currentStream = localStreamRef.current;
    if (currentStream) {
      console.log(`[WebRTC] Adding local tracks (${currentStream.getTracks().length}) to peer connection for target socket: ${targetSocketId}`);
      currentStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentStream);
      });
    } else {
      console.warn(`[WebRTC] Cannot add local tracks: localStream is empty for target socket: ${targetSocketId}`);
    }

    // Handle ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log(`[Socket] Sending local ICE Candidate to target socket: ${targetSocketId} from sender: ${socketRef.current.id}`);
        socketRef.current.emit('send-ice-candidate', {
          senderSocketId: socketRef.current.id,
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Handle receiving remote media tracks
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from socket: ${targetSocketId}, kind: ${event.track.kind}`);
      
      setRemoteStreams((prev) => {
        // 1. If the WebRTC stack provided a native-backed stream, use it directly
        if (event.streams && event.streams[0]) {
          console.log(`[WebRTC] Using native-backed MediaStream from event.streams[0] for socket: ${targetSocketId}`);
          return {
            ...prev,
            [targetSocketId]: wrapMediaStream(event.streams[0]),
          };
        }
        
        // 2. Fallback: Add track to existing stream, avoiding new MediaStream constructor
        const existingStream = prev[targetSocketId];
        if (existingStream) {
          const hasTrack = existingStream.getTracks().some((t) => t.id === event.track.id);
          if (!hasTrack) {
            console.log(`[WebRTC] Appending remote track to existing stream for socket: ${targetSocketId}`);
            existingStream.addTrack(event.track);
          }
          return {
            ...prev,
            [targetSocketId]: wrapMediaStream(existingStream),
          };
        } else {
          // Create a new stream and add the track
          console.log(`[WebRTC] Creating new fallback MediaStream for track kind: ${event.track.kind} from socket: ${targetSocketId}`);
          const newStream = new MediaStream();
          newStream.addTrack(event.track);
          return {
            ...prev,
            [targetSocketId]: wrapMediaStream(newStream),
          };
        }
      });
    };

    // If we are the connection initiator, generate SDP Offer immediately
    if (isOfferInitiator) {
      // Run async negotiation
      (async () => {
        try {
          console.log(`[WebRTC] Creating SDP Offer for target socket: ${targetSocketId}`);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socketRef.current) {
            console.log(`[Socket] Sending SDP Offer to target socket: ${targetSocketId} from sender: ${socketRef.current.id}`);
            socketRef.current.emit('send-offer', {
              senderSocketId: socketRef.current.id,
              targetSocketId,
              sdp: offer,
            });
          }
        } catch (err) {
          console.error(`[WebRTC] Failed to create local SDP offer for target socket ${targetSocketId}:`, err);
          addDiagnosticsError(`Failed to create offer for ${targetSocketId}: ${err.message}`);
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
        
        // Broadcast change
        if (socketRef.current && roomId) {
          socketRef.current.emit('room-event-broadcast', {
            roomId,
            eventType: 'media-state-change',
            payload: { type: 'audio', isMuted: !audioTrack.enabled }
          });
        }
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
        
        // Broadcast change
        if (socketRef.current && roomId) {
          socketRef.current.emit('room-event-broadcast', {
            roomId,
            eventType: 'media-state-change',
            payload: { type: 'video', isMuted: !videoTrack.enabled }
          });
        }
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
      setPresentationState(null);
      addToast('You stopped presenting', '💻');
      
      if (socketRef.current && roomId) {
        socketRef.current.emit('room-event-broadcast', {
          roomId,
          eventType: 'screen-share-toggle',
          payload: { isActive: false }
        });
      }
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
      setPresentationState({ type: 'screenshare', userId: 'local', username: 'You' });
      addToast('You are presenting', '💻');

      if (socketRef.current && roomId) {
        socketRef.current.emit('room-event-broadcast', {
          roomId,
          eventType: 'screen-share-toggle',
          payload: { isActive: true }
        });
      }
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

  const broadcastWhiteboardDrawing = () => {
    if (socketRef.current && roomId) {
      socketRef.current.emit('room-event-broadcast', {
        roomId,
        eventType: 'whiteboard-drawing-state',
        payload: { isDrawing: true }
      });
    }
  };

  const toggleWhiteboardState = (isActive) => {
    if (isActive) {
      setPresentationState({ type: 'whiteboard', userId: 'local', username: 'You' });
    } else if (presentationState?.type === 'whiteboard') {
      setPresentationState(null);
    }
    
    if (socketRef.current && roomId) {
      socketRef.current.emit('room-event-broadcast', {
        roomId,
        eventType: 'whiteboard-toggle',
        payload: { isActive }
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
        presentationState,
        activeSpeakerId,
        toasts,
        addToast,
        removeToast,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        sendMessage,
        sendFileMessage,
        sendWhiteboardData,
        broadcastWhiteboardDrawing,
        toggleWhiteboardState,
        leaveRoom,
        isTurnConfigured,
        socketRef,
        peersRef,
        lastMeetingSummary,
        setLastMeetingSummary,
        diagnostics,
        clearDiagnosticsErrors,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};
