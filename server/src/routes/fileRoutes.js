const express = require('express');
const { uploadFile } = require('../controllers/fileController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Upload file endpoint (guarded by JWT auth)
router.post('/upload', protect, uploadFile);

module.exports = router;
