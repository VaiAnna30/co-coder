const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');

// Sub-handlers
const registerCodeHandler = require('./codeHandler');
const registerWhiteboardHandler = require('./whiteboardHandler');
const registerChatHandler = require('./chatHandler');
const registerVideoHandler = require('./videoHandler');

/**
 * Initialise Socket.io on the given HTTP server.
 * - Adds JWT authentication middleware on every connection.
 * - Registers room join/leave logic.
 * - Delegates feature-specific events to sub-handler modules.
 *
 * @param {http.Server} httpServer — the Node HTTP server instance
 * @returns {Server} the Socket.io server instance
 */
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // tighten in production
      methods: ['GET', 'POST'],
    },
  });

  // ─── JWT Authentication Middleware ────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error — no token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('Authentication error — user not found'));
      }

      // Attach user to the socket for downstream handlers
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Authentication error — token invalid or expired'));
    }
  });

  // ─── Connection Handler ──────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(
      `⚡ Socket connected: ${socket.user.username} (${socket.id})`
    );

    // ── Room join ──────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomCode }) => {
      try {
        const room = await Room.findOne({ roomCode })
          .populate('participants', 'username email');

        if (!room) {
          return socket.emit('error:message', { message: 'Room not found' });
        }

        // Verify user is a participant
        const isParticipant = room.participants.some((p) =>
          p._id.equals(socket.user._id)
        );

        if (!isParticipant) {
          return socket.emit('error:message', {
            message: 'You are not a participant of this room',
          });
        }

        // Join the Socket.io room
        socket.join(roomCode);

        // Store the current room on the socket for cleanup on disconnect
        socket.currentRoom = roomCode;

        console.log(
          `📌 ${socket.user.username} joined room ${roomCode}`
        );

        // Notify others in the room
        socket.to(roomCode).emit('room:user-joined', {
          userId: socket.user._id,
          username: socket.user.username,
        });

        // Send participant list to the joining user
        socket.emit('room:joined', {
          roomCode,
          participants: room.participants,
        });
      } catch (error) {
        console.error('room:join error:', error.message);
        socket.emit('error:message', { message: 'Failed to join room' });
      }
    });

    // ── Room leave ─────────────────────────────────────────────────────────
    socket.on('room:leave', ({ roomCode }) => {
      socket.leave(roomCode);
      socket.currentRoom = null;

      console.log(
        `📤 ${socket.user.username} left room ${roomCode}`
      );

      socket.to(roomCode).emit('room:user-left', {
        userId: socket.user._id,
        username: socket.user.username,
      });
    });

    // ── Register sub-handlers ──────────────────────────────────────────────
    registerCodeHandler(io, socket);
    registerWhiteboardHandler(io, socket);
    registerChatHandler(io, socket);
    registerVideoHandler(io, socket);

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(
        `🔌 Socket disconnected: ${socket.user.username} (${socket.id})`
      );

      // If the user was in a room, notify others
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('room:user-left', {
          userId: socket.user._id,
          username: socket.user.username,
        });
      }
    });
  });

  return io;
};

module.exports = initSocket;
