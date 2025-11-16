const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
// Use the centralized config for CORS
app.use(cors({ origin: config.cors.origin }));
app.use(compression());

// Use 'dev' in development for cleaner logs, 'combined' in production
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use(limiter);
app.use(express.json({ limit: config.security.maxRequestSize }));
app.use(
  express.urlencoded({ extended: true, limit: config.security.maxRequestSize })
);

// Routes
app.use('/api/v1', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
