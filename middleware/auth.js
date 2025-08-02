const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Verify Shopify session
const verifyShopifySession = async (req, res, next) => {
  try {
    const shop = req.query.shop || req.body.shop;
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const shopData = await Shop.findOne({ shop: shop.toLowerCase() });
    
    if (!shopData || !shopData.isActive) {
      return res.status(401).json({ error: 'Shop not found or inactive' });
    }

    req.shop = shopData;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error verifying shop session' });
  }
};

// Verify shop ownership
const verifyShopOwnership = async (req, res, next) => {
  try {
    const shop = req.params.shop || req.query.shop || req.body.shop;
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const shopData = await Shop.findOne({ 
      shop: shop.toLowerCase(),
      isActive: true 
    });
    
    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    req.shop = shopData;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error verifying shop ownership' });
  }
};

// Rate limiting for specific endpoints
const createRateLimiter = (windowMs, max) => {
  const rateLimit = require('express-rate-limit');
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests from this IP, please try again later.'
    }
  });
};

module.exports = {
  verifyToken,
  verifyShopifySession,
  verifyShopOwnership,
  createRateLimiter
}; 