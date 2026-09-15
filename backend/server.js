import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import { testConnection } from './src/config/db.js';
import { startAutoBillingScheduler } from './src/services/auto-billing.service.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Attempt connecting to PostgreSQL if DATABASE_URL is configured
    await testConnection();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🏠 RENTAL HOUSE MANAGEMENT SYSTEM - BACKEND API`);
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
      console.log(`🌐 Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`====================================================`);

      // Netlify runs this task via the scheduled function, not a persistent process.
      if (process.env.NETLIFY !== 'true') {
        startAutoBillingScheduler();
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
