const jwt = require('jsonwebtoken');
const config = require('../config');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Attach user to the request
    req.user = decoded.user;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res
      .status(401)
      .json({ success: false, message: 'Not authorized, token failed' });
  }
};

module.exports = {
  protect,
};
