import io from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://10.0.2.2:5000';

/**
 * Initializes a new Socket.io connection
 * @param {string} token - JWT authentication token
 * @returns {Socket} - Socket.io client instance
 */
export const initializeSocket = (token) => {
  return io(SOCKET_URL, {
    auth: {
      token,
    },
    autoConnect: false, // Manage connection explicitly
    transports: ['websocket', 'polling'], // Allow polling fallback for Render cold starts
  });
};
