import serverless from 'serverless-http';
import app from '../../src/app.js';
import { testConnection } from '../../src/config/db.js';

const expressHandler = serverless(app);
const functionPrefix = '/.netlify/functions/api';

let dbWarmupDone = false;
async function ensureDb() {
  if (dbWarmupDone) return;
  dbWarmupDone = true;
  try {
    await testConnection();
  } catch (err) {
    console.warn('[Serverless DB Warmup Warning]:', err.message);
  }
}

export const handler = async (event, context, callback) => {
  // Prevent Lambda from freezing on idle pg pool connections
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  // Probe database connection on cold start
  await ensureDb();

  const normalized = { ...event };
  for (const field of ['path', 'rawPath', 'requestPath']) {
    if (typeof normalized[field] === 'string') {
      let p = normalized[field];
      if (p.startsWith(functionPrefix)) {
        p = p.slice(functionPrefix.length) || '/';
      }
      // Ensure path matches Express routes (/api/..., /uploads/..., /health)
      if (p && !p.startsWith('/api') && !p.startsWith('/uploads') && !p.startsWith('/health')) {
        p = '/api' + (p.startsWith('/') ? p : '/' + p);
      }
      normalized[field] = p;
    }
  }

  try {
    return await expressHandler(normalized, context, callback);
  } catch (err) {
    console.error('[Serverless Handler Error]:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: false,
        message: 'Lỗi máy chủ nội bộ (Serverless Function Error): ' + (err.message || 'Unknown error')
      })
    };
  }
};
