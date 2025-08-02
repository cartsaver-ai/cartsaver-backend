const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { verifyToken } = require('../middleware/auth');
const FounderCloning = require('../models/FounderCloning');
const Shop = require('../models/Shop');

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/founder-videos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `founder-${req.user.shopId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, and AVI files are allowed.'));
    }
  }
});

// Get founder cloning data
router.get('/', verifyToken, async (req, res) => {
  try {
    let founderData = await FounderCloning.findOne({ shopId: req.user.shopId });
    
    if (!founderData) {
      // Create new record if doesn't exist
      founderData = new FounderCloning({
        shopId: req.user.shopId
      });
      await founderData.save();
    }

    res.json(founderData);
  } catch (error) {
    console.error('Error fetching founder cloning data:', error);
    res.status(500).json({ error: 'Failed to fetch founder cloning data' });
  }
});

// Upload founder video
router.post('/upload', verifyToken, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    // Get video duration (you might want to use a library like ffprobe)
    const videoDuration = 30; // Placeholder - implement actual duration detection

    // Update or create founder cloning record
    const founderData = await FounderCloning.findOneAndUpdate(
      { shopId: req.user.shopId },
      {
        videoUrl: `/uploads/founder-videos/${req.file.filename}`,
        videoFileName: req.file.originalname,
        videoSize: req.file.size,
        videoDuration: videoDuration,
        voiceStatus: 'not_started',
        faceStatus: 'not_started',
        errorMessage: null
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Video uploaded successfully',
      data: founderData
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Start AI processing
router.post('/process', verifyToken, async (req, res) => {
  try {
    const founderData = await FounderCloning.findOne({ shopId: req.user.shopId });
    
    if (!founderData || !founderData.videoUrl) {
      return res.status(400).json({ error: 'No video uploaded for processing' });
    }

    // Update status to processing
    await FounderCloning.findOneAndUpdate(
      { shopId: req.user.shopId },
      {
        voiceStatus: 'processing',
        faceStatus: 'processing',
        processingStartedAt: new Date(),
        errorMessage: null
      }
    );

    // Start background processing (in a real app, you'd use a job queue)
    processVideoAsync(req.user.shopId, founderData.videoUrl);

    res.json({ message: 'Processing started successfully' });
  } catch (error) {
    console.error('Error starting processing:', error);
    res.status(500).json({ error: 'Failed to start processing' });
  }
});

// Generate AI video from script
router.post('/generate', verifyToken, async (req, res) => {
  try {
    const { script, customerName, cartItems } = req.body;
    
    if (!script) {
      return res.status(400).json({ error: 'Script is required' });
    }

    const founderData = await FounderCloning.findOne({ shopId: req.user.shopId });
    
    if (!founderData || founderData.voiceStatus !== 'completed' || founderData.faceStatus !== 'completed') {
      return res.status(400).json({ error: 'AI models not ready. Please complete the founder cloning setup first.' });
    }

    // In a real implementation, you would:
    // 1. Generate voice using the trained voice model
    // 2. Generate face/lip sync video using the trained face model
    // 3. Combine audio and video
    // 4. Return the generated video URL

    // For now, return a placeholder response
    const generatedVideoUrl = `/generated-videos/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.mp4`;
    
    res.json({
      message: 'Video generated successfully',
      videoUrl: generatedVideoUrl,
      estimatedDuration: 15 // seconds
    });
  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});

// Background processing function (simplified)
async function processVideoAsync(shopId, videoUrl) {
  try {
    console.log(`Starting AI processing for shop ${shopId}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update status to completed
    await FounderCloning.findOneAndUpdate(
      { shopId: shopId },
      {
        voiceStatus: 'completed',
        faceStatus: 'completed',
        processingCompletedAt: new Date(),
        voiceModelUrl: `/models/voice-${shopId}.model`,
        faceModelUrl: `/models/face-${shopId}.model`
      }
    );
    
    console.log(`AI processing completed for shop ${shopId}`);
  } catch (error) {
    console.error(`Error in background processing for shop ${shopId}:`, error);
    
    // Update status to failed
    await FounderCloning.findOneAndUpdate(
      { shopId: shopId },
      {
        voiceStatus: 'failed',
        faceStatus: 'failed',
        errorMessage: error.message
      }
    );
  }
}

// Serve uploaded videos (for development)
router.get('/uploads/founder-videos/:filename', verifyToken, (req, res) => {
  const filePath = path.join(__dirname, '../uploads/founder-videos', req.params.filename);
  res.sendFile(filePath);
});

module.exports = router; 