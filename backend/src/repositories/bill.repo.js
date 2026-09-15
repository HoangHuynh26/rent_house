import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const findAll = async (filter = {}) => {
  if (isPostgresActive()) {
    let q = `
      SELECT b.*, r.room_number, u.full_name as tenant_name, u.phone as tenant_phone,
             er.current_value as elec_current, er.previous_value as elec_previous, er.consumption as elec_kwh, er.unit_price as elec_unit_price, er.image_url as elec_image,
             COALESCE(ermi.captured_at, er.created_at) as elec_captured_at,
             wr.current_value as water_current, wr.previous_value as water_previous, wr.consumption as water_m3, wr.unit_price as water_unit_price, wr.image_url as water_image,
             COALESCE(wrmi.captured_at, wr.created_at) as water_captured_at
      FROM bills b
      JOIN rooms r ON b.room_id = r.id
      JOIN users u ON b.tenant_id = u.id
      LEFT JOIN electricity_readings er ON b.electricity_reading_id = er.id
      LEFT JOIN meter_images ermi ON er.meter_image_id = ermi.id
      LEFT JOIN water_readings wr ON b.water_reading_id = wr.id
      LEFT JOIN meter_images wrmi ON wr.meter_image_id = wrmi.id
      WHERE 1=1
    `;
    const params = [];
    if (filter.roomId) {
      params.push(filter.roomId);
      q += ` AND b.room_id = $${params.length}`;
    }
    if (filter.tenantId) {
      params.push(filter.tenantId);
      q += ` AND b.tenant_id = $${params.length}`;
    }
    if (filter.month) {
      params.push(filter.month);
      q += ` AND b.billing_month = $${params.length}`;
    }
    if (filter.year) {
      params.push(filter.year);
      q += ` AND b.billing_year = $${params.length}`;
    }
    if (filter.status) {
      params.push(filter.status);
      q += ` AND b.status = $${params.length}`;
    }
    q += ` ORDER BY b.billing_year DESC, b.billing_month DESC, r.room_number ASC`;
    const res = await query(q, params);
    return res.rows;
  }

  let list = memoryStore.bills;
  if (filter.roomId) list = list.filter(b => b.room_id === filter.roomId);
  if (filter.tenantId) list = list.filter(b => b.tenant_id === filter.tenantId);
  if (filter.month) list = list.filter(b => b.billing_month === Number(filter.month));
  if (filter.year) list = list.filter(b => b.billing_year === Number(filter.year));
  if (filter.status) list = list.filter(b => b.status === filter.status);

  return list.map(b => {
    const r = memoryStore.rooms.find(rm => rm.id === b.room_id);
    const u = memoryStore.users.find(usr => usr.id === b.tenant_id);
    const er = memoryStore.electricity_readings.find(e => e.id === b.electricity_reading_id);
    const wr = memoryStore.water_readings.find(w => w.id === b.water_reading_id);
    const erImg = er?.meter_image_id ? memoryStore.meter_images?.find(m => m.id === er.meter_image_id) : null;
    const wrImg = wr?.meter_image_id ? memoryStore.meter_images?.find(m => m.id === wr.meter_image_id) : null;
    return {
      ...b,
      room_number: r ? r.room_number : null,
      tenant_name: u ? u.full_name : null,
      tenant_phone: u ? u.phone : null,
      elec_current: er ? er.current_value : null,
      elec_previous: er ? er.previous_value : null,
      elec_kwh: er ? er.consumption : null,
      elec_unit_price: er ? er.unit_price : null,
      elec_image: er ? er.image_url : null,
      elec_captured_at: erImg?.captured_at || er?.created_at || null,
      water_current: wr ? wr.current_value : null,
      water_previous: wr ? wr.previous_value : null,
      water_m3: wr ? wr.consumption : null,
      water_unit_price: wr ? wr.unit_price : null,
      water_image: wr ? wr.image_url : null,
      water_captured_at: wrImg?.captured_at || wr?.created_at || null
    };
  }).sort((a, b) => b.billing_year - a.billing_year || b.billing_month - a.billing_month);
};

export const findById = async (id) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT b.*, r.room_number, u.full_name as tenant_name, u.phone as tenant_phone,
              er.current_value as elec_current, er.previous_value as elec_previous, er.consumption as elec_kwh, er.unit_price as elec_unit_price, er.image_url as elec_image,
              COALESCE(ermi.captured_at, er.created_at) as elec_captured_at,
              wr.current_value as water_current, wr.previous_value as water_previous, wr.consumption as water_m3, wr.unit_price as water_unit_price, wr.image_url as water_image,
              COALESCE(wrmi.captured_at, wr.created_at) as water_captured_at
       FROM bills b
       JOIN rooms r ON b.room_id = r.id
       JOIN users u ON b.tenant_id = u.id
       LEFT JOIN electricity_readings er ON b.electricity_reading_id = er.id
       LEFT JOIN meter_images ermi ON er.meter_image_id = ermi.id
       LEFT JOIN water_readings wr ON b.water_reading_id = wr.id
       LEFT JOIN meter_images wrmi ON wr.meter_image_id = wrmi.id
       WHERE b.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  const b = memoryStore.bills.find(item => item.id === id);
  if (!b) return null;
  const r = memoryStore.rooms.find(rm => rm.id === b.room_id);
  const u = memoryStore.users.find(usr => usr.id === b.tenant_id);
  const er = memoryStore.electricity_readings.find(e => e.id === b.electricity_reading_id);
  const wr = memoryStore.water_readings.find(w => w.id === b.water_reading_id);
  const erImg = er?.meter_image_id ? memoryStore.meter_images?.find(m => m.id === er.meter_image_id) : null;
  const wrImg = wr?.meter_image_id ? memoryStore.meter_images?.find(m => m.id === wr.meter_image_id) : null;

  return {
    ...b,
    room_number: r ? r.room_number : null,
    tenant_name: u ? u.full_name : null,
    tenant_phone: u ? u.phone : null,
    elec_current: er ? er.current_value : null,
    elec_previous: er ? er.previous_value : null,
    elec_kwh: er ? er.consumption : null,
    elec_unit_price: er ? er.unit_price : null,
    elec_image: er ? er.image_url : null,
    elec_captured_at: erImg?.captured_at || er?.created_at || null,
    water_current: wr ? wr.current_value : null,
    water_previous: wr ? wr.previous_value : null,
    water_m3: wr ? wr.consumption : null,
    water_unit_price: wr ? wr.unit_price : null,
    water_image: wr ? wr.image_url : null,
    water_captured_at: wrImg?.captured_at || wr?.created_at || null
  };
};

