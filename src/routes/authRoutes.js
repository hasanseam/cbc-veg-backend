const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', authController.login);

module.exports = router;
