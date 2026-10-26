import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const findAll = async (includeDeleted = false) => {
  if (isPostgresActive()) {
    const q = includeDeleted
      ? `SELECT r.*, 
                COALESCE(u.id, ct.tenant_id) as current_tenant_id, 
                COALESCE(u.full_name, ct.tenant_name) as current_tenant_name, 
                COALESCE(u.phone, ct.tenant_phone) as current_tenant_phone,
                c.electricity_price, c.water_price
         FROM rooms r
         LEFT JOIN users u ON r.id = u.room_id AND u.deleted_at IS NULL AND u.status = 'active'
         LEFT JOIN LATERAL (
           SELECT con.tenant_id, usr.full_name as tenant_name, usr.phone as tenant_phone
           FROM contracts con
           JOIN users usr ON con.tenant_id = usr.id
           WHERE con.room_id = r.id AND con.status IN ('signed', 'pending_signature', 'draft')
           ORDER BY con.created_at DESC LIMIT 1
         ) ct ON true
         LEFT JOIN LATERAL (
           SELECT electricity_price, water_price 
           FROM contracts 
           WHERE room_id = r.id AND status IN ('signed', 'pending_signature', 'draft')
           ORDER BY created_at DESC LIMIT 1
         ) c ON true
         ORDER BY r.floor ASC, r.room_number ASC`
      : `SELECT r.*, 
                COALESCE(u.id, ct.tenant_id) as current_tenant_id, 
                COALESCE(u.full_name, ct.tenant_name) as current_tenant_name, 
                COALESCE(u.phone, ct.tenant_phone) as current_tenant_phone,
                c.electricity_price, c.water_price
         FROM rooms r
         LEFT JOIN users u ON r.id = u.room_id AND u.deleted_at IS NULL AND u.status = 'active'
         LEFT JOIN LATERAL (
           SELECT con.tenant_id, usr.full_name as tenant_name, usr.phone as tenant_phone
           FROM contracts con
           JOIN users usr ON con.tenant_id = usr.id
           WHERE con.room_id = r.id AND con.status IN ('signed', 'pending_signature', 'draft')
           ORDER BY con.created_at DESC LIMIT 1
         ) ct ON true
         LEFT JOIN LATERAL (
           SELECT electricity_price, water_price 
           FROM contracts 
           WHERE room_id = r.id AND status IN ('signed', 'pending_signature', 'draft')
           ORDER BY created_at DESC LIMIT 1
         ) c ON true
         WHERE r.deleted_at IS NULL
         ORDER BY r.floor ASC, r.room_number ASC`;
    const res = await query(q);
    return res.rows;
  }

  // Memory store fallback
  let list = memoryStore.rooms;
  if (!includeDeleted) {
    list = list.filter(r => !r.deleted_at);
  }
  return list.map(r => {
    let tenant = memoryStore.users.find(u => u.room_id === r.id && !u.deleted_at && u.status === 'active');
    const contract = memoryStore.contracts
      .filter(c => c.room_id === r.id && ['signed', 'pending_signature', 'draft'].includes(c.status))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    if (!tenant && contract) {
      tenant = memoryStore.users.find(u => u.id === contract.tenant_id);
    }
    return {
      ...r,
      current_tenant_id: tenant ? tenant.id : null,
      current_tenant_name: tenant ? tenant.full_name : null,
      current_tenant_phone: tenant ? tenant.phone : null,
      electricity_price: contract ? contract.electricity_price : null,
      water_price: contract ? contract.water_price : null
    };
  }).sort((a, b) => a.floor - b.floor || a.room_number.localeCompare(b.room_number));
};

