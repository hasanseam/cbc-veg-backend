const bcrypt = require('bcryptjs');

/**
 * Hashes a plain text password using bcrypt.
 * @param {string} password The plain text password to hash.
 * @returns {Promise<string>} A promise that resolves with the hashed password.
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

module.exports = {
  hashPassword,
};
