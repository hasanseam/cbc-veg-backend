const app = require('./app'); // Import the configured Express app
const config = require('./config');
const { testConnection } = require('./config/database');

// Only start the server if not in a test environment
if (config.nodeEnv !== 'test') {
  app.listen(config.port, config.host, async () => {
    console.log(`🚀 Server running on http://${config.host}:${config.port}`);
    console.log(`📝 Environment: ${config.nodeEnv}`);
    await testConnection(); // Test DB connection on startup
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
