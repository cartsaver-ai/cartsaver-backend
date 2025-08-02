const Activity = require('../models/Activity');

/**
 * Log an activity to the database
 * @param {string} shop - The shop domain
 * @param {string} type - Activity type (from Activity model enum)
 * @param {string} title - Activity title
 * @param {string} description - Activity description
 * @param {Object} metadata - Additional data
 * @param {string} status - Activity status (success, error, warning, info)
 */
const logActivity = async (shop, type, title, description, metadata = {}, status = 'success') => {
  try {
    const activity = new Activity({
      shop,
      type,
      title,
      description,
      metadata,
      status
    });

    await activity.save();
    console.log(`Activity logged: ${type} - ${title}`);
    return activity;
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw error to avoid breaking main functionality
    return null;
  }
};

/**
 * Predefined activity templates for common actions
 */
const activityTemplates = {
  appInstalled: (shop) => ({
    type: 'app_installed',
    title: 'App installed successfully',
    description: 'CartSaver app was installed and configured',
    metadata: { shop }
  }),

  cartsSynced: (shop, synced, total, errors) => ({
    type: 'carts_synced',
    title: `Synced ${synced} abandoned carts`,
    description: total === 0 
      ? 'No abandoned carts found in Shopify store'
      : synced === 0 
        ? 'All abandoned carts are already synced'
        : `Successfully synced ${synced} new carts from ${total} total abandoned carts${errors > 0 ? ` (${errors} errors)` : ''}`,
    metadata: { synced, total, errors, shop },
    status: errors > 0 ? 'warning' : 'success'
  }),

  campaignCreated: (shop, campaignName) => ({
    type: 'campaign_created',
    title: 'Campaign created',
    description: `Created new email campaign: ${campaignName}`,
    metadata: { campaignName, shop }
  }),

  campaignSent: (shop, campaignName, recipients) => ({
    type: 'campaign_sent',
    title: 'Campaign sent',
    description: `Sent campaign "${campaignName}" to ${recipients} recipients`,
    metadata: { campaignName, recipients, shop }
  }),

  cartRecovered: (shop, cartId, amount) => ({
    type: 'cart_recovered',
    title: 'Cart recovered',
    description: `Successfully recovered abandoned cart worth $${amount}`,
    metadata: { cartId, amount, shop }
  }),

  webhooksSetup: (shop, webhookCount) => ({
    type: 'webhooks_setup',
    title: 'Webhooks configured',
    description: `Successfully configured ${webhookCount} webhooks for real-time cart tracking`,
    metadata: { webhookCount, shop }
  }),

  settingsUpdated: (shop, settingName) => ({
    type: 'settings_updated',
    title: 'Settings updated',
    description: `Updated setting: ${settingName}`,
    metadata: { settingName, shop }
  }),

  founderCloningUploaded: (shop) => ({
    type: 'founder_cloning_uploaded',
    title: 'Founder video uploaded',
    description: 'Successfully uploaded founder video for AI personalization',
    metadata: { shop }
  }),

  founderCloningProcessed: (shop, status) => ({
    type: 'founder_cloning_processed',
    title: 'Founder video processed',
    description: `Founder video processing ${status}`,
    metadata: { status, shop },
    status: status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'info'
  })
};

module.exports = {
  logActivity,
  activityTemplates
}; 