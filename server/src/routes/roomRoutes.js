const express = require('express');
const {
  createRoom,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  getRecentRooms,
} = require('../controllers/roomController');
const { getRoomSummary } = require('../controllers/aiController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Route to create a new room
router.post('/create', protect, createRoom);

// Route to retrieve user's recent meeting history (ordered before /:roomId to prevent collision)
router.get('/recent', protect, getRecentRooms);

// Route to retrieve details of a specific room
router.get('/:roomId', protect, getRoomDetails);

// Route to join an active room
router.post('/:roomId/join', protect, joinRoom);

// Route to leave an active room
router.post('/:roomId/leave', protect, leaveRoom);

// Route to generate and store a room summary transcript
router.post('/:roomId/summary', protect, getRoomSummary);

module.exports = router;
