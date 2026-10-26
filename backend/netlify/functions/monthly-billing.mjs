import { runAutoMonthlyBilling } from '../../src/services/auto-billing.service.js';

// Netlify invokes this at 03:00 UTC (10:00 Asia/Ho_Chi_Minh) on the 10th.
export default async () => {
  try {
    const result = await runAutoMonthlyBilling({ force: false });
    console.log('[monthly-billing]', result.message);
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    console.error('[monthly-billing] failed:', error);
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
};
