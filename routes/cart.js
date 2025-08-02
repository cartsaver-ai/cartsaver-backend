const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Shop = require('../models/Shop');
const { verifyToken } = require('../middleware/auth');
const { getAbandonedCheckouts, getCustomer } = require('../utils/shopify');
const { logActivity, activityTemplates } = require('../utils/activityLogger');

// Get all abandoned carts for a shop
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'abandoned' } = req.query;
    const skip = (page - 1) * limit;

    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const carts = await Cart.find({ 
      shop: shop.shop,
      status: status 
    })
    .sort({ abandonedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('customerId', 'email firstName lastName');

    const total = await Cart.countDocuments({ 
      shop: shop.shop,
      status: status 
    });

    res.json({
      carts,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch abandoned carts' });
  }
});

// Get specific cart by ID
router.get('/:cartId', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const cart = await Cart.findOne({
      _id: req.params.cartId,
      shop: shop.shop
    });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Update cart status
router.patch('/:cartId/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['abandoned', 'recovered', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const cart = await Cart.findOneAndUpdate(
      {
        _id: req.params.cartId,
        shop: shop.shop
      },
      {
        status,
        ...(status === 'recovered' && { recoveredAt: new Date() })
      },
      { new: true }
    );

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    res.json({
      message: 'Cart status updated successfully',
      cart
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart status' });
  }
});

// Sync abandoned carts from Shopify
router.post('/sync', verifyToken, async (req, res) => {
  try {
    console.log('Starting cart sync for shop:', req.user.shop); // Debug log
    
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      console.log('Shop not found for ID:', req.user.shopId); // Debug log
      return res.status(404).json({ error: 'Shop not found' });
    }

    if (!shop.accessToken) {
      console.log('No access token found for shop:', shop.shop); // Debug log
      return res.status(400).json({ error: 'Shop not properly authenticated with Shopify' });
    }

    // Get abandoned checkouts from Shopify
    console.log('Fetching abandoned checkouts from Shopify...'); // Debug log
    const checkouts = await getAbandonedCheckouts(shop.shop, shop.accessToken, 50);
    console.log('Found checkouts:', checkouts.length); // Debug log
    
    if (!Array.isArray(checkouts)) {
      console.error('Invalid response from Shopify API:', checkouts);
      return res.status(500).json({ error: 'Failed to fetch abandoned carts from Shopify' });
    }
    
    let syncedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const checkout of checkouts) {
      try {
        // Check if cart already exists
        const existingCart = await Cart.findOne({
          cartToken: checkout.token,
          shop: shop.shop
        });

        if (existingCart) {
          skippedCount++;
          continue;
        }

        // Get customer information if available
        let customerInfo = {};
        if (checkout.customer_id) {
          try {
            const customer = await getCustomer(shop.shop, shop.accessToken, checkout.customer_id);
            customerInfo = {
              customerId: customer.id,
              customerEmail: customer.email,
              customerFirstName: customer.first_name,
              customerLastName: customer.last_name
            };
          } catch (error) {
            console.error('Failed to get customer info:', error);
          }
        }

        // Create new cart record
        const cartData = {
          shop: shop.shop,
          cartToken: checkout.token,
          items: checkout.line_items.map(item => ({
            productId: item.product_id,
            variantId: item.variant_id,
            title: item.title,
            variantTitle: item.variant_title,
            quantity: item.quantity,
            price: parseFloat(item.price),
            image: item.image_url,
            productUrl: item.product_url
          })),
          totalPrice: parseFloat(checkout.total_price),
          currency: checkout.currency,
          abandonedAt: new Date(checkout.updated_at),
          ...customerInfo
        };

        await Cart.create(cartData);
        syncedCount++;
      } catch (error) {
        console.error('Failed to sync checkout:', error);
        errorCount++;
      }
    }

    console.log('Sync completed - synced:', syncedCount, 'errors:', errorCount, 'skipped:', skippedCount); // Debug log

    // Log the activity only if carts were actually synced
    if (syncedCount > 0) {
      const activityData = activityTemplates.cartsSynced(shop.shop, syncedCount, checkouts.length, errorCount);
      await logActivity(
        shop.shop,
        activityData.type,
        activityData.title,
        activityData.description,
        activityData.metadata,
        activityData.status
      );
    }

    const response = {
      message: 'Cart sync completed',
      synced: syncedCount,
      errors: errorCount,
      skipped: skippedCount,
      total: checkouts.length,
      summary: checkouts.length === 0 
        ? 'No abandoned carts found in Shopify'
        : syncedCount === 0 
          ? 'All abandoned carts are already synced'
          : `Successfully synced ${syncedCount} new carts`
    };

    console.log('Sending response:', response); // Debug log
    res.json(response);
  } catch (error) {
    console.error('Cart sync error:', error);
    res.status(500).json({ error: 'Failed to sync carts' });
  }
});

// Get cart recovery statistics
router.get('/stats/recovery', verifyToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const stats = await Cart.aggregate([
      {
        $match: {
          shop: shop.shop,
          abandonedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalPrice' }
        }
      }
    ]);

    const totalAbandoned = stats.find(s => s._id === 'abandoned')?.count || 0;
    const totalRecovered = stats.find(s => s._id === 'recovered')?.count || 0;
    const totalValue = stats.reduce((sum, stat) => sum + stat.totalValue, 0);

    res.json({
      totalAbandoned,
      totalRecovered,
      recoveryRate: totalAbandoned > 0 ? (totalRecovered / totalAbandoned) * 100 : 0,
      totalValue,
      period: `${days} days`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recovery statistics' });
  }
});

// Delete cart
router.delete('/:cartId', verifyToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shopId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const cart = await Cart.findOneAndDelete({
      _id: req.params.cartId,
      shop: shop.shop
    });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    res.json({ message: 'Cart deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart' });
  }
});

module.exports = router; 