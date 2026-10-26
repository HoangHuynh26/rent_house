import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const findAll = async (filter = {}) => {
  if (isPostgresActive()) {
    let q = `
      SELECT c.*, r.room_number, r.floor, u.full_name as tenant_name, u.phone as tenant_phone, u.email as tenant_email
      FROM contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN users u ON c.tenant_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (filter.roomId) {
      params.push(filter.roomId);
      q += ` AND c.room_id = $${params.length}`;
    }
    if (filter.tenantId) {
      params.push(filter.tenantId);
      q += ` AND c.tenant_id = $${params.length}`;
    }
    if (filter.status) {
      params.push(filter.status);
      q += ` AND c.status = $${params.length}`;
    }
    q += ` ORDER BY c.created_at DESC`;
    const res = await query(q, params);
    return res.rows;
  }

  let list = memoryStore.contracts;
  if (filter.roomId) list = list.filter(c => c.room_id === filter.roomId);
  if (filter.tenantId) list = list.filter(c => c.tenant_id === filter.tenantId);
  if (filter.status) list = list.filter(c => c.status === filter.status);

  return list.map(c => {
    const r = memoryStore.rooms.find(rm => rm.id === c.room_id);
    const u = memoryStore.users.find(usr => usr.id === c.tenant_id);
    return {
      ...c,
      room_number: r ? r.room_number : null,
      tenant_name: u ? u.full_name : null,
      tenant_phone: u ? u.phone : null
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const findById = async (id) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT c.*, r.room_number, r.floor, u.full_name as tenant_name, u.phone as tenant_phone, u.email as tenant_email
       FROM contracts c
       JOIN rooms r ON c.room_id = r.id
       JOIN users u ON c.tenant_id = u.id
       WHERE c.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  const c = memoryStore.contracts.find(item => item.id === id);
  if (!c) return null;
  const r = memoryStore.rooms.find(rm => rm.id === c.room_id);
  const u = memoryStore.users.find(usr => usr.id === c.tenant_id);
  return {
    ...c,
    room_number: r ? r.room_number : null,
    tenant_name: u ? u.full_name : null,
    tenant_phone: u ? u.phone : null
  };
};

export const findActiveByTenant = async (tenantId, roomId = null) => {
  if (isPostgresActive()) {
    let sql = `
      SELECT c.*, r.room_number, u.full_name as tenant_name, u.phone as tenant_phone
      FROM contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN users u ON c.tenant_id = u.id
      WHERE c.tenant_id = $1 AND c.status IN ('signed', 'pending_signature', 'draft')
    `;
    const params = [tenantId];
    if (roomId) {
      params.push(roomId);
      sql += ` AND c.room_id = $2`;
    }
    sql += ` ORDER BY c.created_at DESC LIMIT 1`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  const matches = memoryStore.contracts.filter(item => 
    item.tenant_id === tenantId && 
    ['signed', 'pending_signature', 'draft'].includes(item.status) &&
    (!roomId || item.room_id === roomId)
  );
  if (matches.length === 0) return null;
  const c = matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const r = memoryStore.rooms.find(rm => rm.id === c.room_id);
  const u = memoryStore.users.find(usr => usr.id === c.tenant_id);
  return {
    ...c,
    room_number: r ? r.room_number : null,
    tenant_name: u ? u.full_name : null,
    tenant_phone: u ? u.phone : null
  };
};

export const findAllActiveByTenant = async (tenantId) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT c.*, r.room_number, u.full_name as tenant_name, u.phone as tenant_phone
       FROM contracts c
       JOIN rooms r ON c.room_id = r.id
       JOIN users u ON c.tenant_id = u.id
       WHERE c.tenant_id = $1 AND c.status IN ('signed', 'pending_signature', 'draft')
       ORDER BY r.room_number ASC, c.created_at DESC`,
      [tenantId]
    );
    return res.rows;
  }

  const matches = memoryStore.contracts.filter(item => 
    item.tenant_id === tenantId && 
    ['signed', 'pending_signature', 'draft'].includes(item.status)
  );
  return matches.map(c => {
    const r = memoryStore.rooms.find(rm => rm.id === c.room_id);
    const u = memoryStore.users.find(usr => usr.id === c.tenant_id);
    return {
      ...c,
      room_number: r ? r.room_number : null,
      tenant_name: u ? u.full_name : null,
      tenant_phone: u ? u.phone : null
    };
  });
};

