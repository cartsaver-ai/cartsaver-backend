const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy for rate limiting (needed when behind a proxy/load balancer)
app.set('trust proxy', 1);

// Import routes
const authRoutes = require('./routes/auth');
const shopifyRoutes = require('./routes/shopify');
const cartRoutes = require('./routes/cart');
const webhookRoutes = require('./routes/webhooks');
const testRoutes = require('./routes/test');
const founderCloningRoutes = require('./routes/founderCloning');
const appRoutes = require('./routes/app');
const activityRoutes = require('./routes/activities');

// Define allowed origins
const allowedOrigins = [
  'https://cartsaver-ai.netlify.app',
  'http://localhost:3000',
  'https://cartsaver-ai.herokuapp.com'
];

// Handle preflight requests early
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 204
}));

// Log preflight requests (for debugging)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log('Preflight request:', req.originalUrl);
  }
  next();
});

// Apply CORS middleware globally
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 204
}));

// Middleware
// app.use(helmet()); // Temporarily disable helmet for CORS testing
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'CartSaver API is running',
    timestamp: new Date().toISOString()
  });
});

// Serve manifest.json for PWA support
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    "short_name": "CartSaver",
    "name": "CartSaver - Shopify Cart Recovery",
    "icons": [
      {
        "src": "/favicon.ico",
        "sizes": "64x64 32x32 24x24 16x16",
        "type": "image/x-icon"
      }
    ],
    "start_url": ".",
    "display": "standalone",
    "theme_color": "#000000",
    "background_color": "#ffffff"
  });
});

// Serve favicon.ico
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content response for favicon
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/test', testRoutes);
app.use('/api/founder-cloning', founderCloningRoutes);
app.use('/api/app', appRoutes);
app.use('/api/activities', activityRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'production' 
      ? process.env.MONGODB_URI_PROD 
      : process.env.MONGODB_URI;
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CartSaver server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();

module.exports = app;