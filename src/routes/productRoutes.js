const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Get all products
router.get('/', productController.getAllProducts);

// Get all Kitchen products
router.get('/type/kitchen', productController.getAllKitchenProducts);

// Get all Bar products
router.get('/type/bar', productController.getAllBarProducts);

// Get product categories
router.get('/categories', productController.getCategories);

// Get low stock products - Protected
router.get('/low-stock', productController.getLowStockProducts);

// Get stock report - Protected
router.get('/stock-report', productController.getStockReport);

// Get product by ID
router.get('/:id', productController.getProductById);

// Create new product
router.post('/', productController.createProduct);

// Update product
router.put('/:id', productController.updateProduct);

// Update stock only
router.patch('/:id/stock', productController.updateStock);

// Delete product
router.delete('/:id', productController.deleteProduct);

module.exports = router;
