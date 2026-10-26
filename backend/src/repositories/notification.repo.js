import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const create = async ({
  recipient_type = 'broadcast',
  recipient_id = null,
  target_room_id = null,
  title,
  message,
  type = 'general',
  is_popup = true,
  is_active = true,
  start_at = null,
  end_at = null,
  metadata = null
}) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const startDate = start_at ? new Date(start_at) : null;
  const endDate = end_at ? new Date(end_at) : null;

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO notifications (
        id, recipient_type, recipient_id, target_room_id, 
        title, message, type, is_popup, is_active, 
        start_at, end_at, is_read, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id,
        recipient_type,
        recipient_id || null,
        target_room_id || null,
        title,
        message,
        type,
        is_popup !== false,
        is_active !== false,
        startDate,
        endDate,
        false,
        metadata ? JSON.stringify(metadata) : null,
        now
      ]
    );
    return res.rows[0];
  }

  const notif = {
    id,
    recipient_type,
    recipient_id: recipient_id || null,
    target_room_id: target_room_id || null,
    title,
    message,
    type,
    is_popup: is_popup !== false,
    is_active: is_active !== false,
    start_at: startDate,
    end_at: endDate,
    is_read: false,
    metadata: metadata || null,
    created_at: now
  };
  memoryStore.notifications.unshift(notif);
  return notif;
};

export const findByRecipient = async (recipientType, recipientId) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT * FROM notifications 
       WHERE recipient_type = $1 AND (recipient_id = $2 OR recipient_id IS NULL)
       ORDER BY created_at DESC LIMIT 50`,
      [recipientType, recipientId]
    );
    return res.rows;
  }
  return memoryStore.notifications
    .filter(n => n.recipient_type === recipientType && (!n.recipient_id || n.recipient_id === recipientId))
    .slice(0, 50);
};

export const findAllForAdmin = async () => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT n.*, r.room_number as target_room_number
       FROM notifications n
       LEFT JOIN rooms r ON n.target_room_id = r.id
       ORDER BY n.created_at DESC`
    );
    return res.rows;
  }

  return memoryStore.notifications.map(n => {
    const rm = n.target_room_id ? memoryStore.rooms.find(r => r.id === n.target_room_id) : null;
    return {
      ...n,
      target_room_number: rm ? rm.room_number : null
    };
  });
};

export const findActiveForTenant = async ({ roomId, tenantId }) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT n.*, r.room_number as target_room_number
       FROM notifications n
       LEFT JOIN rooms r ON n.target_room_id = r.id
       WHERE n.is_active = true
         AND (n.recipient_type = 'broadcast' OR n.recipient_id IS NULL)
         AND (n.start_at IS NULL OR n.start_at <= CURRENT_TIMESTAMP)
         AND (n.end_at IS NULL OR n.end_at >= CURRENT_TIMESTAMP)
         AND (n.target_room_id IS NULL OR n.target_room_id = $1)
       ORDER BY n.created_at DESC`,
      [roomId || null]
    );
    return res.rows;
  }

  const now = new Date();
  return memoryStore.notifications
    .filter(n => {
      if (!n.is_active) return false;
      if (n.recipient_type !== 'broadcast' && n.recipient_id) return false;
      if (n.start_at && new Date(n.start_at) > now) return false;
      if (n.end_at && new Date(n.end_at) < now) return false;
      if (n.target_room_id && n.target_room_id !== roomId) return false;
      return true;
    })
    .map(n => {
      const rm = n.target_room_id ? memoryStore.rooms.find(r => r.id === n.target_room_id) : null;
      return {
        ...n,
        target_room_number: rm ? rm.room_number : null
      };
    });
};

export const update = async (id, data) => {
  const {
    title,
    message,
    type,
    target_room_id,
    is_popup,
    is_active,
    start_at,
    end_at
  } = data;

  const startDate = start_at ? new Date(start_at) : null;
  const endDate = end_at ? new Date(end_at) : null;

  if (isPostgresActive()) {
    const res = await query(
      `UPDATE notifications
       SET title = COALESCE($1, title),
           message = COALESCE($2, message),
           type = COALESCE($3, type),
           target_room_id = $4,
           is_popup = COALESCE($5, is_popup),
           is_active = COALESCE($6, is_active),
           start_at = $7,
           end_at = $8
       WHERE id = $9
       RETURNING *`,
      [
        title,
        message,
        type,
        target_room_id || null,
        is_popup !== undefined ? is_popup : null,
        is_active !== undefined ? is_active : null,
        startDate,
        endDate,
        id
      ]
    );
    return res.rows[0];
  }

  const n = memoryStore.notifications.find(item => item.id === id);
  if (!n) return null;
  if (title !== undefined) n.title = title;
  if (message !== undefined) n.message = message;
  if (type !== undefined) n.type = type;
  if (target_room_id !== undefined) n.target_room_id = target_room_id || null;
  if (is_popup !== undefined) n.is_popup = is_popup;
  if (is_active !== undefined) n.is_active = is_active;
  if (start_at !== undefined) n.start_at = startDate;
  if (end_at !== undefined) n.end_at = endDate;
  return n;
};

export const toggleActive = async (id, isActive) => {
  if (isPostgresActive()) {
    const res = await query(
      `UPDATE notifications SET is_active = $1 WHERE id = $2 RETURNING *`,
      [isActive, id]
    );
    return res.rows[0];
  }
  const n = memoryStore.notifications.find(item => item.id === id);
  if (n) n.is_active = isActive;
  return n;
};

export const deleteById = async (id) => {
  if (isPostgresActive()) {
    const res = await query(`DELETE FROM notifications WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }
  const idx = memoryStore.notifications.findIndex(item => item.id === id);
  if (idx !== -1) {
    const deleted = memoryStore.notifications.splice(idx, 1);
    return deleted[0];
  }
  return null;
};

export const markAsRead = async (id) => {
  if (isPostgresActive()) {
    const res = await query(`UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }
  const n = memoryStore.notifications.find(item => item.id === id);
  if (n) n.is_read = true;
  return n;
};

