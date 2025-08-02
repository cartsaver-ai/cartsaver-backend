const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const { verifyToken, verifyShopOwnership } = require('../middleware/auth');
const { getShopInfo, createWebhook, listWebhooks } = require('../utils/shopify');

// Get shop information
router.get('/shop', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Get additional shop info from Shopify API
    const shopInfo = await getShopInfo(shop.shop, shop.accessToken);

    res.json({
      shop: shop.shop,
      plan: shop.plan,
      settings: shop.settings,
      isActive: shop.isActive,
      shopInfo: {
        name: shopInfo.name,
        email: shopInfo.email,
        domain: shopInfo.domain,
        province: shopInfo.province,
        country: shopInfo.country,
        phone: shopInfo.phone,
        address1: shopInfo.address1,
        city: shopInfo.city,
        zip: shopInfo.zip,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get shop information' });
  }
});

// Update shop settings
router.put('/settings', verifyToken, async (req, res) => {
  try {
    const { settings } = req.body;
    
    const shop = await Shop.findByIdAndUpdate(
      req.user.shopId,
      { 
        settings: { ...settings },
        lastActive: new Date()
      },
      { new: true }
    );

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json({
      message: 'Settings updated successfully',
      settings: shop.settings
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Setup webhooks
router.post('/webhooks/setup', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const webhookUrl = `${process.env.SHOPIFY_APP_URL}/api/webhooks`;
    
    // Setup webhooks for cart abandonment
    const webhooks = [
      'checkouts/create',
      'checkouts/update',
      'orders/create',
      'carts/create',
      'carts/update',
      'app/uninstalled'
    ];

    const createdWebhooks = [];

    for (const topic of webhooks) {
      try {
        const webhook = await createWebhook(
          shop.shop,
          shop.accessToken,
          topic,
          webhookUrl
        );
        createdWebhooks.push(webhook);
      } catch (error) {
        console.error(`Failed to create webhook for ${topic}:`, error);
      }
    }

    res.json({
      message: 'Webhooks setup completed',
      webhooks: createdWebhooks
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to setup webhooks' });
  }
});

// Get webhook status
router.get('/webhooks/status', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const webhooks = await listWebhooks(shop.shop, shop.accessToken);
    const webhookUrl = `${process.env.SHOPIFY_APP_URL}/api/webhooks`;
    
    const requiredWebhooks = [
      'checkouts/create',
      'checkouts/update',
      'orders/create',
      'carts/create',
      'carts/update',
      'app/uninstalled'
    ];

    const status = requiredWebhooks.map(topic => {
      const webhook = webhooks.find(w => w.topic === topic && w.address === webhookUrl);
      return {
        topic,
        status: webhook ? 'active' : 'missing',
        id: webhook?.id
      };
    });

    res.json({ webhooks: status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get webhook status' });
  }
});

// Uninstall app
router.post('/uninstall', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findByIdAndUpdate(
      req.user.shopId,
      { 
        isActive: false,
        lastActive: new Date()
      },
      { new: true }
    );

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json({ message: 'App uninstalled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to uninstall app' });
  }
});

// Get app statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // In a real app, you would calculate these from your database
    const stats = {
      totalAbandonedCarts: 0,
      recoveredCarts: 0,
      recoveryRate: 0,
      totalRevenue: 0,
      activeCampaigns: 0
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router; 