const mongoose = require("mongoose");

// Defines that ever chat message needs sender, message and timestamp.
const chatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
  { _id: true },
);

// Drawing of the white board need user, tool, color, width and coordinates of the stroke.
const strokeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tool: { type: String, default: "pen" },
    color: { type: String, default: "#000000" },
    width: { type: Number, default: 2 },
    x0: { type: Number },
    y0: { type: Number },
    x1: { type: Number },
    y1: { type: Number },
  },
  { _id: false },
);

// It has Id, name, type(file or folder) parentId, language(CPP, JS, etc..) and content.
const fileSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["file", "folder"], default: "file" },
    parentId: { type: String, default: null }, // null means root
    language: { type: String, default: "cpp" },
    content: { type: String, default: "" },
  },
  { _id: false },
);

/**
 * Room Schema
 * - roomCode          : short human-friendly code for sharing
 * - name              : display name for the room
 * - admin             : creator / owner of the room
 * - participants      : array of user refs (max 5)
 * - pendingApprovals  : users waiting for admin approval to join
 * - code              : the collaborative code document (legacy)
 * - language          : programming language mode (legacy)
 * - files             : array of files for the project
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
      required: [true, "Room name is required"],
      trim: true,
      maxlength: [50, "Room name must be at most 50 characters"],
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pendingApprovals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    code: {
      type: String,
      default: "// Start coding together!\n",
    },
    language: {
      type: String,
      default: "cpp",
    },
    files: {
      type: [fileSchema],
      default: [
        {
          id: "1",
          name: "first.cpp",
          language: "cpp",
          content: "// Start coding collaboratively!\n",
        },
      ],
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
  { timestamps: true },
);

// validations for max 5 Users in a room.
roomSchema.pre("save", function (next) {
  if (this.participants.length > 5) {
    const err = new Error("Room cannot have more than 5 participants");
    err.statusCode = 400;
    return next(err);
  }
  next();
});

module.exports = mongoose.model("Room", roomSchema);
