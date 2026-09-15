import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Parse PostgreSQL NUMERIC/DECIMAL (OID 1700) directly to JavaScript floats
pg.types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

let pool = null;
let isConnectedToPostgres = false;

// Initialize Pool if DATABASE_URL is provided
if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('neon.tech') || process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle PostgreSQL client:', err.message);
    });
  } catch (err) {
    console.error('[DB] Failed to initialize pg.Pool:', err.message);
  }
}

// In-Memory fallback store mirroring schema and seeds for offline / dev demo
export const memoryStore = {
  admins: [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      username: 'admin',
      password_hash: '$2b$10$wE3Hj0XqM5mRj6m0vD6YQ.9eL60oFmI5Bshncm0hB69w2U.f1sKCe', // Admin@123456
      full_name: 'Quản Trị Viên Hệ Thống',
      phone: '0909256680',
      role: 'super_admin',
      status: 'active',
      last_login_at: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    }
  ],
  rooms: [
    {
      id: 'd0000000-0000-0000-0000-000000000101',
      room_number: '1',
      floor: 1,
      description: 'Phòng 1, diện tích 25m2, có gác lửng đúc cao ráo, máy lạnh, ban công thoáng mát.',
      status: 'occupied',
      monthly_rent: 3000000.00,
      deleted_at: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      id: 'd0000000-0000-0000-0000-000000000102',
      room_number: '2',
      floor: 1,
      description: 'Phòng 2, diện tích 22m2, có quạt trần, kệ bếp, WC riêng, cửa sổ thoáng đãng.',
      status: 'occupied',
      monthly_rent: 800000.00,
      deleted_at: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      id: 'd0000000-0000-0000-0000-000000000103',
      room_number: '3',
      floor: 1,
      description: 'Phòng 3, diện tích 28m2, full tiện nghi cơ bản, ban công đón nắng gió, phòng còn trống dọn vào ở ngay.',
      status: 'available',
      monthly_rent: 800000.00,
      deleted_at: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    }
  ],
  users: [
    {
      id: '10000000-0000-0000-0000-000000000001',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      full_name: 'Nguyễn Văn An',
      phone: '0912345678',
      email: 'nguyenvanan@gmail.com',
      status: 'active',
      deleted_at: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      room_id: 'd0000000-0000-0000-0000-000000000102',
      full_name: 'Trần Thị Bích',
      phone: '0987654321',
      email: 'tranthibich@gmail.com',
      status: 'active',
      deleted_at: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    }
  ],
  contracts: [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      tenant_id: '10000000-0000-0000-0000-000000000001',
      contract_number: 'HD-2026-P1',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      rent_amount: 3000000.00,
      deposit_amount: 3000000.00,
      electricity_price: 3500.00,
      water_price: 20000.00,
      contract_file_url: null,
      document_hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      contract_content: 'HỢP ĐỒNG THUÊ PHÒNG TRỌ\nBên cho thuê (Bên A): Quản Lý Nhà Trọ Thanh Tâm - SĐT: 0909256680 - Địa chỉ: Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam\nBên thuê (Bên B): Nguyễn Văn An - SĐT: 0912345678\nĐiều 1: Cho thuê Phòng 1 từ 01/01/2026 đến 31/12/2026.\nĐiều 2: Tiền thuê: 3,000,000 VND/tháng. Tiền điện: 3,500 VND/kWh. Tiền nước: 20,000 VND/m3.',
      status: 'signed',
      tenant_signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      admin_signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      signed_at: new Date('2026-01-02T03:00:00Z'),
      signed_ip: '127.0.0.1',
      signed_user_agent: 'Mozilla/5.0 Demo Browser',
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-02T03:00:00Z')
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      room_id: 'd0000000-0000-0000-0000-000000000102',
      tenant_id: '10000000-0000-0000-0000-000000000002',
      contract_number: 'HD-2026-P2',
      start_date: '2026-02-01',
      end_date: '2027-01-31',
      rent_amount: 800000.00,
      deposit_amount: 800000.00,
      electricity_price: 3500.00,
      water_price: 20000.00,
      contract_file_url: null,
      document_hash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
      contract_content: 'HỢP ĐỒNG THUÊ PHÒNG TRỌ\nBên cho thuê (Bên A): Quản Lý Nhà Trọ Thanh Tâm - SĐT: 0909256680 - Địa chỉ: Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam\nBên thuê (Bên B): Trần Thị Bích - SĐT: 0987654321\nĐiều 1: Cho thuê Phòng 2 từ 01/02/2026 đến 31/01/2027.\nĐiều 2: Tiền thuê: 800,000 VND/tháng. Tiền điện: 3,500 VND/kWh. Tiền nước: 20,000 VND/m3.',
      status: 'signed',
      tenant_signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      admin_signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      signed_at: new Date('2026-02-02T03:00:00Z'),
      signed_ip: '127.0.0.1',
      signed_user_agent: 'Mozilla/5.0 Demo Browser',
      created_at: new Date('2026-02-01T00:00:00Z'),
      updated_at: new Date('2026-02-02T03:00:00Z')
    }
  ],
  meter_images: [],
  electricity_readings: [
    {
      id: 'e0000000-0000-0000-0000-000000000007',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      meter_image_id: null,
      reading_month: 7,
      reading_year: 2026,
      previous_value: 1000.00,
      current_value: 1120.00,
      consumption: 120.00,
      unit_price: 3500.00,
      amount: 420000.00,
      image_url: '/uploads/meters/sample_elec.jpg',
      ai_detected_value: 1120.00,
      ai_confidence: 0.96,
      image_quality_score: 0.94,
      verification_status: 'approved',
      verified_by: 'a0000000-0000-0000-0000-000000000001',
      verified_at: new Date('2026-07-31T10:00:00Z'),
      is_meter_reset: false,
      created_at: new Date('2026-07-31T10:00:00Z'),
      updated_at: new Date('2026-07-31T10:00:00Z')
    },
    {
      id: 'e0000000-0000-0000-0000-000000000008',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      meter_image_id: null,
      reading_month: 8,
      reading_year: 2026,
      previous_value: 1120.00,
      current_value: 1250.00,
      consumption: 130.00,
      unit_price: 3500.00,
      amount: 455000.00,
      image_url: '/uploads/meters/sample_elec.jpg',
      ai_detected_value: 1250.00,
      ai_confidence: 0.95,
      image_quality_score: 0.92,
      verification_status: 'approved',
      verified_by: 'a0000000-0000-0000-0000-000000000001',
      verified_at: new Date('2026-08-31T10:00:00Z'),
      is_meter_reset: false,
      created_at: new Date('2026-08-31T10:00:00Z'),
      updated_at: new Date('2026-08-31T10:00:00Z')
    },
    {
      id: 'e0000000-0000-0000-0000-000000000009',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      meter_image_id: null,
      reading_month: 9,
      reading_year: 2026,
      previous_value: 1250.00,
      current_value: 1380.00,
      consumption: 130.00,
      unit_price: 3500.00,
      amount: 455000.00,
      image_url: '/uploads/meters/sample_elec.jpg',
      ai_detected_value: 1380.00,
      ai_confidence: 0.94,
      image_quality_score: 0.91,
      verification_status: 'approved',
      verified_by: 'a0000000-0000-0000-0000-000000000001',
      verified_at: new Date('2026-09-01T10:00:00Z'),
      is_meter_reset: false,
      created_at: new Date('2026-09-01T10:00:00Z'),
      updated_at: new Date('2026-09-01T10:00:00Z')
    }
  ],
  water_readings: [
    {
      id: 'f0000000-0000-0000-0000-000000000007',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      meter_image_id: null,
      reading_month: 7,
      reading_year: 2026,
      previous_value: 45.00,
      current_value: 54.00,
      consumption: 9.00,
      unit_price: 20000.00,
      amount: 180000.00,
      image_url: '/uploads/meters/sample_water.jpg',
      ai_detected_value: 54.00,
      ai_confidence: 0.92,
      image_quality_score: 0.90,
      verification_status: 'approved',
      verified_by: 'a0000000-0000-0000-0000-000000000001',
      verified_at: new Date('2026-07-31T10:00:00Z'),
      is_meter_reset: false,
      created_at: new Date('2026-07-31T10:00:00Z'),
      updated_at: new Date('2026-07-31T10:00:00Z')
    },
    {
      id: 'f0000000-0000-0000-0000-000000000008',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      meter_image_id: null,
      reading_month: 8,
      reading_year: 2026,
      previous_value: 54.00,
      current_value: 64.00,
      consumption: 10.00,
      unit_price: 20000.00,
      amount: 200000.00,
      image_url: '/uploads/meters/sample_water.jpg',
      ai_detected_value: 64.00,
      ai_confidence: 0.94,
      image_quality_score: 0.93,
      verification_status: 'approved',
      verified_by: 'a0000000-0000-0000-0000-000000000001',
      verified_at: new Date('2026-08-31T10:00:00Z'),
      is_meter_reset: false,
      created_at: new Date('2026-08-31T10:00:00Z'),
      updated_at: new Date('2026-08-31T10:00:00Z')
    },
    {
      id: 'f0000000-0000-0000-0000-000000000009',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      meter_image_id: null,
      reading_month: 9,
      reading_year: 2026,
      previous_value: 64.00,
      current_value: 70.00,
      consumption: 6.00,
      unit_price: 20000.00,
      amount: 120000.00,
      image_url: '/uploads/meters/sample_water.jpg',
      ai_detected_value: 70.00,
      ai_confidence: 0.95,
      image_quality_score: 0.91,
      verification_status: 'approved',
      verified_by: 'a0000000-0000-0000-0000-000000000001',
      verified_at: new Date('2026-09-01T10:00:00Z'),
      is_meter_reset: false,
      created_at: new Date('2026-09-01T10:00:00Z'),
      updated_at: new Date('2026-09-01T10:00:00Z')
    }
  ],
  bills: [
    {
      id: 'b0000000-0000-0000-0000-000000000008',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      tenant_id: '10000000-0000-0000-0000-000000000001',
      contract_id: 'c0000000-0000-0000-0000-000000000001',
      electricity_reading_id: 'e0000000-0000-0000-0000-000000000008',
      water_reading_id: 'f0000000-0000-0000-0000-000000000008',
      billing_month: 8,
      billing_year: 2026,
      electricity_amount: 455000.00,
      water_amount: 200000.00,
      rent_amount: 3000000.00,
      discount_amount: 0.00,
      total_amount: 3655000.00,
      status: 'paid',
      payment_method: 'transfer',
      due_date: '2026-08-05',
      paid_at: new Date('2026-08-04T07:30:00Z'),
      created_at: new Date('2026-08-01T00:00:00Z'),
      updated_at: new Date('2026-08-04T07:30:00Z')
    },
    {
      id: 'b0000000-0000-0000-0000-000000000009',
      room_id: 'd0000000-0000-0000-0000-000000000101',
      tenant_id: '10000000-0000-0000-0000-000000000001',
      contract_id: 'c0000000-0000-0000-0000-000000000001',
      electricity_reading_id: 'e0000000-0000-0000-0000-000000000009',
      water_reading_id: 'f0000000-0000-0000-0000-000000000009',
      billing_month: 9,
      billing_year: 2026,
      electricity_amount: 455000.00,
      water_amount: 120000.00,
      rent_amount: 3000000.00,
      discount_amount: 5000.00,
      total_amount: 3570000.00,
      status: 'unpaid',
      payment_method: null,
      due_date: '2026-09-13',
      paid_at: null,
      created_at: new Date('2026-09-01T00:00:00Z'),
      updated_at: new Date('2026-09-01T00:00:00Z')
    },
    {
      id: 'b0000000-0000-0000-0000-000000000208',
      room_id: 'd0000000-0000-0000-0000-000000000102',
      tenant_id: '10000000-0000-0000-0000-000000000002',
      contract_id: 'c0000000-0000-0000-0000-000000000002',
      electricity_reading_id: 'e0000000-0000-0000-0000-000000000208',
      water_reading_id: 'f0000000-0000-0000-0000-000000000208',
      billing_month: 8,
      billing_year: 2026,
      electricity_amount: 385000.00,
      water_amount: 160000.00,
      rent_amount: 800000.00,
      discount_amount: 0.00,
      total_amount: 1345000.00,
      status: 'paid',
      payment_method: 'transfer',
      due_date: '2026-08-05',
      paid_at: new Date('2026-08-05T04:00:00Z'),
      created_at: new Date('2026-08-01T00:00:00Z'),
      updated_at: new Date('2026-08-05T04:00:00Z')
    },
    {
      id: 'b0000000-0000-0000-0000-000000000209',
      room_id: 'd0000000-0000-0000-0000-000000000102',
      tenant_id: '10000000-0000-0000-0000-000000000002',
      contract_id: 'c0000000-0000-0000-0000-000000000002',
      electricity_reading_id: 'e0000000-0000-0000-0000-000000000209',
      water_reading_id: 'f0000000-0000-0000-0000-000000000209',
      billing_month: 9,
      billing_year: 2026,
      electricity_amount: 402500.00,
      water_amount: 140000.00,
      rent_amount: 800000.00,
      discount_amount: 0.00,
      total_amount: 1342500.00,
      status: 'unpaid',
      payment_method: null,
      due_date: '2026-09-13',
      paid_at: null,
      created_at: new Date('2026-09-01T00:00:00Z'),
      updated_at: new Date('2026-09-01T00:00:00Z')
    }
  ],
  notifications: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      recipient_type: 'tenant',
      recipient_id: '10000000-0000-0000-0000-000000000001',
      title: 'Hóa đơn tiền phòng Tháng 09/2026',
      message: 'Hóa đơn tháng 09/2026 của phòng P101 đã sẵn sàng. Tổng tiền: 3,070,000 VND. Hạn đóng: 15/09/2026.',
      type: 'bill',
      is_read: false,
      metadata: { bill_id: 'b0000000-0000-0000-0000-000000000009' },
      created_at: new Date('2026-09-01T00:00:00Z')
    }
  ],
  audit_logs: [],
  ai_predictions: [],
  ai_training_samples: [],
  active_otps: new Map() // phone -> { otp, expiresAt }
};

export const query = async (text, params) => {
  if (pool) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      console.warn(`[DB PostgreSQL Query Error]: ${err.message}. Text: ${text}`);
      throw err;
    }
  }
  throw new Error('Database pool not connected. Running in mock adapter mode.');
};

export const testConnection = async () => {
  if (!pool) {
    console.log('[DB] Running with in-memory adapter (DATABASE_URL not specified).');
    return false;
  }
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now');
    client.release();
    isConnectedToPostgres = true;
    console.log(`[DB] Connected to PostgreSQL at ${res.rows[0].now}`);
    return true;
  } catch (err) {
    console.warn(`[DB] Could not connect to PostgreSQL: ${err.message}. Falling back to in-memory adapter.`);
    isConnectedToPostgres = false;
    return false;
  }
};

export const isPostgresActive = () => isConnectedToPostgres;

export default {
  query,
  testConnection,
  isPostgresActive,
  memoryStore
};
