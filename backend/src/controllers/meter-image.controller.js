import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as meterImageRepo from '../repositories/meter-image.repo.js';
import * as readingRepo from '../repositories/reading.repo.js';
import { computeFileHash, METERS_DIR } from '../services/storage.service.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

export const uploadMeterImage = async (req, res) => {
  try {
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      return errorResponse(res, 'Vui lòng chọn hoặc chụp ảnh đồng hồ.', 'BAD_REQUEST', 400);
    }

    const { room_id, reading_type, reading_id } = req.body;
    if (!room_id) {
      return errorResponse(res, 'Vui lòng chọn phòng để tải ảnh đồng hồ.', 'BAD_REQUEST', 400);
    }

    const safeReadingType = reading_type === 'water' ? 'water' : 'electricity';
    const filePath = file.path;
    const fileBuffer = filePath && fs.existsSync(filePath)
      ? fs.readFileSync(filePath)
      : (file.buffer || null);
    const fileHash = (filePath && computeFileHash(filePath)) ||
      (fileBuffer ? crypto.createHash('sha256').update(fileBuffer).digest('hex') : crypto.randomUUID());
    const mimeType = file.mimetype || 'image/jpeg';
    const imageBase64 = fileBuffer ? fileBuffer.toString('base64') : null;
    const id = crypto.randomUUID();
    const imageUrl = `/api/meter-images/${id}/image`;
    const storageKey = filePath ? path.basename(filePath) : `${id}.jpg`;
    const sanitizedReadingId =
      reading_id && typeof reading_id === 'string' && reading_id.trim().length === 36
        ? reading_id.trim()
        : null;

    const meterImage = await meterImageRepo.create({
      id,
      room_id,
      reading_type: safeReadingType,
      reading_id: sanitizedReadingId,
      image_url: imageUrl,
      image_data: fileBuffer,
      image_base64: imageBase64,
      mime_type: mimeType,
      file_size: fileBuffer ? fileBuffer.length : 0,
      storage_key: storageKey,
      image_hash: fileHash
    });

    // Automatically link to existing reading if reading_id is provided
    if (sanitizedReadingId) {
      if (safeReadingType === 'electricity') {
        await readingRepo.attachElectricityReadingImage(sanitizedReadingId, {
          meter_image_id: id,
          image_url: imageUrl,
          image_data: fileBuffer
        });
      } else {
        await readingRepo.attachWaterReadingImage(sanitizedReadingId, {
          meter_image_id: id,
          image_url: imageUrl,
          image_data: fileBuffer
        });
      }
    }

    return successResponse(res, meterImage, 'Tải ảnh đồng hồ lên thành công.', 201);
  } catch (err) {
    console.error('[Upload Meter Image Error]:', err);
    return errorResponse(res, 'Không thể tải ảnh đồng hồ.', 'SERVER_ERROR', 500);
  }
};

export const getMeterImageFile = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await meterImageRepo.getImageDataById(id);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh đồng hồ.' });
    }

    const mimeType = record.mime_type || 'image/jpeg';

    // 1. If stored as binary BYTEA in Neon PostgreSQL
    if (record.image_data) {
      const buffer = Buffer.isBuffer(record.image_data) ? record.image_data : Buffer.from(record.image_data);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }

    // 2. If stored as Base64 in database
    if (record.image_base64) {
      const rawBase64 = record.image_base64.includes(',')
        ? record.image_base64.split(',')[1]
        : record.image_base64;
      const buffer = Buffer.from(rawBase64, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }

    // 3. Fallback to local disk file if exists
    if (record.storage_key) {
      const localPath = path.join(METERS_DIR, record.storage_key);
      if (fs.existsSync(localPath)) {
        return res.sendFile(localPath);
      }
    }

    return res.status(404).json({ error: 'Không có dữ liệu ảnh.' });
  } catch (err) {
    console.error('[Get Meter Image File Error]:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải ảnh.' });
  }
};
