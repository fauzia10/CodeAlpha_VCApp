const socketIo = require('socket.io');

// Store whiteboard drawing history in-memory mapped by roomId
const roomWhiteboards = new Map();

/**
 * Initializes Socket.io signaling server
 * @param {http.Server} server - Node HTTP server instance
 */
const initSocketService = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: function (origin, callback) {
        // Allow connections from anywhere when no origin is provided (like native mobile apps)
        if (!origin) return callback(null, true);
        
        const isAllowed = 
          origin === 'https://codealpha-vcapp-8eh5.onrender.com' ||
          origin.endsWith('.onrender.com') ||
          origin.startsWith('http://localhost:') ||
          origin === 'http://10.0.2.2:5000';
          
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by Socket.IO CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Secure connection: Authenticate handshake token via JWT
  const jwt = require('jsonwebtoken');
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'supersecretcodealphaprivatekeyforjsonwebtoken'
      );
      socket.authUserId = decoded.id; // Store authenticated ID
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid signature'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User requests to join a meeting room
    socket.on('join-room', ({ roomId, userId, username }) => {
      // Set socket metadata
      socket.roomId = roomId;
      socket.userId = userId;
      socket.username = username;

      // Join the socket channel for this room
      socket.join(roomId);
      console.log(`User ${username} (${userId}) joined room: ${roomId} on socket: ${socket.id}`);

      // Find other participants in the room
      const room = io.sockets.adapter.rooms.get(roomId);
      const otherUsers = [];

      if (room) {
        for (const socketId of room) {
          if (socketId !== socket.id) {
            const clientSocket = io.sockets.sockets.get(socketId);
            otherUsers.push({
              socketId: clientSocket.id,
              userId: clientSocket.userId,
              username: clientSocket.username,
            });
          }
        }
      }

      // 1. Send the lists of current active peers back to the newly joined client
      socket.emit('room-participants', otherUsers);

      // 2. Alert existing clients in the room that a new peer has joined
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId,
        username,
      });

      // 3. Send current whiteboard drawing data to the newly joined peer
      const currentDrawData = roomWhiteboards.get(roomId.toLowerCase()) || [];
      socket.emit('draw-data-receive', currentDrawData);
    });

    // WebRTC Signaling: Forward SDP Offer to target peer
    socket.on('send-offer', ({ senderSocketId, targetSocketId, sdp }) => {
      const fromId = senderSocketId || socket.id;
      console.log(`Forwarding SDP Offer from ${fromId} to ${targetSocketId}`);
      io.to(targetSocketId).emit('receive-offer', {
        senderSocketId: fromId,
        sdp,
      });
    });

    // WebRTC Signaling: Forward SDP Answer to target peer
    socket.on('send-answer', ({ senderSocketId, targetSocketId, sdp }) => {
      const fromId = senderSocketId || socket.id;
      console.log(`Forwarding SDP Answer from ${fromId} to ${targetSocketId}`);
      io.to(targetSocketId).emit('receive-answer', {
        senderSocketId: fromId,
        sdp,
      });
    });

    // WebRTC Signaling: Forward ICE Candidate to target peer
    socket.on('send-ice-candidate', ({ senderSocketId, targetSocketId, candidate }) => {
      const fromId = senderSocketId || socket.id;
      console.log(`Forwarding ICE Candidate from ${fromId} to ${targetSocketId}`);
      io.to(targetSocketId).emit('receive-ice-candidate', {
        senderSocketId: fromId,
        candidate,
      });
    });

    // Real-time Chat Messaging
    socket.on('chat-message-send', ({ roomId, message }) => {
      console.log(`Broadcasting chat message in room ${roomId} from ${socket.username}`);
      // Send message details to everyone in the room
      io.to(roomId).emit('chat-message-receive', {
        senderId: socket.userId,
        username: socket.username,
        content: message.content,
        messageType: message.messageType || 'text',
        fileMetadata: message.fileMetadata || null,
        createdAt: new Date().toISOString(),
      });
    });

    // Real-time Collaborative Whiteboard Sync (Bulk Data)
    socket.on('draw-data-send', ({ roomId, drawData }) => {
      roomWhiteboards.set(roomId.toLowerCase(), drawData);
      socket.to(roomId).emit('draw-data-receive', drawData);
    });

    // Explicit UI Activity Events
    const broadcastExplicitEvent = (eventName, payload) => {
      if (!socket.roomId) return;
      socket.to(socket.roomId).emit(eventName, {
        roomId: socket.roomId,
        senderSocketId: socket.id,
        senderName: socket.username,
        timestamp: new Date().toISOString(),
        ...payload
      });
    };

    socket.on('meeting:activity', (payload) => broadcastExplicitEvent('meeting:activity', payload));
    socket.on('chat:message', (payload) => broadcastExplicitEvent('chat:message', payload));
    socket.on('whiteboard:opened', (payload) => broadcastExplicitEvent('whiteboard:opened', payload));
    socket.on('whiteboard:drawing', (payload) => broadcastExplicitEvent('whiteboard:drawing', payload));
    socket.on('screen-share:started', (payload) => broadcastExplicitEvent('screen-share:started', payload));
    socket.on('screen-share:stopped', (payload) => broadcastExplicitEvent('screen-share:stopped', payload));

    // Generic Room Event Broadcast (Legacy compatibility)
    socket.on('room-event-broadcast', ({ roomId, eventType, payload }) => {
      // Relay event to other participants in the room
      socket.to(roomId).emit('room-event-receive', {
        senderId: socket.userId,
        username: socket.username,
        eventType,
        payload,
        timestamp: new Date().toISOString()
      });
    });

    // Handle user disconnects
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      const { roomId, userId, username } = socket;
      
      if (roomId) {
        console.log(`User ${username} (${userId}) left room: ${roomId}`);
        // Notify other peers in the room that this user disconnected
        socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          userId,
          username,
        });

        // Cleanup room drawings if the room is empty
        const room = io.sockets.adapter.rooms.get(roomId);
        if (!room || room.size === 0) {
          roomWhiteboards.delete(roomId.toLowerCase());
          console.log(`Room ${roomId} is empty; cleared whiteboard cache`);
        }
      }
    });
  });

  return io;
};

module.exports = initSocketService;
