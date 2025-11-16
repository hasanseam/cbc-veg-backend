const express = require('express');
const productRoutes = require('./productRoutes');
const orderRoutes = require('./orderRoutes');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'CBC Vegetable Order API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);

module.exports = router;
