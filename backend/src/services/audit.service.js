import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const toSafeEntityUuid = (entityId) => {
  if (!entityId) return null;
  const str = String(entityId).trim();
  if (!str) return null;
  if (UUID_REGEX.test(str)) return str;

  // Convert arbitrary string IDs (e.g. "period_11-2026" or spreadsheetId) into a deterministic UUID
  // so PostgreSQL audit_logs.entity_id (UUID column) never throws 22P02 invalid input syntax for type uuid.
  const hex = crypto.createHash('md5').update(str).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export const logAction = async ({
  actorId = null,
  actorType = 'admin',
  action,
  entityType,
  entityId = null,
  oldData = null,
  newData = null,
  ip = null,
  userAgent = null
}) => {
  try {
    const safeActorId = toSafeEntityUuid(actorId);
    const safeEntityId = toSafeEntityUuid(entityId);

    if (isPostgresActive()) {
      await query(
        `INSERT INTO audit_logs (id, actor_id, actor_type, action, entity_type, entity_id, old_data, new_data, ip, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
        [
          crypto.randomUUID(),
          safeActorId,
          actorType,
          action,
          entityType,
          safeEntityId,
          oldData ? JSON.stringify(oldData) : null,
          newData ? JSON.stringify(newData) : null,
          ip,
          userAgent
        ]
      );
    } else {
      memoryStore.audit_logs.unshift({
        id: crypto.randomUUID(),
        actor_id: actorId,
        actor_type: actorType,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_data: oldData,
        new_data: newData,
        ip,
        user_agent: userAgent,
        created_at: new Date()
      });
    }
  } catch (err) {
    console.error('[Audit Log Error]:', err.message);
  }
};
