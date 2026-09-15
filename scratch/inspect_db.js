import db from '../backend/src/config/db.js';

async function main() {
  const res = await db.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position;
  `);
  const tables = {};
  res.rows.forEach(r => {
    if (!tables[r.table_name]) tables[r.table_name] = [];
    tables[r.table_name].push(r.column_name);
  });
  console.log(JSON.stringify(tables, null, 2));
  process.exit(0);
}

main().catch(console.error);