export const findByRoomAndPeriod = async (roomId, month, year) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT * FROM bills WHERE room_id = $1 AND billing_month = $2 AND billing_year = $3`,
      [roomId, month, year]
    );
    return res.rows[0] || null;
  }
  return memoryStore.bills.find(
    b => b.room_id === roomId && b.billing_month === Number(month) && b.billing_year === Number(year)
  ) || null;
};

export const create = async (billData) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const rent = Number(billData.rent_amount || 0);
  const elec = Number(billData.electricity_amount || 0);
  const water = Number(billData.water_amount || 0);
  const discount = Number(billData.discount_amount || 0);
  const total = rent + elec + water - discount;

  const sanitizeUuid = (val) => (val && typeof val === 'string' && val.trim().length === 36 ? val.trim() : null);
  const contractId = sanitizeUuid(billData.contract_id);
  const elecReadingId = sanitizeUuid(billData.electricity_reading_id);
  const waterReadingId = sanitizeUuid(billData.water_reading_id);
  const bMonth = Number(billData.billing_month);
  const bYear = Number(billData.billing_year);

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO bills (
        id, room_id, tenant_id, contract_id,
        electricity_reading_id, water_reading_id,
        billing_month, billing_year,
        electricity_amount, water_amount, rent_amount, discount_amount,
        total_amount, status, payment_method, due_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (room_id, billing_month, billing_year) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        contract_id = COALESCE(EXCLUDED.contract_id, bills.contract_id),
        electricity_reading_id = COALESCE(EXCLUDED.electricity_reading_id, bills.electricity_reading_id),
        water_reading_id = COALESCE(EXCLUDED.water_reading_id, bills.water_reading_id),
        electricity_amount = EXCLUDED.electricity_amount,
        water_amount = EXCLUDED.water_amount,
        rent_amount = EXCLUDED.rent_amount,
        discount_amount = EXCLUDED.discount_amount,
        total_amount = EXCLUDED.total_amount,
        due_date = EXCLUDED.due_date,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, billData.room_id, billData.tenant_id, contractId,
        elecReadingId, waterReadingId,
        bMonth, bYear,
        elec, water, rent,
        discount,
        total, billData.status || 'unpaid', billData.payment_method || null, billData.due_date, now, now
      ]
    );
    return res.rows[0];
  }

  const existingIdx = memoryStore.bills.findIndex(
    b => b.room_id === billData.room_id && b.billing_month === bMonth && b.billing_year === bYear
  );
  if (existingIdx >= 0) {
    const existing = memoryStore.bills[existingIdx];
    Object.assign(existing, {
      tenant_id: billData.tenant_id,
      contract_id: contractId || existing.contract_id,
      electricity_reading_id: elecReadingId || existing.electricity_reading_id,
      water_reading_id: waterReadingId || existing.water_reading_id,
      electricity_amount: elec,
      water_amount: water,
      rent_amount: rent,
      discount_amount: discount,
      total_amount: total,
      due_date: billData.due_date,
      updated_at: now
    });
    return existing;
  }

  const newBill = {
    id,
    room_id: billData.room_id,
    tenant_id: billData.tenant_id,
    contract_id: contractId,
    electricity_reading_id: elecReadingId,
    water_reading_id: waterReadingId,
    billing_month: bMonth,
    billing_year: bYear,
    electricity_amount: elec,
    water_amount: water,
    rent_amount: rent,
    discount_amount: discount,
    total_amount: total,
    status: billData.status || 'unpaid',
    payment_method: billData.payment_method || null,
    due_date: billData.due_date,
    paid_at: null,
    created_at: now,
    updated_at: now
  };
  memoryStore.bills.push(newBill);
  return newBill;
};


export const updateStatus = async (id, status, paidAt = null, paymentMethod = null) => {
  const now = new Date();
  if (isPostgresActive()) {
    const res = await query(
      `UPDATE bills SET status = $1, paid_at = $2, payment_method = $3, updated_at = $4 WHERE id = $5 RETURNING *`,
      [status, paidAt, paymentMethod, now, id]
    );
    return res.rows[0];
  }
  const bill = memoryStore.bills.find(b => b.id === id);
  if (!bill) return null;
  bill.status = status;
  bill.paid_at = paidAt;
  bill.payment_method = paymentMethod;
  bill.updated_at = now;
  return bill;
};

export const deleteById = async (id) => {
  if (isPostgresActive()) {
    const res = await query('DELETE FROM bills WHERE id = $1 RETURNING *', [id]);
    return res.rows[0] || null;
  }
  const idx = memoryStore.bills.findIndex(item => item.id === id);
  if (idx === -1) return null;
  const [deleted] = memoryStore.bills.splice(idx, 1);
  return deleted;
};
