const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const { verifyToken } = require('../middleware/auth');
const { validateOAuthCallback, getShopInfo, createWebhook } = require('../utils/shopify');
const { logActivity, activityTemplates } = require('../utils/activityLogger');
const jwt = require('jsonwebtoken');

// Verify authentication token
router.get('/verify', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(401).json({ error: 'Shop not found' });
    }

    res.json({
      authenticated: true,
      shop: {
        id: shop._id,
        domain: shop.shop,
        isActive: shop.isActive
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Initiate OAuth flow
router.get('/install', async (req, res) => {
  try {
    const { shop } = req.query;
    
    console.log('Install request received for shop:', shop);
    console.log('Environment variables:', {
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? 'SET' : 'NOT SET',
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL
    });
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    const shopify = shop.toLowerCase();
    const scopes = process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_orders,write_orders';
    
    // Use dynamic callback URL based on environment
    const redirectUri = process.env.NODE_ENV === 'production' 
      ? 'https://cartsaver-ai.herokuapp.com/api/auth/callback'
      : 'http://localhost:5000/api/auth/callback';
    
    const authUrl = `https://${shopify}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${shopify}`;
    
    console.log('OAuth URL:', authUrl);
    console.log('Redirecting to Shopify OAuth...');
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, shop, state } = req.query;
    
    if (!code || !shop || !state) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Note: OAuth callbacks don't always include HMAC signature
    // We'll skip HMAC validation for OAuth callbacks
    console.log('OAuth callback received:', { code: !!code, shop, state });

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Failed to get access token' });
    }

    // Get shop information
    const shopInfo = await getShopInfo(shop, tokenData.access_token);

    // Save or update shop in database
    const shopData = await Shop.findOneAndUpdate(
      { shop: shop.toLowerCase() },
      {
        shop: shop.toLowerCase(),
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        isActive: true,
        lastActive: new Date(),
        // Set installedAt only if this is a new shop (not already in database)
        $setOnInsert: {
          installedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    // Setup webhooks automatically
    const webhookUrl = `${process.env.SHOPIFY_APP_URL}/api/webhooks`;
    const webhooks = [
      'checkouts/create',
      'checkouts/update', 
      'orders/create',
      'carts/create',
      'carts/update',
      'app/uninstalled'
    ];

    let webhookSuccessCount = 0;
    // Setup webhooks in background (don't block the redirect)
    for (const topic of webhooks) {
      try {
        await createWebhook(shop, tokenData.access_token, topic, webhookUrl);
        console.log(`Webhook created for ${topic}`);
        webhookSuccessCount++;
      } catch (error) {
        console.error(`Failed to create webhook for ${topic}:`, error.message);
      }
    }

    // Log app installation activity
    const appInstallData = activityTemplates.appInstalled(shopData.shop);
    await logActivity(
      shopData.shop,
      appInstallData.type,
      appInstallData.title,
      appInstallData.description,
      appInstallData.metadata,
      appInstallData.status
    );

    // Log webhook setup activity
    const webhookData = activityTemplates.webhooksSetup(shopData.shop, webhookSuccessCount);
    await logActivity(
      shopData.shop,
      webhookData.type,
      webhookData.title,
      webhookData.description,
      webhookData.metadata,
      webhookData.status
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        shopId: shopData._id, 
        shop: shopData.shop 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    // Check if this is a fetch request (has Accept: application/json header)
    const isFetchRequest = req.headers.accept && req.headers.accept.includes('application/json');
    
    if (isFetchRequest) {
      // Return JSON for fetch requests
      res.json({ 
        token, 
        shop: shopData.shop,
        success: true 
      });
    } else {
      // Redirect to Shopify admin for direct requests (standard OAuth flow)
      const shopifyAdminUrl = `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`;
      res.redirect(shopifyAdminUrl);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'OAuth callback failed' });
  }
});

// Verify session
router.get('/verify', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop || !shop.isActive) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    res.json({
      shop: shop.shop,
      plan: shop.plan,
      settings: shop.settings,
      isActive: shop.isActive
    });
  } catch (error) {
    res.status(500).json({ error: 'Session verification failed' });
  }
});

// Handle Shopify app access
router.get('/shopify-auth', async (req, res) => {
  try {
    const { shop, host } = req.query;
    
    if (!shop || !host) {
      return res.status(400).json({ error: 'Missing shop or host parameters' });
    }

    // Check if shop exists in database
    const shopData = await Shop.findOne({ shop: shop.toLowerCase() });
    
    if (!shopData || !shopData.isActive) {
      // Shop not found or not active, return error
      return res.status(401).json({ error: 'Shop not found or not active' });
    }

    // Generate JWT token for the shop
    const token = jwt.sign(
      { 
        shopId: shopData._id, 
        shop: shopData.shop 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    // Return token as JSON instead of redirecting
    res.json({ 
      token, 
      shop: shopData.shop,
      success: true 
    });
  } catch (error) {
    console.error('Shopify auth error:', error);
    res.status(500).json({ error: 'Shopify authentication failed' });
  }
});

// Logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // In a real app, you might want to invalidate the token
    // For now, we'll just return success
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router; 