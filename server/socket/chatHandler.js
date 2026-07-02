const Room = require("../models/Room");

/**
 * Chat handler
 * Events:
 *   chat:send    — a participant sends a message
 *   chat:history — a participant requests the chat history
 */
module.exports = (io, socket) => {
  /**
   * chat:send
   * Payload: { roomCode, message }
   * Broadcasts the message to everyone in the room and persists it.
   */
  const handleSend = async ({ roomCode, message }) => {
    try {
      if (!message || !message.trim()) return;

      const chatMessage = {
        sender: socket.user._id,
        senderName: socket.user.username,
        message: message.trim(),
        timestamp: new Date(),
      };

      // Broadcast to ALL sockets in the room (including sender for confirmation)
      io.in(roomCode).emit("chat:receive", chatMessage);

      // Persist to database
      await Room.findOneAndUpdate(
        { roomCode },
        { $push: { chatHistory: chatMessage } },
      );
    } catch (error) {
      console.error("chat:send error:", error.message);
      socket.emit("error:message", { message: "Failed to send chat message" });
    }
  };

  /**
   * chat:history
   * Payload: { roomCode }
   * Sends the full chat history back to the requesting socket.
   */
  const handleHistory = async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode }).select("chatHistory");

      if (room) {
        socket.emit("chat:history", { messages: room.chatHistory });
      }
    } catch (error) {
      console.error("chat:history error:", error.message);
      socket.emit("error:message", { message: "Failed to load chat history" });
    }
  };

  // Register event listeners
  socket.on("chat:send", handleSend);
  socket.on("chat:history", handleHistory);
};
