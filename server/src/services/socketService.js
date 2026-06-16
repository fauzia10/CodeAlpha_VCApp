const socketIo = require('socket.io');

/**
 * Initializes Socket.io signaling server
 * @param {http.Server} server - Node HTTP server instance
 */
const initSocketService = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: '*', // Allow connections from any origin (development)
      methods: ['GET', 'POST'],
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
    });

    // WebRTC Signaling: Forward SDP Offer to target peer
    socket.on('send-offer', ({ targetSocketId, sdp }) => {
      console.log(`Forwarding SDP Offer from ${socket.id} to ${targetSocketId}`);
      io.to(targetSocketId).emit('receive-offer', {
        senderSocketId: socket.id,
        sdp,
      });
    });

    // WebRTC Signaling: Forward SDP Answer to target peer
    socket.on('send-answer', ({ targetSocketId, sdp }) => {
      console.log(`Forwarding SDP Answer from ${socket.id} to ${targetSocketId}`);
      io.to(targetSocketId).emit('receive-answer', {
        senderSocketId: socket.id,
        sdp,
      });
    });

    // WebRTC Signaling: Forward ICE Candidate to target peer
    socket.on('send-ice-candidate', ({ targetSocketId, candidate }) => {
      console.log(`Forwarding ICE Candidate from ${socket.id} to ${targetSocketId}`);
      io.to(targetSocketId).emit('receive-ice-candidate', {
        senderSocketId: socket.id,
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

    // Real-time Collaborative Whiteboard Sync
    socket.on('draw-data-send', ({ roomId, drawData }) => {
      // Broadcast drawings to other participants in the room
      socket.to(roomId).emit('draw-data-receive', drawData);
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
      }
    });
  });

  return io;
};

module.exports = initSocketService;