export const findById = async (id) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT r.*, 
              COALESCE(u.id, ct.tenant_id) as current_tenant_id, 
              COALESCE(u.full_name, ct.tenant_name) as current_tenant_name, 
              COALESCE(u.phone, ct.tenant_phone) as current_tenant_phone,
              c.electricity_price, c.water_price
       FROM rooms r
       LEFT JOIN users u ON r.id = u.room_id AND u.deleted_at IS NULL AND u.status = 'active'
       LEFT JOIN LATERAL (
         SELECT con.tenant_id, usr.full_name as tenant_name, usr.phone as tenant_phone
         FROM contracts con
         JOIN users usr ON con.tenant_id = usr.id
         WHERE con.room_id = r.id AND con.status IN ('signed', 'pending_signature', 'draft')
         ORDER BY con.created_at DESC LIMIT 1
       ) ct ON true
       LEFT JOIN LATERAL (
         SELECT electricity_price, water_price 
         FROM contracts 
         WHERE room_id = r.id AND status IN ('signed', 'pending_signature', 'draft')
         ORDER BY created_at DESC LIMIT 1
       ) c ON true
       WHERE r.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }
  const r = memoryStore.rooms.find(item => item.id === id);
  if (!r) return null;
  let tenant = memoryStore.users.find(u => u.room_id === r.id && !u.deleted_at && u.status === 'active');
  const contract = memoryStore.contracts
    .filter(c => c.room_id === r.id && ['signed', 'pending_signature', 'draft'].includes(c.status))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  if (!tenant && contract) {
    tenant = memoryStore.users.find(u => u.id === contract.tenant_id);
  }
  return {
    ...r,
    current_tenant_id: tenant ? tenant.id : null,
    current_tenant_name: tenant ? tenant.full_name : null,
    current_tenant_phone: tenant ? tenant.phone : null,
    electricity_price: contract ? contract.electricity_price : null,
    water_price: contract ? contract.water_price : null
  };
};

export const create = async ({ room_number, floor, description, status, monthly_rent }) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const parsedFloor = Number(floor) || 1;
  const parsedRent = Number(monthly_rent) || 0;

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO rooms (id, room_number, floor, description, status, monthly_rent, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, room_number ? String(room_number).trim() : '', parsedFloor, description || '', status || 'available', parsedRent, now, now]
    );
    return res.rows[0];
  }
  const newRoom = {
    id,
    room_number: room_number ? String(room_number).trim() : '',
    floor: parsedFloor,
    description: description || '',
    status: status || 'available',
    monthly_rent: parsedRent,
    deleted_at: null,
    created_at: now,
    updated_at: now
  };
  memoryStore.rooms.push(newRoom);
  return newRoom;
};

export const update = async (id, data) => {
  const now = new Date();
  const allowedCols = ['room_number', 'floor', 'description', 'status', 'monthly_rent', 'deleted_at'];
  
  // Whitelist and normalize fields
  const sanitized = {};
  for (const key of allowedCols) {
    if (data[key] !== undefined) {
      if (key === 'floor') sanitized[key] = Number(data[key]) || 1;
      else if (key === 'monthly_rent') sanitized[key] = Number(data[key]) || 0;
      else if (key === 'room_number') sanitized[key] = String(data[key]).trim();
      else sanitized[key] = data[key];
    }
  }

  if (isPostgresActive()) {
    const entries = Object.entries(sanitized);
    if (entries.length === 0) {
      return findById(id);
    }

    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, val] of entries) {
      fields.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
    fields.push(`updated_at = $${idx}`);
    values.push(now);
    values.push(id);

    const res = await query(
      `UPDATE rooms SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return res.rows[0] || null;
  }

  const room = memoryStore.rooms.find(r => r.id === id);
  if (!room) return null;
  Object.assign(room, sanitized, { updated_at: now });
  return room;
};

export const softDelete = async (id) => {
  return update(id, { deleted_at: new Date(), status: 'inactive' });
};

export const findByRoomNumber = async (roomNumber) => {
  const cleanNumber = String(roomNumber).trim();
  if (isPostgresActive()) {
    const res = await query(
      `SELECT * FROM rooms WHERE (room_number = $1 OR room_number = $2) AND deleted_at IS NULL LIMIT 1`,
      [cleanNumber, cleanNumber.replace(/^0+/, '')]
    );
    return res.rows[0] || null;
  }
  return memoryStore.rooms.find(
    r => !r.deleted_at && (r.room_number === cleanNumber || r.room_number === cleanNumber.replace(/^0+/, ''))
  ) || null;
};


