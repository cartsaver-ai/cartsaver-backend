const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getShopInfo, listWebhooks } = require('../utils/shopify');
const Shop = require('../models/Shop');

// Test endpoint to verify app setup
router.get('/setup', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Test shop info
    const shopInfo = await getShopInfo(shop.shop, shop.accessToken);
    
    // Test webhooks
    const webhooks = await listWebhooks(shop.shop, shop.accessToken);
    
    res.json({
      success: true,
      shop: {
        domain: shop.shop,
        name: shopInfo.name,
        email: shopInfo.email,
        plan: shop.plan,
        isActive: shop.isActive
      },
      webhooks: {
        count: webhooks.length,
        topics: webhooks.map(w => w.topic)
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        appUrl: process.env.SHOPIFY_APP_URL,
        hasMongoUri: !!process.env.MONGODB_URI
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Test failed', 
      message: error.message 
    });
  }
});

// Test webhook endpoint (for manual testing)
router.post('/webhook-test', (req, res) => {
  console.log('Test webhook received:', req.body);
  res.status(200).send('OK');
});

module.exports = router; 