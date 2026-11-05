
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// Render and other reverse-proxy deployments.
app.set('trust proxy', 1);

const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Security headers.
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

// CORS.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed.'));
    },
    credentials: true
  })
);

// Request body parsing.
app.use(express.json({ limit: '1mb' }));

// API rate limits.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Health check.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'OM RIDHI SIDHI API'
  });
});

// API routes.
app.use('/api', require('./routes/api'));

// Prevent public access to private project files.
app.use((req, res, next) => {
  const requestPath = req.path;

  const blockedPaths = [
    /^\/backend(?:\/|$)/i,
    /^\/node_modules(?:\/|$)/i,
    /^\/\.git(?:\/|$)/i,
    /^\/package(?:-lock)?\.json$/i,
    /^\/README\.md$/i
  ];

  if (blockedPaths.some((pattern) => pattern.test(requestPath))) {
    return res.status(404).send('Not found.');
  }

  next();
});

// Serve public website files.
const publicRoot = path.resolve(__dirname, '../../');

app.use(
  express.static(publicRoot, {
    dotfiles: 'deny',
    index: 'index.html',
    etag: true,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
  })
);

// 404 for unknown routes.
app.use((req, res) => {
  res.status(404).json({
    error: 'The requested resource was not found.'
  });
});

// Central error handler.
app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === '23505') {
    return res.status(409).json({
      error: 'This record already exists.'
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Referenced record does not exist.'
    });
  }

  res.status(err.status || 500).json({
    error: err.status
      ? err.message
      : 'Something went wrong.'
  });
});

// Start server.
const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`OM RIDHI SIDHI listening on ${port}`);
});

// Reservation expiry worker.
const { expireReservations } = require('./jobs/expire-reservations');

const timer = setInterval(() => {
  expireReservations().catch((error) => {
    console.error('Reservation expiry worker:', error);
  });
}, 5 * 60 * 1000);

timer.unref();

module.exports = {
  app,
  server
};
