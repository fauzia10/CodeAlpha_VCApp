const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads folder exists in server directory
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Append timestamp and random value to ensure unique filenames
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const sanitizedBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${sanitizedBase}-${uniqueSuffix}${ext}`);
  },
});

// Configure upload limits
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB maximum file size limit
}).single('file');

// @desc    Upload a single file
// @route   POST /api/files/upload
// @access  Private
const uploadFile = (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Multer Error: ${err.message}` });
      }
      return res.status(400).json({ message: err.message || 'File upload error' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please attach a file to upload' });
    }

    // Return relative URL so client can prepend EXPO_PUBLIC_API_URL dynamically
    const relativeUrl = `/uploads/${req.file.filename}`;

    return res.status(200).json({
      message: 'File uploaded successfully',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      downloadUrl: relativeUrl,
    });
  });
};

module.exports = {
  uploadFile,
};
