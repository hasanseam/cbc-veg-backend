require('dotenv').config();

const config = {
  // Server Configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',

  // Database Configuration
  db: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'cbc_vegetable_order',
    user: process.env.DB_USER || 'cbc_admin',
    password: process.env.DB_PASSWORD || 'cbc_secure_password_123',
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Email Configuration
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || 'CBC Vegetable Order',
    },
    orderRecipients: (process.env.ORDER_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE',
  },

  // Security Configuration
  security: {
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
  },
};

// Validate required configurations
const requiredConfigs = {
  'JWT Secret': config.jwt.secret,
  'Database Password': config.db.password,
};

Object.entries(requiredConfigs).forEach(([name, value]) => {
  if (value === undefined) {
    throw new Error(`Required configuration "${name}" is missing`);
  }
});

// Validate email configuration if any email-related env vars are set
if (config.email.smtp.user || config.email.smtp.pass || config.email.from.email) {
  const requiredEmailConfigs = {
    'SMTP User': config.email.smtp.user,
    'SMTP Password': config.email.smtp.pass,
    'From Email': config.email.from.email,
  };

  Object.entries(requiredEmailConfigs).forEach(([name, value]) => {
    if (!value) {
      console.warn(`Warning: Email configuration "${name}" is missing`);
    }
  });
}

module.exports = config; 