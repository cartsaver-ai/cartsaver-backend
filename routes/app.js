const express = require('express');
const router = express.Router();

// Shopify App Navigation Configuration
router.get('/navigation', async (req, res) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Define your app navigation structure
    const navigation = {
      navigation: {
        sections: [
          {
            name: "dashboard",
            title: "Dashboard",
            url: `https://cartsaver-ai.netlify.app/?shop=${shop}`,
            icon: "analytics"
          },
          {
            name: "carts",
            title: "Abandoned Carts",
            url: `https://cartsaver-ai.netlify.app/carts?shop=${shop}`,
            icon: "cart"
          },
          {
            name: "campaigns",
            title: "Email Campaigns",
            url: `https://cartsaver-ai.netlify.app/campaigns?shop=${shop}`,
            icon: "email"
          },
          {
            name: "settings",
            title: "Settings",
            url: `https://cartsaver-ai.netlify.app/settings?shop=${shop}`,
            icon: "settings"
          }
        ]
      }
    };

    res.json(navigation);
  } catch (error) {
    console.error('Navigation error:', error);
    res.status(500).json({ error: 'Failed to load navigation' });
  }
});

module.exports = router; 