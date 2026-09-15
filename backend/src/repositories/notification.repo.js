import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const create = async ({ recipient_type, recipient_id, title, message, type = 'general', metadata = null }) => {
  const id = crypto.randomUUID();
  const now = new Date();

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO notifications (id, recipient_type, recipient_id, title, message, type, is_read, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, recipient_type, recipient_id || null, title, message, type, false, metadata ? JSON.stringify(metadata) : null, now]
    );
    return res.rows[0];
  }

  const notif = {
    id,
    recipient_type,
    recipient_id: recipient_id || null,
    title,
    message,
    type,
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

export const markAsRead = async (id) => {
  if (isPostgresActive()) {
    const res = await query(`UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }
  const n = memoryStore.notifications.find(item => item.id === id);
  if (n) n.is_read = true;
  return n;
};