export const findActiveByRoom = async (roomId) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT c.*, r.room_number, u.full_name as tenant_name, u.phone as tenant_phone
       FROM contracts c
       JOIN rooms r ON c.room_id = r.id
       LEFT JOIN users u ON c.tenant_id = u.id
       WHERE c.room_id = $1 AND c.status IN ('signed', 'pending_signature', 'draft')
       ORDER BY c.created_at DESC LIMIT 1`,
      [roomId]
    );
    return res.rows[0] || null;
  }

  const c = memoryStore.contracts.find(item => 
    item.room_id === roomId && (item.status === 'signed' || item.status === 'pending_signature' || item.status === 'draft')
  );
  if (!c) return null;
  const r = memoryStore.rooms.find(rm => rm.id === c.room_id);
  const u = memoryStore.users.find(usr => usr.id === c.tenant_id);
  return {
    ...c,
    room_number: r ? r.room_number : null,
    tenant_name: u ? u.full_name : null,
    tenant_phone: u ? u.phone : null
  };
};

export const create = async (contractData) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const contractNumber = contractData.contract_number || `HD-${Date.now().toString().slice(-6)}`;

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO contracts (
        id, room_id, tenant_id, contract_number, start_date, end_date,
        rent_amount, deposit_amount, electricity_price, water_price,
        contract_content, status, admin_signature, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        contractData.room_id,
        contractData.tenant_id,
        contractNumber,
        contractData.start_date,
        contractData.end_date,
        contractData.rent_amount,
        contractData.deposit_amount || 0,
        contractData.electricity_price,
        contractData.water_price,
        contractData.contract_content,
        contractData.status || 'draft',
        contractData.admin_signature || null,
        now,
        now
      ]
    );
    return res.rows[0];
  }

  const newContract = {
    id,
    room_id: contractData.room_id,
    tenant_id: contractData.tenant_id,
    contract_number: contractNumber,
    start_date: contractData.start_date,
    end_date: contractData.end_date,
    rent_amount: Number(contractData.rent_amount),
    deposit_amount: Number(contractData.deposit_amount || 0),
    electricity_price: Number(contractData.electricity_price),
    water_price: Number(contractData.water_price),
    contract_file_url: null,
    document_hash: null,
    contract_content: contractData.contract_content,
    status: contractData.status || 'draft',
    tenant_signature: null,
    admin_signature: contractData.admin_signature || null,
    signed_at: null,
    signed_ip: null,
    signed_user_agent: null,
    created_at: now,
    updated_at: now
  };
  memoryStore.contracts.push(newContract);
  return newContract;
};

export const updateDraft = async (id, data) => {
  const existing = await findById(id);
  if (!existing) return null;
  if (existing.status === 'signed' || (existing.tenant_signature && existing.admin_signature)) {
    throw new Error('Hợp đồng đã hoàn tất ký 2 bên và đã khóa, bên admin cũng không có quyền chỉnh sửa.');
  }

  const allowedCols = [
    'room_id', 'tenant_id', 'contract_number', 'start_date', 'end_date',
    'rent_amount', 'deposit_amount', 'electricity_price', 'water_price',
    'contract_content', 'status', 'tenant_signature', 'admin_signature',
    'contract_file_url', 'contract_file_data', 'document_hash',
    'signed_at', 'signed_ip', 'signed_user_agent'
  ];

  const sanitized = {};
  for (const key of allowedCols) {
    if (data[key] !== undefined) {
      if (['rent_amount', 'deposit_amount', 'electricity_price', 'water_price'].includes(key)) {
        sanitized[key] = Number(data[key]) || 0;
      } else {
        sanitized[key] = data[key];
      }
    }
  }

  const now = new Date();
  if (isPostgresActive()) {
    const entries = Object.entries(sanitized);
    if (entries.length === 0) {
      return existing;
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
      `UPDATE contracts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return res.rows[0];
  }

  const c = memoryStore.contracts.find(item => item.id === id);
  if (!c) return null;
  Object.assign(c, sanitized, { updated_at: now });
  return c;
};

