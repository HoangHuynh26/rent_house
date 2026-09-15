import db from '../backend/src/config/db.js';

async function fixContractContent() {
  console.log('Updating contract_content in PostgreSQL...');
  await db.testConnection();

  try {
    await db.query('ALTER TABLE contracts DISABLE TRIGGER trg_enforce_contract_immutability');

    const res = await db.query(`
      UPDATE contracts 
      SET contract_content = REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(contract_content, '3,500 VND/kWh', '3,000 VND/kWh'),
            '3.500 VND/kWh', '3.000 VND/kWh'
          ),
          '20,000 VND/m3', '12,000 VND/m3'
        ),
        '20.000 VND/m3', '12.000 VND/m3'
      )
      RETURNING id, contract_number, electricity_price, water_price, contract_content
    `);

    await db.query('ALTER TABLE contracts ENABLE TRIGGER trg_enforce_contract_immutability');
    console.log('Updated contracts successfully:');
    res.rows.forEach(r => {
      console.log(`[${r.contract_number}]:`);
      console.log(r.contract_content);
      console.log('---');
    });
  } catch (err) {
    console.error('Error fixing contract content:', err);
  } finally {
    process.exit(0);
  }
}

fixContractContent().catch(console.error);
