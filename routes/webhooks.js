const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Shop = require('../models/Shop');
const { verifyWebhookSignature } = require('../utils/shopify');

// Middleware to verify webhook signature
const verifyWebhook = (req, res, next) => {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  
  if (!hmacHeader) {
    return res.status(401).json({ error: 'Missing HMAC header' });
  }

  const body = req.rawBody || JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(body, hmacHeader)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
};

// Handle checkout creation
router.post('/checkouts/create', verifyWebhook, async (req, res) => {
  try {
    const checkout = req.body;
    
    // Only process if checkout has items and customer email
    if (!checkout.line_items || checkout.line_items.length === 0 || !checkout.email) {
      return res.status(200).json({ message: 'Checkout processed' });
    }

    // Check if cart already exists
    const existingCart = await Cart.findOne({
      cartToken: checkout.token,
      shop: checkout.shop_domain
    });

    if (existingCart) {
      return res.status(200).json({ message: 'Cart already exists' });
    }

    // Create new cart record
    const cartData = {
      shop: checkout.shop_domain,
      cartToken: checkout.token,
      customerEmail: checkout.email,
      customerId: checkout.customer_id || null,
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
      abandonedAt: new Date()
    };

    await Cart.create(cartData);
    
    res.status(200).json({ message: 'Cart created successfully' });
  } catch (error) {
    console.error('Checkout creation webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle checkout updates
router.post('/checkouts/update', verifyWebhook, async (req, res) => {
  try {
    const checkout = req.body;
    
    // Find existing cart
    const cart = await Cart.findOne({
      cartToken: checkout.token,
      shop: checkout.shop_domain
    });

    if (!cart) {
      return res.status(200).json({ message: 'Cart not found' });
    }

    // Update cart with new information
    cart.items = checkout.line_items.map(item => ({
      productId: item.product_id,
      variantId: item.variant_id,
      title: item.title,
      variantTitle: item.variant_title,
      quantity: item.quantity,
      price: parseFloat(item.price),
      image: item.image_url,
      productUrl: item.product_url
    }));
    
    cart.totalPrice = parseFloat(checkout.total_price);
    cart.abandonedAt = new Date();
    
    await cart.save();
    
    res.status(200).json({ message: 'Cart updated successfully' });
  } catch (error) {
    console.error('Checkout update webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle order creation (cart recovered)
router.post('/orders/create', verifyWebhook, async (req, res) => {
  try {
    const order = req.body;
    
    // Find cart by customer email and mark as recovered
    const cart = await Cart.findOne({
      customerEmail: order.email,
      shop: order.shop_domain,
      status: 'abandoned'
    });

    if (cart) {
      cart.status = 'recovered';
      cart.recoveredAt = new Date();
      await cart.save();
    }
    
    res.status(200).json({ message: 'Order processed successfully' });
  } catch (error) {
    console.error('Order creation webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle cart creation
router.post('/carts/create', verifyWebhook, async (req, res) => {
  try {
    const cart = req.body;
    
    // Only process if cart has items
    if (!cart.line_items || cart.line_items.length === 0) {
      return res.status(200).json({ message: 'Cart processed' });
    }

    // Check if cart already exists
    const existingCart = await Cart.findOne({
      cartToken: cart.token,
      shop: cart.shop_domain
    });

    if (existingCart) {
      return res.status(200).json({ message: 'Cart already exists' });
    }

    // Create new cart record
    const cartData = {
      shop: cart.shop_domain,
      cartToken: cart.token,
      customerEmail: cart.email || null,
      customerId: cart.customer_id || null,
      items: cart.line_items.map(item => ({
        productId: item.product_id,
        variantId: item.variant_id,
        title: item.title,
        variantTitle: item.variant_title,
        quantity: item.quantity,
        price: parseFloat(item.price),
        image: item.image_url,
        productUrl: item.product_url
      })),
      totalPrice: parseFloat(cart.total_price),
      currency: cart.currency,
      abandonedAt: new Date()
    };

    await Cart.create(cartData);
    
    res.status(200).json({ message: 'Cart created successfully' });
  } catch (error) {
    console.error('Cart creation webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle cart updates
router.post('/carts/update', verifyWebhook, async (req, res) => {
  try {
    const cart = req.body;
    
    // Find existing cart
    const existingCart = await Cart.findOne({
      cartToken: cart.token,
      shop: cart.shop_domain
    });

    if (!existingCart) {
      return res.status(200).json({ message: 'Cart not found' });
    }

    // Update cart with new information
    existingCart.items = cart.line_items.map(item => ({
      productId: item.product_id,
      variantId: item.variant_id,
      title: item.title,
      variantTitle: item.variant_title,
      quantity: item.quantity,
      price: parseFloat(item.price),
      image: item.image_url,
      productUrl: item.product_url
    }));
    
    existingCart.totalPrice = parseFloat(cart.total_price);
    existingCart.abandonedAt = new Date();
    
    await existingCart.save();
    
    res.status(200).json({ message: 'Cart updated successfully' });
  } catch (error) {
    console.error('Cart update webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// App uninstall webhook
router.post('/app/uninstalled', verifyWebhook, async (req, res) => {
  try {
    const { domain } = req.body;
    
    // Mark shop as inactive
    await Shop.findOneAndUpdate(
      { shop: domain },
      { 
        isActive: false,
        lastActive: new Date()
      }
    );
    
    res.status(200).json({ message: 'App uninstalled successfully' });
  } catch (error) {
    console.error('App uninstall webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router; 