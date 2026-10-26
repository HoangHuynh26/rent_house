import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const getRentedRoomsByTenant = async (tenantId) => {
  if (!tenantId) return [];

  if (isPostgresActive()) {
    const res = await query(
      `SELECT DISTINCT r.id, r.room_number, r.floor, r.monthly_rent, r.status as room_status,
              c.id as contract_id, c.status as contract_status, c.contract_number
       FROM rooms r
       LEFT JOIN contracts c ON c.room_id = r.id AND c.tenant_id = $1 AND c.status IN ('signed', 'pending_signature', 'draft')
       WHERE r.id IN (
         SELECT room_id FROM tenant_rooms WHERE tenant_id = $1
         UNION
         SELECT room_id FROM contracts WHERE tenant_id = $1 AND status IN ('signed', 'pending_signature', 'draft')
         UNION
         SELECT room_id FROM users WHERE id = $1 AND room_id IS NOT NULL
       )
       ORDER BY r.room_number ASC`,
      [tenantId]
    );
    return res.rows;
  }

  // Memory Store implementation
  const user = memoryStore.users.find(u => u.id === tenantId);
  const directRoomId = user?.room_id;
  const trRoomIds = (memoryStore.tenant_rooms || [])
    .filter(tr => tr.tenant_id === tenantId)
    .map(tr => tr.room_id);
  const contractRoomIds = (memoryStore.contracts || [])
    .filter(c => c.tenant_id === tenantId && ['signed', 'pending_signature', 'draft'].includes(c.status))
    .map(c => c.room_id);

  const allRoomIds = Array.from(new Set([...trRoomIds, ...contractRoomIds, ...(directRoomId ? [directRoomId] : [])]));

  return allRoomIds.map(roomId => {
    const r = (memoryStore.rooms || []).find(rm => rm.id === roomId);
    if (!r) return null;
    const c = (memoryStore.contracts || []).find(ct => ct.room_id === roomId && ct.tenant_id === tenantId && ['signed', 'pending_signature', 'draft'].includes(ct.status));
    return {
      id: r.id,
      room_number: r.room_number,
      floor: r.floor,
      monthly_rent: r.monthly_rent,
      room_status: r.status,
      contract_id: c ? c.id : null,
      contract_status: c ? c.status : null,
      contract_number: c ? c.contract_number : null
    };
  }).filter(Boolean).sort((a, b) => (Number(a.room_number) || 0) - (Number(b.room_number) || 0));
};

