const mongoose = require('mongoose');
const Shop = require('../models/Shop');
require('dotenv').config();

const fixInstalledDates = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find all shops that don't have installedAt or have invalid dates
    const shops = await Shop.find({
      $or: [
        { installedAt: { $exists: false } },
        { installedAt: null },
        { installedAt: { $type: 'invalid' } }
      ]
    });

    console.log(`Found ${shops.length} shops with missing or invalid installedAt dates`);

    if (shops.length === 0) {
      console.log('All shops have valid installedAt dates!');
      return;
    }

    // Update each shop with a proper installedAt date
    for (const shop of shops) {
      // Use createdAt as fallback, or current date if that's also missing
      const installedDate = shop.createdAt || new Date();
      
      await Shop.findByIdAndUpdate(shop._id, {
        installedAt: installedDate
      });
      
      console.log(`Updated shop ${shop.shop} with installedAt: ${installedDate}`);
    }

    console.log('Successfully updated all shops with proper installedAt dates');

  } catch (error) {
    console.error('Error fixing installed dates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the migration if this script is executed directly
if (require.main === module) {
  fixInstalledDates();
}

module.exports = fixInstalledDates; 