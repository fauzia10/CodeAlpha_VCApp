const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: [true, 'Please provide a room ID'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      default: 'Quick Collaboration Meeting',
      trim: true,
    },
    host: {
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
    isActive: {
      type: Boolean,
      default: true,
    },
    endedAt: {
      type: Date,
    },
    summary: {
      type: String,
    },
    actionItems: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Room', RoomSchema);