export const signByTenant = async (id, { tenant_signature, signed_ip, signed_user_agent, document_hash, contract_file_url, contract_file_data }) => {
  const existing = await findById(id);
  if (!existing) return null;
  if (existing.status === 'signed') {
    throw new Error('Hợp đồng này đã được ký kết và đã khóa vĩnh viễn.');
  }

  const now = new Date();
  const updateData = {
    tenant_signature,
    signed_ip,
    signed_user_agent,
    document_hash,
    contract_file_url: contract_file_url || existing.contract_file_url || null,
    contract_file_data: contract_file_data || existing.contract_file_data || null,
    signed_at: now,
    status: 'signed',
    updated_at: now
  };

  if (isPostgresActive()) {
    const res = await query(
      `UPDATE contracts 
       SET tenant_signature = $1, signed_ip = $2, signed_user_agent = $3, document_hash = $4,
           contract_file_url = $5, contract_file_data = $6, signed_at = $7, status = 'signed', updated_at = $8
       WHERE id = $9 RETURNING *`,
      [
        tenant_signature,
        signed_ip,
        signed_user_agent,
        document_hash,
        updateData.contract_file_url,
        updateData.contract_file_data,
        now,
        now,
        id
      ]
    );
    return res.rows[0];
  }

  const c = memoryStore.contracts.find(item => item.id === id);
  if (!c) return null;
  Object.assign(c, updateData);
  return c;
};


export const reopen = async (id, { status = 'pending_signature', end_date, rent_amount, clear_signatures = false } = {}) => {
  const existing = await findById(id);
  if (!existing) return null;

  const now = new Date();
  const validStatus = ['draft', 'pending_signature'].includes(status) ? status : 'pending_signature';

  if (isPostgresActive()) {
    const fields = ['status = $1', 'updated_at = $2'];
    const values = [validStatus, now];

    if (end_date) {
      values.push(end_date);
      fields.push(`end_date = $${values.length}`);
    }

    if (rent_amount !== undefined && rent_amount !== null && !isNaN(rent_amount)) {
      values.push(rent_amount);
      fields.push(`rent_amount = $${values.length}`);
    }

    if (clear_signatures) {
      fields.push(`tenant_signature = NULL`);
      fields.push(`admin_signature = NULL`);
      fields.push(`signed_at = NULL`);
      fields.push(`signed_ip = NULL`);
      fields.push(`signed_user_agent = NULL`);
      fields.push(`document_hash = NULL`);
      fields.push(`contract_file_url = NULL`);
    }

    values.push(id);
    const res = await query(
      `UPDATE contracts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return res.rows[0];
  }

  const c = memoryStore.contracts.find(item => item.id === id);
  if (!c) return null;
  c.status = validStatus;
  c.updated_at = now;
  if (end_date) c.end_date = end_date;
  if (rent_amount) c.rent_amount = Number(rent_amount);
  if (clear_signatures) {
    c.tenant_signature = null;
    c.admin_signature = null;
    c.signed_at = null;
    c.signed_ip = null;
    c.signed_user_agent = null;
    c.document_hash = null;
    c.contract_file_url = null;
  }
  return c;
};

export const deleteById = async (id) => {
  if (isPostgresActive()) {
    // Unblock trigger in case OLD.status was 'signed'
    await query(`UPDATE contracts SET status = 'draft' WHERE id = $1 AND status = 'signed'`, [id]);
    const res = await query(`DELETE FROM contracts WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0] || null;
  }

  const idx = memoryStore.contracts.findIndex(item => item.id === id);
  if (idx === -1) return null;
  const removed = memoryStore.contracts.splice(idx, 1)[0];
  return removed;
};
