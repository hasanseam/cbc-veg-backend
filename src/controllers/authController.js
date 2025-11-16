const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required',
        });
      }

      // Find user by username
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      const user = result.rows[0];

      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: 'Invalid credentials' });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: 'Invalid credentials' });
      }

      // Create JWT payload
      const payload = {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      };

      // Sign the token
      const token = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });

      res.json({ success: true, message: 'Login successful', token });
    } catch (error) {
      console.error('Error during login:', error);
      res
        .status(500)
        .json({ success: false, message: 'Server error during login' });
    }
  }
}

module.exports = new AuthController();
