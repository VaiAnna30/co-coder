const mongoose = require('mongoose');

/**
 * Chat message sub-schema — embedded in Room.chatHistory
 */
const chatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

/**
 * Whiteboard stroke sub-schema — embedded in Room.whiteboardData
 */
const strokeSchema = new mongoose.Schema(
  {
    strokeId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tool: { type: String, default: 'pen' },
    color: { type: String, default: '#000000' },
    width: { type: Number, default: 2 },
    points: { type: [Number], default: [] }, // flat array [x1,y1,x2,y2,…]
  },
  { _id: false }
);

/**
 * Room Schema
 * - roomCode          : short human-friendly code for sharing
 * - name              : display name for the room
 * - admin             : creator / owner of the room
 * - participants      : array of user refs (max 5)
 * - pendingApprovals  : users waiting for admin approval to join
 * - code              : the collaborative code document
 * - language          : programming language mode
 * - whiteboardData    : array of strokes
 * - chatHistory       : array of chat messages
 */
const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      maxlength: [50, 'Room name must be at most 50 characters'],
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    pendingApprovals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    code: {
      type: String,
      default: '// Start coding together!\n',
    },
    language: {
      type: String,
      default: 'javascript',
    },
    whiteboardData: {
      type: [strokeSchema],
      default: [],
    },
    chatHistory: {
      type: [chatMessageSchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/**
 * Validate max 5 participants before saving.
 */
roomSchema.pre('save', function (next) {
  if (this.participants.length > 5) {
    const err = new Error('Room cannot have more than 5 participants');
    err.statusCode = 400;
    return next(err);
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema);
