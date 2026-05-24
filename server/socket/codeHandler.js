const Room = require('../models/Room');

/**
 * Code collaboration handler
 * Events:
 *   code:change   — a participant has edited the code document
 *   code:sync     — a participant requests the current code state
 *   code:language — a participant changes the language mode
 */
module.exports = (io, socket) => {
  /**
   * code:change
   * Payload: { roomCode, code }
   * Broadcasts the updated code to all OTHER users in the room
   * and persists it to MongoDB.
   */
  const handleCodeChange = async ({ roomCode, code }) => {
    try {
      // Broadcast to others in the room
      socket.to(roomCode).emit('code:update', {
        code,
        userId: socket.user._id,
        username: socket.user.username,
      });

      // Persist to database
      await Room.findOneAndUpdate(
        { roomCode },
        { code },
        { new: true }
      );
    } catch (error) {
      console.error('code:change error:', error.message);
      socket.emit('error:message', { message: 'Failed to save code changes' });
    }
  };

  /**
   * code:sync
   * Payload: { roomCode }
   * Sends the current code state back to the requesting socket.
   */
  const handleCodeSync = async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode }).select('code language');

      if (room) {
        socket.emit('code:update', {
          code: room.code,
          language: room.language,
        });
      }
    } catch (error) {
      console.error('code:sync error:', error.message);
      socket.emit('error:message', { message: 'Failed to sync code' });
    }
  };

  /**
   * code:language
   * Payload: { roomCode, language }
   * Broadcasts language change and persists it.
   */
  const handleLanguageChange = async ({ roomCode, language }) => {
    try {
      socket.to(roomCode).emit('code:language', {
        language,
        userId: socket.user._id,
        username: socket.user.username,
      });

      await Room.findOneAndUpdate(
        { roomCode },
        { language },
        { new: true }
      );
    } catch (error) {
      console.error('code:language error:', error.message);
      socket.emit('error:message', { message: 'Failed to update language' });
    }
  };

  // Register event listeners
  socket.on('code:change', handleCodeChange);
  socket.on('code:sync', handleCodeSync);
  socket.on('code:language', handleLanguageChange);
};
