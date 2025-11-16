const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('connect', () => {
  console.log('🔌 New client connected to the database pool.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Add the testConnection function
const testConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    // If we got a client, the connection is successful.
    return client;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Export both pool and testConnection
module.exports = {
  pool,
  testConnection,
};
