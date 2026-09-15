import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

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
    if (isPostgresActive()) {
      await query(
        `INSERT INTO audit_logs (id, actor_id, actor_type, action, entity_type, entity_id, old_data, new_data, ip, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
        [
          crypto.randomUUID(),
          actorId,
          actorType,
          action,
          entityType,
          entityId,
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
