const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const { verifyToken } = require('../middleware/auth');

// Get recent activities for a shop
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const activities = await Activity.find({ 
      shop: req.user.shop 
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    res.json({ activities });
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Log a new activity
router.post('/', verifyToken, async (req, res) => {
  try {
    const { type, title, description, metadata = {}, status = 'success' } = req.body;
    
    if (!type || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const activity = new Activity({
      shop: req.user.shop,
      type,
      title,
      description,
      metadata,
      status
    });

    await activity.save();
    
    res.status(201).json({ 
      message: 'Activity logged successfully',
      activity 
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// Get activity statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await Activity.aggregate([
      {
        $match: {
          shop: req.user.shop,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ stats });
  } catch (error) {
    console.error('Failed to fetch activity stats:', error);
    res.status(500).json({ error: 'Failed to fetch activity statistics' });
  }
});

module.exports = router; 