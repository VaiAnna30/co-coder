const Room = require('../models/Room');

/**
 * Whiteboard collaboration handler
 * Events:
 *   wb:draw  — a participant draws a new stroke
 *   wb:sync  — a participant requests all current strokes
 *   wb:clear — admin clears the entire whiteboard
 */
module.exports = (io, socket) => {
  /**
   * wb:draw
   * Payload: { roomCode, stroke }
   *   stroke: { strokeId, tool, color, width, points }
   * Broadcasts the stroke to others and appends it to the DB.
   */
  const handleDraw = async ({ roomCode, stroke }) => {
    try {
      // Attach the sender's userId
      const fullStroke = {
        ...stroke,
        userId: socket.user._id,
      };

      // Broadcast to others
      socket.to(roomCode).emit('wb:update', fullStroke);

      // Persist stroke to database
      await Room.findOneAndUpdate(
        { roomCode },
        { $push: { whiteboardData: fullStroke } }
      );
    } catch (error) {
      console.error('wb:draw error:', error.message);
      socket.emit('error:message', { message: 'Failed to save whiteboard stroke' });
    }
  };

  /**
   * wb:sync
   * Payload: { roomCode }
   * Sends all existing strokes back to the requesting socket.
   */
  const handleSync = async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode }).select('whiteboardData');

      if (room) {
        socket.emit('wb:sync', { strokes: room.whiteboardData });
      }
    } catch (error) {
      console.error('wb:sync error:', error.message);
      socket.emit('error:message', { message: 'Failed to sync whiteboard' });
    }
  };

  /**
   * wb:clear
   * Payload: { roomCode }
   * Clears all strokes for the room (broadcast + persist).
   */
  const handleClear = async ({ roomCode }) => {
    try {
      // Broadcast clear to everyone in the room (including sender)
      io.in(roomCode).emit('wb:clear');

      // Remove all strokes from DB
      await Room.findOneAndUpdate(
        { roomCode },
        { whiteboardData: [] }
      );
    } catch (error) {
      console.error('wb:clear error:', error.message);
      socket.emit('error:message', { message: 'Failed to clear whiteboard' });
    }
  };

  // Register event listeners
  socket.on('wb:draw', handleDraw);
  socket.on('wb:sync', handleSync);
  socket.on('wb:clear', handleClear);
};
