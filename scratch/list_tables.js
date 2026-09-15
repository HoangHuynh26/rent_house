import { query } from '../backend/src/config/db.js';

async function listTables() {
  const res = await query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  `);
  console.log('Tables in DB:', res.rows);
  process.exit(0);
}

listTables().catch(e => { console.error(e); process.exit(1); });
