import { query } from '../backend/src/config/db.js';

async function check() {
  const res = await query(`
    SELECT u.id, u.full_name, u.phone, u.status, r.room_number, r.status as room_status
    FROM users u 
    LEFT JOIN rooms r ON u.room_id = r.id 
    ORDER BY r.room_number ASC
  `);
  console.log('All Users/Tenants in DB:', JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
