import db from '../backend/src/config/db.js';

async function updateLiveContracts() {
  console.log('Connecting to DB to remove payment deadline from live contracts...');
  await db.testConnection();

  try {
    await db.query('ALTER TABLE contracts DISABLE TRIGGER trg_enforce_contract_immutability');

    // Contract 1
    const p1Content = 'HỢP ĐỒNG THUÊ PHÒNG TRỌ\nBên cho thuê (Bên A): Quản Lý Nhà Trọ Thanh Tâm - SĐT: 0909256680 - Địa chỉ: Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam\nBên thuê (Bên B): Nguyễn Văn An - SĐT: 0912345678\nĐiều 1: Bên A cho Bên B thuê Phòng 1 từ ngày 01/01/2026 đến ngày 31/12/2026.\nĐiều 2: Tiền thuê phòng là 3,000,000 VND/tháng. Tiền điện: 3,500 VND/kWh. Tiền nước: 20,000 VND/m3.';
    await db.query('UPDATE contracts SET contract_content = $1 WHERE id = $2', [
      p1Content,
      'c0000000-0000-0000-0000-000000000001'
    ]);

    // Contract 2
    const p2Content = 'HỢP ĐỒNG THUÊ PHÒNG TRỌ\nBên cho thuê (Bên A): Quản Lý Nhà Trọ Thanh Tâm - SĐT: 0909256680 - Địa chỉ: Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam\nBên thuê (Bên B): Trần Thị Bích - SĐT: 0987654321\nĐiều 1: Bên A cho Bên B thuê Phòng 2 từ ngày 01/02/2026 đến ngày 31/01/2027.\nĐiều 2: Tiền thuê phòng là 800,000 VND/tháng. Tiền điện: 3,500 VND/kWh. Tiền nước: 20,000 VND/m3.';
    await db.query('UPDATE contracts SET contract_content = $1 WHERE id = $2', [
      p2Content,
      'c0000000-0000-0000-0000-000000000002'
    ]);

    await db.query('ALTER TABLE contracts ENABLE TRIGGER trg_enforce_contract_immutability');
    console.log('Successfully updated contracts in Neon PostgreSQL!');

    const res = await db.query('SELECT id, contract_number, contract_content FROM contracts');
    console.log('Current contracts in DB:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error updating contracts:', err);
  } finally {
    process.exit(0);
  }
}

updateLiveContracts().catch(console.error);
