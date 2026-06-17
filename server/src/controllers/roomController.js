const Room = require('../models/Room');

// Helper to generate a unique room code: "xxx-xxxx-xxx"
const generateRoomCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const genPart = (len) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${genPart(3)}-${genPart(4)}-${genPart(3)}`;
};

// @desc    Create a new meeting room
// @route   POST /api/rooms/create
// @access  Private
const createRoom = async (req, res) => {
  const { title } = req.body;

  try {
    if (global.isMockDB) {
      global.mockRooms = global.mockRooms || [];
      let roomId = generateRoomCode();
      while (global.mockRooms.find((r) => r.roomId === roomId)) {
        roomId = generateRoomCode();
      }

      const newRoom = {
        roomId,
        title: title || 'Quick Collaboration Meeting',
        host: req.user._id.toString(),
        participants: [req.user._id.toString()],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        summary: '',
        actionItems: [],
      };
      global.mockRooms.push(newRoom);

      return res.status(201).json({
        message: 'Room created successfully',
        roomId: newRoom.roomId,
        title: newRoom.title,
      });
    }

    let roomId = generateRoomCode();
    
    // Ensure collision avoidance
    let roomExists = await Room.findOne({ roomId });
    while (roomExists) {
      roomId = generateRoomCode();
      roomExists = await Room.findOne({ roomId });
    }

    const room = await Room.create({
      roomId,
      title: title || undefined,
      host: req.user._id,
      participants: [req.user._id], // Host is the first participant
    });

    return res.status(201).json({
      message: 'Room created successfully',
      roomId: room.roomId,
      title: room.title,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error creating room' });
  }
};

// @desc    Get room details
// @route   GET /api/rooms/:roomId
// @access  Private
const getRoomDetails = async (req, res) => {
  const { roomId } = req.params;

  try {
    if (global.isMockDB) {
      global.mockRooms = global.mockRooms || [];
      const room = global.mockRooms.find((r) => r.roomId === roomId.toLowerCase() && r.isActive);
      if (!room) {
        return res.status(404).json({ message: 'Room not found or has already ended' });
      }

      global.mockUsers = global.mockUsers || [];
      const hostObj = global.mockUsers.find((u) => u._id.toString() === room.host.toString()) || { username: 'Host', email: '' };
      const participantsObj = room.participants.map((pId) => {
        return global.mockUsers.find((u) => u._id.toString() === pId.toString()) || { username: 'Participant', email: '' };
      });

      return res.json({
        roomId: room.roomId,
        title: room.title,
        host: { _id: room.host, username: hostObj.username, email: hostObj.email },
        participants: participantsObj.map((p, idx) => ({ _id: room.participants[idx], username: p.username, email: p.email })),
        isActive: room.isActive,
        createdAt: room.createdAt,
      });
    }

    const room = await Room.findOne({ roomId: roomId.toLowerCase(), isActive: true })
      .populate('host', 'username email avatarUrl')
      .populate('participants', 'username email avatarUrl');

    if (!room) {
      return res.status(404).json({ message: 'Room not found or has already ended' });
    }

    return res.json(room);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error getting room details' });
  }
};

// @desc    Join an active meeting room
// @route   POST /api/rooms/:roomId/join
// @access  Private
const joinRoom = async (req, res) => {
  const { roomId } = req.params;

  try {
    if (global.isMockDB) {
      global.mockRooms = global.mockRooms || [];
      const room = global.mockRooms.find((r) => r.roomId === roomId.toLowerCase() && r.isActive);
      if (!room) {
        return res.status(404).json({ message: 'Room not found or has ended' });
      }

      if (!room.participants.includes(req.user._id.toString())) {
        room.participants.push(req.user._id.toString());
      }

      return res.json({
        message: 'Joined room successfully',
        roomId: room.roomId,
        title: room.title,
      });
    }

    const room = await Room.findOne({ roomId: roomId.toLowerCase(), isActive: true });

    if (!room) {
      return res.status(404).json({ message: 'Room not found or has ended' });
    }

    // Add user to participants list if not already present
    if (!room.participants.includes(req.user._id)) {
      room.participants.push(req.user._id);
      await room.save();
    }

    return res.json({
      message: 'Joined room successfully',
      roomId: room.roomId,
      title: room.title,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error joining room' });
  }
};

// @desc    Leave a meeting room
// @route   POST /api/rooms/:roomId/leave
// @access  Private
const leaveRoom = async (req, res) => {
  const { roomId } = req.params;

  try {
    if (global.isMockDB) {
      global.mockRooms = global.mockRooms || [];
      const room = global.mockRooms.find((r) => r.roomId === roomId.toLowerCase());
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      room.participants = room.participants.filter(
        (pId) => pId.toString() !== req.user._id.toString()
      );
      return res.json({ message: 'Left room successfully' });
    }

    const room = await Room.findOne({ roomId: roomId.toLowerCase() });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Remove user from participants list
    room.participants = room.participants.filter(
      (id) => id.toString() !== req.user._id.toString()
    );

    // If no participants left, we can choose to set isActive = false or keep it open.
    // Let's keep the room active in database for history but keep it joinable.
    await room.save();

    return res.json({ message: 'Left room successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error leaving room' });
  }
};

// @desc    Get user's recent meeting list
// @route   GET /api/rooms/recent
// @access  Private
const getRecentRooms = async (req, res) => {
  try {
    if (global.isMockDB) {
      global.mockRooms = global.mockRooms || [];
      const userRooms = global.mockRooms.filter(
        (r) =>
          r.host.toString() === req.user._id.toString() ||
          r.participants.includes(req.user._id.toString())
      );

      // Sort by createdAt descending
      userRooms.sort((a, b) => b.createdAt - a.createdAt);
      const recent = userRooms.slice(0, 5);

      global.mockUsers = global.mockUsers || [];
      const populated = recent.map((r) => {
        const hostObj = global.mockUsers.find((u) => u._id.toString() === r.host.toString()) || { username: 'Host', email: '' };
        return {
          _id: r.roomId,
          roomId: r.roomId,
          title: r.title,
          host: { _id: r.host, username: hostObj.username, email: hostObj.email },
          createdAt: r.createdAt,
        };
      });

      return res.json(populated);
    }

    // Find rooms where user was host or participant, sort by creation date descending
    const rooms = await Room.find({
      $or: [{ host: req.user._id }, { participants: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('host', 'username email');

    return res.json(rooms);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error getting history' });
  }
};

module.exports = {
  createRoom,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  getRecentRooms,
};
