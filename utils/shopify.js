const Shopify = require('shopify-api-node');
const crypto = require('crypto');

// Create Shopify API instance
const createShopifyAPI = (shop, accessToken) => {
  return new Shopify({
    shopName: shop,
    accessToken: accessToken,
    apiVersion: '2023-10'
  });
};

// Verify webhook signature
const verifyWebhookSignature = (body, hmacHeader) => {
  const hmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(hmacHeader)
  );
};

// Generate HMAC for OAuth
const generateHMAC = (params) => {
  const sortedParams = Object.keys(params)
    .filter(key => key !== 'hmac' && key !== 'signature')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(sortedParams, 'utf8')
    .digest('hex');
};

// Validate OAuth callback
const validateOAuthCallback = (params) => {
  const hmac = params.hmac;
  delete params.hmac;
  
  const calculatedHmac = generateHMAC(params);
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(calculatedHmac)
  );
};

// Get shop information
const getShopInfo = async (shop, accessToken) => {
  try {
    const shopify = createShopifyAPI(shop, accessToken);
    const shopData = await shopify.shop.get();
    return shopData;
  } catch (error) {
    throw new Error(`Failed to get shop info: ${error.message}`);
  }
};

// Create webhook
const createWebhook = async (shop, accessToken, topic, address) => {
  try {
    const shopify = createShopifyAPI(shop, accessToken);
    const webhook = await shopify.webhook.create({
      topic: topic,
      address: address,
      format: 'json'
    });
    return webhook;
  } catch (error) {
    throw new Error(`Failed to create webhook: ${error.message}`);
  }
};

// List existing webhooks
const listWebhooks = async (shop, accessToken) => {
  try {
    const shopify = createShopifyAPI(shop, accessToken);
    const webhooks = await shopify.webhook.list();
    return webhooks;
  } catch (error) {
    throw new Error(`Failed to list webhooks: ${error.message}`);
  }
};

// Get abandoned checkouts
const getAbandonedCheckouts = async (shop, accessToken, limit = 50) => {
  try {
    const shopify = createShopifyAPI(shop, accessToken);
    const checkouts = await shopify.checkout.list({
      limit: limit,
      status: 'open'
    });
    return checkouts;
  } catch (error) {
    throw new Error(`Failed to get abandoned checkouts: ${error.message}`);
  }
};

// Get customer information
const getCustomer = async (shop, accessToken, customerId) => {
  try {
    const shopify = createShopifyAPI(shop, accessToken);
    const customer = await shopify.customer.get(customerId);
    return customer;
  } catch (error) {
    throw new Error(`Failed to get customer: ${error.message}`);
  }
};

// Create discount code
const createDiscountCode = async (shop, accessToken, discountData) => {
  try {
    const shopify = createShopifyAPI(shop, accessToken);
    const priceRule = await shopify.priceRule.create({
      title: discountData.title,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: 'percentage',
      value: `-${discountData.percentage}`,
      customer_selection: 'all',
      starts_at: new Date().toISOString()
    });

    const discountCode = await shopify.discountCode.create(priceRule.id, {
      code: discountData.code
    });

    return { priceRule, discountCode };
  } catch (error) {
    throw new Error(`Failed to create discount code: ${error.message}`);
  }
};

module.exports = {
  createShopifyAPI,
  verifyWebhookSignature,
  validateOAuthCallback,
  getShopInfo,
  createWebhook,
  listWebhooks,
  getAbandonedCheckouts,
  getCustomer,
  createDiscountCode
}; 