export const assignRoomsToTenant = async (tenantId, roomIds = []) => {
  if (!tenantId) return [];
  const validRoomIds = Array.isArray(roomIds)
    ? roomIds.filter(id => id && typeof id === 'string' && id.trim().length === 36)
    : [];

  const primaryRoomId = validRoomIds.length > 0 ? validRoomIds[0] : null;

  if (isPostgresActive()) {
    // Delete existing tenant_rooms
    await query('DELETE FROM tenant_rooms WHERE tenant_id = $1', [tenantId]);

    // Insert new room assignments
    for (const rid of validRoomIds) {
      await query(
        `INSERT INTO tenant_rooms (id, tenant_id, room_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, room_id) DO NOTHING`,
        [crypto.randomUUID(), tenantId, rid]
      );
    }

    // Update users.room_id to primary room for backward compatibility
    await query('UPDATE users SET room_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [primaryRoomId, tenantId]);
    return getRentedRoomsByTenant(tenantId);
  }

  // Memory store
  if (!memoryStore.tenant_rooms) memoryStore.tenant_rooms = [];
  memoryStore.tenant_rooms = memoryStore.tenant_rooms.filter(tr => tr.tenant_id !== tenantId);
  const now = new Date();
  for (const rid of validRoomIds) {
    memoryStore.tenant_rooms.push({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      room_id: rid,
      created_at: now
    });
  }
  const u = memoryStore.users.find(usr => usr.id === tenantId);
  if (u) {
    u.room_id = primaryRoomId;
    u.updated_at = now;
  }
  return getRentedRoomsByTenant(tenantId);
};

export const findByPhone = async (phone) => {
  let user = null;
  if (isPostgresActive()) {
    const res = await query(
      `SELECT u.*, r.room_number, r.monthly_rent
       FROM users u
       LEFT JOIN rooms r ON u.room_id = r.id
       WHERE u.phone = $1 AND u.deleted_at IS NULL`,
      [phone]
    );
    user = res.rows[0] || null;
  } else {
    const u = memoryStore.users.find(item => item.phone === phone && !item.deleted_at);
    if (u) {
      const room = memoryStore.rooms.find(r => r.id === u.room_id);
      user = {
        ...u,
        room_number: room ? room.room_number : null,
        monthly_rent: room ? room.monthly_rent : null
      };
    }
  }

  if (!user) return null;

  const rentedRooms = await getRentedRoomsByTenant(user.id);
  const roomNumbers = rentedRooms.map(r => r.room_number).filter(Boolean);
  const roomNumbersStr = roomNumbers.join(', ') || user.room_number || null;

  return {
    ...user,
    rented_rooms: rentedRooms,
    room_ids: rentedRooms.map(r => r.id),
    room_numbers: roomNumbers,
    room_numbers_str: roomNumbersStr,
    room_number: user.room_number || (rentedRooms[0]?.room_number ?? null),
    room_id: user.room_id || (rentedRooms[0]?.id ?? null)
  };
};

export const findById = async (id) => {
  let user = null;
  if (isPostgresActive()) {
    const res = await query(
      `SELECT u.*, r.room_number, r.monthly_rent
       FROM users u
       LEFT JOIN rooms r ON u.room_id = r.id
       WHERE u.id = $1`,
      [id]
    );
    user = res.rows[0] || null;
  } else {
    const u = memoryStore.users.find(item => item.id === id);
    if (u) {
      const room = memoryStore.rooms.find(r => r.id === u.room_id);
      user = {
        ...u,
        room_number: room ? room.room_number : null,
        monthly_rent: room ? room.monthly_rent : null
      };
    }
  }

  if (!user) return null;

  const rentedRooms = await getRentedRoomsByTenant(user.id);
  const roomNumbers = rentedRooms.map(r => r.room_number).filter(Boolean);
  const roomNumbersStr = roomNumbers.join(', ') || user.room_number || null;

  return {
    ...user,
    rented_rooms: rentedRooms,
    room_ids: rentedRooms.map(r => r.id),
    room_numbers: roomNumbers,
    room_numbers_str: roomNumbersStr,
    room_number: user.room_number || (rentedRooms[0]?.room_number ?? null),
    room_id: user.room_id || (rentedRooms[0]?.id ?? null)
  };
};

export const findAll = async (includeDeleted = false) => {
  if (isPostgresActive()) {
    const q = `
      SELECT u.*,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', r.id,
                'room_number', r.room_number,
                'floor', r.floor,
                'monthly_rent', r.monthly_rent,
                'room_status', r.status,
                'contract_id', c.id,
                'contract_status', c.status,
                'contract_number', c.contract_number
              ) ORDER BY r.room_number ASC
            )
            FROM rooms r
            LEFT JOIN contracts c ON c.room_id = r.id AND c.tenant_id = u.id AND c.status IN ('signed', 'pending_signature', 'draft')
            WHERE r.id IN (
              SELECT room_id FROM tenant_rooms WHERE tenant_id = u.id
              UNION
              SELECT room_id FROM contracts WHERE tenant_id = u.id AND status IN ('signed', 'pending_signature', 'draft')
              UNION
              SELECT u.room_id WHERE u.room_id IS NOT NULL
            )
          ),
          '[]'::json
        ) AS rented_rooms,
        COALESCE(
          (
            SELECT string_agg(r.room_number, ', ' ORDER BY r.room_number ASC)
            FROM rooms r
            WHERE r.id IN (
              SELECT room_id FROM tenant_rooms WHERE tenant_id = u.id
              UNION
              SELECT room_id FROM contracts WHERE tenant_id = u.id AND status IN ('signed', 'pending_signature', 'draft')
              UNION
              SELECT u.room_id WHERE u.room_id IS NOT NULL
            )
          ),
          r_single.room_number
        ) AS room_numbers_str,
        COALESCE(
          (
            SELECT r.room_number
            FROM rooms r
            WHERE r.id IN (
              SELECT room_id FROM tenant_rooms WHERE tenant_id = u.id
              UNION
              SELECT room_id FROM contracts WHERE tenant_id = u.id AND status IN ('signed', 'pending_signature', 'draft')
              UNION
              SELECT u.room_id WHERE u.room_id IS NOT NULL
            )
            ORDER BY r.room_number ASC LIMIT 1
          ),
          r_single.room_number
        ) AS room_number
      FROM users u
      LEFT JOIN rooms r_single ON u.room_id = r_single.id
      ${includeDeleted ? '' : 'WHERE u.deleted_at IS NULL'}
      ORDER BY u.created_at DESC
    `;
    const res = await query(q);
    return res.rows.map(row => ({
      ...row,
      rented_rooms: Array.isArray(row.rented_rooms) ? row.rented_rooms : [],
      room_ids: Array.isArray(row.rented_rooms) ? row.rented_rooms.map(r => r.id) : (row.room_id ? [row.room_id] : [])
    }));
  }

  // Memory store fallback
  let list = memoryStore.users;
  if (!includeDeleted) {
    list = list.filter(u => !u.deleted_at);
  }

  const result = [];
  for (const u of list) {
    const rentedRooms = await getRentedRoomsByTenant(u.id);
    const roomNumbers = rentedRooms.map(r => r.room_number).filter(Boolean);
    const room = memoryStore.rooms.find(r => r.id === u.room_id);
    result.push({
      ...u,
      rented_rooms: rentedRooms,
      room_ids: rentedRooms.map(r => r.id),
      room_numbers: roomNumbers,
      room_numbers_str: roomNumbers.join(', ') || (room ? room.room_number : null),
      room_number: room ? room.room_number : (rentedRooms[0]?.room_number ?? null)
    });
  }
  return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const create = async ({ room_id, room_ids, full_name, phone, email, status = 'active' }) => {
  const id = crypto.randomUUID();
  const now = new Date();
  
  const resolvedRoomIds = Array.isArray(room_ids) && room_ids.length > 0
    ? room_ids
    : (room_id ? [room_id] : []);

  const sanitizedPrimaryRoomId = resolvedRoomIds[0] && typeof resolvedRoomIds[0] === 'string' && resolvedRoomIds[0].trim().length === 36
    ? resolvedRoomIds[0].trim()
    : null;

  const sanitizedFullName = full_name ? String(full_name).trim() : '';
  const sanitizedPhone = phone ? String(phone).trim() : '';
  const sanitizedEmail = email && typeof email === 'string' && email.trim() ? email.trim() : null;

  let createdUser = null;

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO users (id, room_id, full_name, phone, email, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, sanitizedPrimaryRoomId, sanitizedFullName, sanitizedPhone, sanitizedEmail, status, now, now]
    );
    createdUser = res.rows[0];
  } else {
    createdUser = {
      id,
      room_id: sanitizedPrimaryRoomId,
      full_name: sanitizedFullName,
      phone: sanitizedPhone,
      email: sanitizedEmail,
      status,
      deleted_at: null,
      created_at: now,
      updated_at: now
    };
    memoryStore.users.push(createdUser);
  }

  // Assign rooms in tenant_rooms table
  if (resolvedRoomIds.length > 0) {
    await assignRoomsToTenant(id, resolvedRoomIds);
  }

  return findById(id);
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

  // Handle room_ids assignment if passed in data
  if (data.room_ids !== undefined && Array.isArray(data.room_ids)) {
    await assignRoomsToTenant(id, data.room_ids);
    if (data.room_ids.length > 0) {
      sanitized.room_id = data.room_ids[0];
    } else {
      sanitized.room_id = null;
    }
  }

  if (isPostgresActive()) {
    const entries = Object.entries(sanitized);
    if (entries.length > 0) {
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

      await query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`,
        values
      );
    }
    return findById(id);
  }

  const user = memoryStore.users.find(u => u.id === id);
  if (!user) return null;
  Object.assign(user, sanitized, { updated_at: now });
  return findById(id);
};

export const softDelete = async (id) => {
  return update(id, { deleted_at: new Date(), status: 'inactive' });
};
