import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { UPLOAD_DIR } from './services/storage.service.js';

const app = express();

// Trust reverse proxy (Netlify, Render, Cloudflare, Load Balancer)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration (supports credentials for cookies & custom session headers)
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://nhatrothanhtam.netlify.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
  ...envOrigins
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.netlify.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback for flexible public access
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-admin-session',
    'x-tenant-session',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
}));

// Parsers
app.use(express.json({ limit: '15mb' })); // Allows Base64 canvas signatures
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Static uploads (meter photos and contracts) - support both /uploads and /api/uploads
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/api/uploads', express.static(UPLOAD_DIR));

import { isPostgresActive, query } from './config/db.js';

// Health check with live database status
app.get(['/health', '/api/health'], async (req, res) => {
  let dbDetails = {
    connected: isPostgresActive(),
    mode: isPostgresActive() ? 'neon_postgresql' : 'in_memory'
  };

  if (isPostgresActive()) {
    try {
      const dbCheck = await query('SELECT current_database(), current_user, version()');
      const roomsCount = await query('SELECT count(*)::int as count FROM rooms WHERE deleted_at IS NULL');
      const dbUrl = process.env.DATABASE_URL || '';
      let host = 'neon.tech';
      try {
        const parsed = new URL(dbUrl);
        host = parsed.host;
      } catch (e) {}

      dbDetails = {
        connected: true,
        mode: 'neon_postgresql',
        host: host,
        database: dbCheck.rows[0]?.current_database || 'neondb',
        user: dbCheck.rows[0]?.current_user || 'neondb_owner',
        active_rooms: roomsCount.rows[0]?.count || 0
      };
    } catch (err) {
      dbDetails.error = err.message;
    }
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'rental-house-backend-api',
    database: dbDetails
  });
});

// Mount API routes
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

export default app;
