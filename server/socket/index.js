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
    console.log(`⚡ Socket connected: ${socket.user.username} (${socket.id})`);

    // Join personal room for direct messages (like admission alerts)
    socket.join(socket.user._id.toString());

    // ── Room join ──────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomCode }) => {
      try {
        const room = await Room.findOne({ roomCode }).populate('participants', 'username email');
        if (!room) return socket.emit('error:message', { message: 'Room not found' });

        const isParticipant = room.participants.some((p) => p._id.equals(socket.user._id));
        if (!isParticipant) return socket.emit('error:message', { message: 'You are not a participant of this room' });

        socket.join(roomCode);
        socket.currentRoom = roomCode;

        socket.to(roomCode).emit('room:user-joined', { userId: socket.user._id, username: socket.user.username });
        socket.emit('room:joined', { roomCode, participants: room.participants });
      } catch (error) {
        socket.emit('error:message', { message: 'Failed to join room' });
      }
    });

    socket.on('room:request-join', ({ roomCode }) => {
      // Broadcast to the room so the admin can see the request
      socket.to(roomCode).emit('room:join-request', { userId: socket.user._id, username: socket.user.username });
    });

    socket.on('room:admit-user', ({ roomCode, userId }) => {
      // Direct message to the waiting user's personal room
      io.to(userId.toString()).emit('room:admitted', { roomCode });
    });

    socket.on('room:kick', async ({ roomCode, targetUserId }) => {
      try {
        await Room.findOneAndUpdate(
          { roomCode },
          { $pull: { participants: targetUserId } }
        );
        io.to(targetUserId.toString()).emit('room:kicked', { roomCode });
        socket.to(roomCode).emit('room:user-left', { userId: targetUserId });
      } catch (err) {
        console.error('Kick error:', err);
      }
    });

    // ── Room leave ─────────────────────────────────────────────────────────
    socket.on('room:leave', ({ roomCode }) => {
      socket.leave(roomCode);
      socket.currentRoom = null;
      socket.to(roomCode).emit('room:user-left', { userId: socket.user._id, username: socket.user.username });
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
