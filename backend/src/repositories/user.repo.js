import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const findByPhone = async (phone) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT u.*, r.room_number, r.monthly_rent
       FROM users u
       LEFT JOIN rooms r ON u.room_id = r.id
       WHERE u.phone = $1 AND u.deleted_at IS NULL`,
      [phone]
    );
    return res.rows[0] || null;
  }
  const u = memoryStore.users.find(item => item.phone === phone && !item.deleted_at);
  if (!u) return null;
  const room = memoryStore.rooms.find(r => r.id === u.room_id);
  return {
    ...u,
    room_number: room ? room.room_number : null,
    monthly_rent: room ? room.monthly_rent : null
  };
};

export const findById = async (id) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT u.*, r.room_number, r.monthly_rent
       FROM users u
       LEFT JOIN rooms r ON u.room_id = r.id
       WHERE u.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }
  const u = memoryStore.users.find(item => item.id === id);
  if (!u) return null;
  const room = memoryStore.rooms.find(r => r.id === u.room_id);
  return {
    ...u,
    room_number: room ? room.room_number : null,
    monthly_rent: room ? room.monthly_rent : null
  };
};

export const findAll = async (includeDeleted = false) => {
  if (isPostgresActive()) {
    const q = includeDeleted
      ? `SELECT u.*, r.room_number
         FROM users u
         LEFT JOIN rooms r ON u.room_id = r.id
         ORDER BY u.created_at DESC`
      : `SELECT u.*, r.room_number
         FROM users u
         LEFT JOIN rooms r ON u.room_id = r.id
         WHERE u.deleted_at IS NULL
         ORDER BY u.created_at DESC`;
    const res = await query(q);
    return res.rows;
  }
  let list = memoryStore.users;
  if (!includeDeleted) {
    list = list.filter(u => !u.deleted_at);
  }
  return list.map(u => {
    const room = memoryStore.rooms.find(r => r.id === u.room_id);
    return {
      ...u,
      room_number: room ? room.room_number : null
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const create = async ({ room_id, full_name, phone, email, status = 'active' }) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const sanitizedRoomId = room_id && typeof room_id === 'string' && room_id.trim().length === 36 ? room_id.trim() : null;
  const sanitizedFullName = full_name ? String(full_name).trim() : '';
  const sanitizedPhone = phone ? String(phone).trim() : '';
  const sanitizedEmail = email && typeof email === 'string' && email.trim() ? email.trim() : null;

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO users (id, room_id, full_name, phone, email, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, sanitizedRoomId, sanitizedFullName, sanitizedPhone, sanitizedEmail, status, now, now]
    );
    return res.rows[0];
  }
  const newUser = {
    id,
    room_id: sanitizedRoomId,
    full_name: sanitizedFullName,
    phone: sanitizedPhone,
    email: sanitizedEmail,
    status,
    deleted_at: null,
    created_at: now,
    updated_at: now
  };
  memoryStore.users.push(newUser);
  return newUser;
};

export const update = async (id, data) => {
  const now = new Date();
  const allowedCols = ['room_id', 'full_name', 'phone', 'email', 'status', 'deleted_at'];
  
  // Whitelist and normalize fields
  const sanitized = {};
  for (const key of allowedCols) {
    if (data[key] !== undefined) {
      if (key === 'room_id') {
        sanitized[key] = data[key] && typeof data[key] === 'string' && data[key].trim().length === 36 ? data[key].trim() : null;
      } else if (key === 'full_name' || key === 'phone') {
        sanitized[key] = data[key] ? String(data[key]).trim() : '';
      } else if (key === 'email') {
        sanitized[key] = data[key] && typeof data[key] === 'string' && data[key].trim() ? data[key].trim() : null;
      } else {
        sanitized[key] = data[key];
      }
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
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return res.rows[0] || null;
  }

  const user = memoryStore.users.find(u => u.id === id);
  if (!user) return null;
  Object.assign(user, sanitized, { updated_at: now });
  return user;
};

export const softDelete = async (id) => {
  return update(id, { deleted_at: new Date(), status: 'inactive' });
};

