import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const create = async (imageData) => {
  const id = imageData.id || crypto.randomUUID();
  const now = new Date();

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO meter_images (
        id, room_id, reading_type, reading_id, image_url, image_data, image_base64,
        mime_type, file_size, storage_key, image_hash, captured_at,
        image_quality_score, brightness_score, blur_score, resolution, ai_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        id, imageData.room_id, imageData.reading_type, imageData.reading_id || null,
        imageData.image_url, imageData.image_data || null, imageData.image_base64 || null,
        imageData.mime_type || 'image/jpeg', imageData.file_size || null,
        imageData.storage_key || null, imageData.image_hash,
        imageData.captured_at || now, imageData.image_quality_score || null,
        imageData.brightness_score || null, imageData.blur_score || null,
        imageData.resolution || null, imageData.ai_status || 'pending', now
      ]
    );
    return res.rows[0];
  }

  const record = {
    id,
    room_id: imageData.room_id,
    reading_type: imageData.reading_type,
    reading_id: imageData.reading_id || null,
    image_url: imageData.image_url,
    image_data: imageData.image_data || null,
    image_base64: imageData.image_base64 || null,
    mime_type: imageData.mime_type || 'image/jpeg',
    file_size: imageData.file_size || null,
    storage_key: imageData.storage_key || null,
    image_hash: imageData.image_hash,
    captured_at: imageData.captured_at || now,
    image_quality_score: imageData.image_quality_score ? Number(imageData.image_quality_score) : null,
    brightness_score: imageData.brightness_score ? Number(imageData.brightness_score) : null,
    blur_score: imageData.blur_score ? Number(imageData.blur_score) : null,
    resolution: imageData.resolution || null,
    ai_status: imageData.ai_status || 'pending',
    created_at: now
  };
  memoryStore.meter_images.push(record);
  return record;
};

export const findById = async (id) => {
  if (isPostgresActive()) {
    const res = await query('SELECT * FROM meter_images WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  return memoryStore.meter_images.find(img => img.id === id) || null;
};

export const getImageDataById = async (id) => {
  if (isPostgresActive()) {
    const res = await query(
      'SELECT id, image_data, image_base64, mime_type, storage_key FROM meter_images WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }
  const img = memoryStore.meter_images.find(i => i.id === id);
  if (!img) return null;
  return {
    id: img.id,
    image_data: img.image_data,
    image_base64: img.image_base64,
    mime_type: img.mime_type,
    storage_key: img.storage_key
  };
};

export const updateAIAnalysis = async (id, analysis) => {
  if (isPostgresActive()) {
    const res = await query(
      `UPDATE meter_images
       SET image_quality_score = $1, brightness_score = $2, blur_score = $3,
           ai_status = $4, resolution = $5
       WHERE id = $6 RETURNING *`,
      [
        analysis.image_quality_score, analysis.brightness_score, analysis.blur_score,
        analysis.ai_status || 'analyzed', analysis.resolution || null, id
      ]
    );
    return res.rows[0];
  }
  const img = memoryStore.meter_images.find(i => i.id === id);
  if (!img) return null;
  Object.assign(img, {
    image_quality_score: analysis.image_quality_score,
    brightness_score: analysis.brightness_score,
    blur_score: analysis.blur_score,
    ai_status: analysis.ai_status || 'analyzed',
    resolution: analysis.resolution || null
  });
  return img;
};

export const findLatestCapturedDate = async (imageIds = []) => {
  const validIds = imageIds.filter(Boolean);
  if (validIds.length === 0) return null;

  if (isPostgresActive()) {
    const res = await query(
      `SELECT captured_at FROM meter_images WHERE id = ANY($1) ORDER BY captured_at DESC LIMIT 1`,
      [validIds]
    );
    if (res.rows.length > 0 && res.rows[0].captured_at) {
      const d = new Date(res.rows[0].captured_at);
      const vnTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
      return vnTime.toISOString().slice(0, 10);
    }
    return null;
  }

  const matches = memoryStore.meter_images
    .filter(img => validIds.includes(img.id) && img.captured_at)
    .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));

  if (matches.length > 0) {
    const d = new Date(matches[0].captured_at);
    const vnTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return vnTime.toISOString().slice(0, 10);
  }
  return null;
};
