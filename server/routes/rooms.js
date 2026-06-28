const express = require('express');
const crypto = require('crypto');
const Room = require('../models/Room');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All room routes require authentication
router.use(protect);

// ─── Helper: generate a 6-character alphanumeric room code ────────────────────
const generateRoomCode = () => {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A1B2C3"
};

// ─── POST /api/rooms/create ───────────────────────────────────────────────────
// Create a new room. The creator becomes the admin and first participant.
router.post('/create', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    // Generate a unique room code (retry on collision)
    let roomCode;
    let codeExists = true;
    while (codeExists) {
      roomCode = generateRoomCode();
      codeExists = await Room.findOne({ roomCode });
    }

    const room = await Room.create({
      roomCode,
      name,
      admin: req.user._id,
      participants: [req.user._id],
    });

    // Populate participants for the response
    await room.populate('admin', 'username email');
    await room.populate('participants', 'username email');

    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error.message);
    res.status(500).json({ message: 'Server error creating room' });
  }
});

// ─── POST /api/rooms/join ─────────────────────────────────────────────────────
// Request to join a room by its roomCode.
// If the requester is already a participant, return the room.
// Otherwise, add them to pendingApprovals for the admin to approve.
router.post('/join', async (req, res) => {
  try {
    const { roomCode } = req.body;

    if (!roomCode) {
      return res.status(400).json({ message: 'Room code is required' });
    }

    const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const userId = req.user._id;

    // Already a participant — just return the room
    if (room.participants.some((p) => p.equals(userId))) {
      await room.populate('admin', 'username email');
      await room.populate('participants', 'username email');
      await room.populate('pendingApprovals', 'username email');
      return res.json({ message: 'Already a participant', room });
    }

    // Check max-participant cap
    if (room.participants.length >= 5) {
      return res.status(400).json({ message: 'Room is full (max 5 participants)' });
    }

    // Already in pending list
    if (room.pendingApprovals.some((p) => p.equals(userId))) {
      return res
        .status(200)
        .json({ message: 'Join request already pending admin approval' });
    }

    // Add to pending approvals
    room.pendingApprovals.push(userId);
    await room.save();

    res.json({ message: 'Join request sent — waiting for admin approval' });
  } catch (error) {
    console.error('Join room error:', error.message);
    res.status(500).json({ message: 'Server error joining room' });
  }
});

// ─── POST /api/rooms/approve/:roomId ──────────────────────────────────────────
// Admin approves (or rejects) a pending join request.
// Body: { userId, action: "approve" | "reject" }
router.post('/approve/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, action } = req.body;

    if (!userId || !action) {
      return res
        .status(400)
        .json({ message: 'userId and action (approve/reject) are required' });
    }

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Only the admin can approve / reject
    if (!room.admin.equals(req.user._id)) {
      return res
        .status(403)
        .json({ message: 'Only the room admin can approve or reject requests' });
    }

    // Verify the user is in pendingApprovals
    const pendingIndex = room.pendingApprovals.findIndex((p) =>
      p.equals(userId)
    );

    if (pendingIndex === -1) {
      return res
        .status(400)
        .json({ message: 'User is not in the pending approvals list' });
    }

    // Remove from pending
    room.pendingApprovals.splice(pendingIndex, 1);

    if (action === 'approve') {
      // Double-check cap
      if (room.participants.length >= 5) {
        await room.save();
        return res.status(400).json({ message: 'Room is full (max 5 participants)' });
      }
      room.participants.push(userId);
    }

    await room.save();

    await room.populate('admin', 'username email');
    await room.populate('participants', 'username email');
    await room.populate('pendingApprovals', 'username email');

    const verb = action === 'approve' ? 'approved' : 'rejected';
    res.json({ message: `User ${verb} successfully`, room });
  } catch (error) {
    console.error('Approve error:', error.message);
    res.status(500).json({ message: 'Server error processing approval' });
  }
});

// ─── GET /api/rooms/:roomCode ─────────────────────────────────────────────────
// Get full room details by roomCode (must be a participant).
router.get('/:roomCode', async (req, res) => {
  try {
    const room = await Room.findOne({
      roomCode: req.params.roomCode.toUpperCase(),
    })
      .populate('admin', 'username email')
      .populate('participants', 'username email')
      .populate('pendingApprovals', 'username email');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Only participants (and admin) can view
    const isParticipant = room.participants.some((p) =>
      p._id.equals(req.user._id)
    );

    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: 'You are not a participant of this room' });
    }

    res.json(room);
  } catch (error) {
    console.error('Get room error:', error.message);
    res.status(500).json({ message: 'Server error fetching room' });
  }
});

// ─── GET /api/rooms/ ──────────────────────────────────────────────────────────
// List all rooms where the current user is a participant.
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({
      participants: req.user._id,
    })
      .populate('admin', 'username email')
      .populate('participants', 'username email')
      .populate('pendingApprovals', 'username email')
      .select('-chatHistory -whiteboardData') // keep list responses lightweight
      .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (error) {
    console.error('List rooms error:', error.message);
    res.status(500).json({ message: 'Server error listing rooms' });
  }
});

// ─── POST /api/rooms/leave/:roomId ────────────────────────────────────────────
// Leave a room. If admin leaves, the room is deleted.
router.post('/leave/:roomId', async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const userId = req.user._id;

    // Check if the user is the admin
    if (room.admin.equals(userId)) {
      // Admin is leaving -> Delete the room
      await Room.findByIdAndDelete(req.params.roomId);
      return res.json({ message: 'Room deleted because admin left', deleted: true });
    }

    // Check if user is a participant
    const participantIndex = room.participants.findIndex(p => p.equals(userId));
    if (participantIndex !== -1) {
      room.participants.splice(participantIndex, 1);
      await room.save();
      return res.json({ message: 'Left room successfully' });
    } else {
      return res.status(400).json({ message: 'Not a participant of this room' });
    }
  } catch (error) {
    console.error('Leave room error:', error.message);
    res.status(500).json({ message: 'Server error leaving room' });
  }
});

// ─── DELETE /api/rooms/:roomId ────────────────────────────────────────────────
// Delete a room completely. Admin only.
router.delete('/:roomId', async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.admin.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the room admin can delete the room' });
    }

    await Room.findByIdAndDelete(req.params.roomId);
    res.json({ message: 'Room deleted successfully', deleted: true });
  } catch (error) {
    console.error('Delete room error:', error.message);
    res.status(500).json({ message: 'Server error deleting room' });
  }
});

module.exports = router;