/**
 * Video / WebRTC signaling handler
 * This module handles ONLY the signaling layer — actual media streams
 * flow peer-to-peer between clients. No media data touches the server.
 *
 * Events:
 *   video:join          — user wants to join the video call in a room
 *   video:offer         — SDP offer forwarded to a specific peer
 *   video:answer        — SDP answer forwarded back to the offerer
 *   video:ice-candidate — ICE candidate forwarded to a specific peer
 *   video:leave         — user leaves the video call
 */
module.exports = (io, socket) => {
  const handleJoin = ({ roomCode }) => {
    socket.to(roomCode).emit('video:join', { peerId: socket.user._id });
  };

  const handleOffer = ({ roomCode, peerId, signal }) => {
    // peerId is the target. We attach our own ID as peerId for the receiver.
    socket.to(roomCode).emit('video:offer', {
      targetPeerId: peerId,
      peerId: socket.user._id,
      signal,
    });
  };

  const handleAnswer = ({ roomCode, peerId, signal }) => {
    socket.to(roomCode).emit('video:answer', {
      targetPeerId: peerId,
      peerId: socket.user._id,
      signal,
    });
  };

  const handleIceCandidate = ({ roomCode, peerId, signal }) => {
    socket.to(roomCode).emit('video:ice-candidate', {
      targetPeerId: peerId,
      peerId: socket.user._id,
      signal,
    });
  };

  const handleLeave = ({ roomCode }) => {
    socket.to(roomCode).emit('video:leave', { peerId: socket.user._id });
  };

  socket.on('video:join', handleJoin);
  socket.on('video:offer', handleOffer);
  socket.on('video:answer', handleAnswer);
  socket.on('video:ice-candidate', handleIceCandidate);
  socket.on('video:leave', handleLeave);
};
