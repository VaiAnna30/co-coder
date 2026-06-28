const Room = require('../models/Room');

module.exports = (io, socket) => {
  // Legacy support for single-file editor (for backwards compatibility if needed)
  const handleCodeChange = async ({ roomCode, code }) => {
    try {
      socket.to(roomCode).emit('code:update', { code, userId: socket.user._id, username: socket.user.username });
      await Room.findOneAndUpdate({ roomCode }, { code }, { new: true });
    } catch (error) {
      console.error('code:change error:', error.message);
    }
  };

  const handleCodeSync = async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode }).select('code language files');
      if (room) {
        // Send both legacy code and new files array
        socket.emit('code:sync', {
          code: room.code,
          language: room.language,
          files: Array.isArray(room.files) && room.files.length > 0 
            ? room.files 
            : (Array.isArray(room.files) && room.files.length === 0 ? [] : [{ id: '1', name: 'main.js', language: room.language || 'javascript', content: room.code }])
        });
      }
    } catch (error) {
      console.error('code:sync error:', error.message);
    }
  };

  const handleLanguageChange = async ({ roomCode, language }) => {
    try {
      socket.to(roomCode).emit('code:language', { language, userId: socket.user._id, username: socket.user.username });
      await Room.findOneAndUpdate({ roomCode }, { language }, { new: true });
    } catch (error) {
      console.error('code:language error:', error.message);
    }
  };

  // --- NEW FILE SYSTEM EVENTS ---

  const handleFileChange = async ({ roomCode, fileId, content }) => {
    try {
      // Broadcast to others
      socket.to(roomCode).emit('file:change', { fileId, content, userId: socket.user._id, username: socket.user.username });
      // Update DB
      await Room.findOneAndUpdate(
        { roomCode, 'files.id': fileId },
        { $set: { 'files.$.content': content } }
      );
    } catch (error) {
      console.error('file:change error:', error.message);
    }
  };

  const handleFileCreate = async ({ roomCode, file }) => {
    try {
      const room = await Room.findOneAndUpdate(
        { roomCode },
        { $push: { files: file } },
        { new: true }
      );
      socket.to(roomCode).emit('file:create', { file, userId: socket.user._id, username: socket.user.username });
    } catch (error) {
      console.error('file:create error:', error.message);
    }
  };

  const handleFileDelete = async ({ roomCode, fileId }) => {
    try {
      await Room.findOneAndUpdate(
        { roomCode },
        { $pull: { files: { id: fileId } } }
      );
      socket.to(roomCode).emit('file:delete', { fileId, userId: socket.user._id, username: socket.user.username });
    } catch (error) {
      console.error('file:delete error:', error.message);
    }
  };

  const handleFileRename = async ({ roomCode, fileId, newName, newLanguage }) => {
    try {
      await Room.findOneAndUpdate(
        { roomCode, 'files.id': fileId },
        { $set: { 'files.$.name': newName, 'files.$.language': newLanguage } }
      );
      socket.to(roomCode).emit('file:rename', { fileId, newName, newLanguage, userId: socket.user._id, username: socket.user.username });
    } catch (error) {
      console.error('file:rename error:', error.message);
    }
  };

  // Register event listeners
  socket.on('code:change', handleCodeChange);
  socket.on('code:sync', handleCodeSync);
  socket.on('code:language', handleLanguageChange);
  
  socket.on('file:change', handleFileChange);
  socket.on('file:create', handleFileCreate);
  socket.on('file:delete', handleFileDelete);
  socket.on('file:rename', handleFileRename);
};
