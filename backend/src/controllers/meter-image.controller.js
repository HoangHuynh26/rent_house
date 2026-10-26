import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as meterImageRepo from '../repositories/meter-image.repo.js';
import * as readingRepo from '../repositories/reading.repo.js';
import * as aiClientService from '../services/ai-client.service.js';
import * as meterLearningService from '../services/meter-learning.service.js';
import * as aiVisionFallbackService from '../services/ai-vision-fallback.service.js';
import { computeFileHash, METERS_DIR } from '../services/storage.service.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { memoryStore, isPostgresActive, query } from '../config/db.js';

export const uploadMeterImage = async (req, res) => {
  try {
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      return errorResponse(res, 'Vui lòng chọn hoặc chụp ảnh đồng hồ.', 'BAD_REQUEST', 400);
    }

    const { room_id, reading_type, reading_id, auto_analyze, previous_value } = req.body;
    if (!room_id) {
      return errorResponse(res, 'Vui lòng chọn phòng để tải ảnh đồng hồ.', 'BAD_REQUEST', 400);
    }

    const safeReadingType = (reading_type === 'water') ? 'water' : 'electricity';
    const filePath = file.path;
    const fileBuffer = (filePath && fs.existsSync(filePath)) ? fs.readFileSync(filePath) : (file.buffer || null);
    const fileHash = (filePath && computeFileHash(filePath)) || (fileBuffer ? crypto.createHash('sha256').update(fileBuffer).digest('hex') : crypto.randomUUID());
    const mimeType = file.mimetype || 'image/jpeg';
    const imageBase64 = fileBuffer ? fileBuffer.toString('base64') : null;
    const id = crypto.randomUUID();
    const imageUrl = `/api/meter-images/${id}/image`;
    const storageKey = filePath ? path.basename(filePath) : `${id}.jpg`;
    const sanitizedReadingId = reading_id && typeof reading_id === 'string' && reading_id.trim().length === 36 ? reading_id.trim() : null;

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

    // Fast Single-Step AI Analysis option
    let aiResult = null;
    const shouldAutoAnalyze = auto_analyze === true || auto_analyze === 'true' || req.query.auto_analyze === 'true';

    if (shouldAutoAnalyze && filePath && fs.existsSync(filePath)) {
      aiResult = await aiClientService.analyzeMeterImage(
        filePath,
        safeReadingType,
        previous_value !== undefined ? previous_value : null
      );

      // Update quality metrics in DB
      await meterImageRepo.updateAIAnalysis(id, {
        image_quality_score: aiResult.image_quality,
        brightness_score: aiResult.brightness_score || (aiResult.is_dark ? 30 : 120),
        blur_score: aiResult.blur_score || (aiResult.is_blurry ? 50 : 250),
        ai_status: 'analyzed'
      });
    }

    // Automatically link to existing reading if reading_id is provided
    if (sanitizedReadingId) {
      if (safeReadingType === 'electricity') {
        await readingRepo.attachElectricityReadingImage(sanitizedReadingId, {
          meter_image_id: id,
          image_url: imageUrl,
          image_data: fileBuffer,
          ai_detected_value: aiResult?.value,
          ai_confidence: aiResult?.confidence,
          image_quality_score: aiResult?.image_quality
        });
      } else {
        await readingRepo.attachWaterReadingImage(sanitizedReadingId, {
          meter_image_id: id,
          image_url: imageUrl,
          image_data: fileBuffer,
          ai_detected_value: aiResult?.value,
          ai_confidence: aiResult?.confidence,
          image_quality_score: aiResult?.image_quality
        });
      }
    }

    return successResponse(res, {
      ...meterImage,
      ai_result: aiResult
    }, 'Tải ảnh đồng hồ lên thành công và đã phân tích AI siêu tốc.', 201);
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

export const analyzeMeterImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { previous_value } = req.body;

    const meterImage = await meterImageRepo.findById(id);
    if (!meterImage) {
      return errorResponse(res, 'Không tìm thấy ảnh đồng hồ.', 'NOT_FOUND', 404);
    }

    const localPath = path.join(METERS_DIR, meterImage.storage_key);

    if (!fs.existsSync(localPath)) {
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (meterImage.image_data) {
        fs.writeFileSync(localPath, Buffer.isBuffer(meterImage.image_data) ? meterImage.image_data : Buffer.from(meterImage.image_data));
      } else if (meterImage.image_base64) {
        const raw = meterImage.image_base64.includes(',') ? meterImage.image_base64.split(',')[1] : meterImage.image_base64;
        fs.writeFileSync(localPath, Buffer.from(raw, 'base64'));
      }
    }

    const aiResult = await aiClientService.analyzeMeterImage(
      localPath,
      meterImage.reading_type,
      previous_value !== undefined ? previous_value : null
    );


    // Update meter_images table with quality metrics
    await meterImageRepo.updateAIAnalysis(id, {
      image_quality_score: aiResult.image_quality,
      brightness_score: aiResult.is_dark ? 30 : 120,
      blur_score: aiResult.is_blurry ? 50 : 250,
      ai_status: 'analyzed'
    });

    // Record in ai_predictions table
    if (isPostgresActive()) {
      await query(
        `INSERT INTO ai_predictions (
          id, reading_type, meter_image_id, model_name, model_version,
          predicted_value, confidence, image_quality_score, is_valid, raw_result, created_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          meterImage.reading_type, id, aiResult.model_name, '1.2.0',
          aiResult.value, aiResult.confidence, aiResult.image_quality,
          aiResult.is_valid, JSON.stringify(aiResult)
        ]
      );
    } else {
      memoryStore.ai_predictions.push({
        id: Date.now().toString(),
        reading_type: meterImage.reading_type,
        meter_image_id: id,
        model_name: aiResult.model_name,
        model_version: '1.2.0',
        predicted_value: aiResult.value,
        confidence: aiResult.confidence,
        image_quality_score: aiResult.image_quality,
        is_valid: aiResult.is_valid,
        raw_result: aiResult,
        created_at: new Date()
      });
    }

    return successResponse(res, {
      meter_image_id: id,
      ...aiResult
    }, 'Phân tích ảnh đồng hồ hoàn tất.');
  } catch (err) {
    console.error('[Analyze Meter Image Error]:', err);
    return errorResponse(res, 'Không thể phân tích ảnh đồng hồ.', 'SERVER_ERROR', 500);
  }
};

export const getLearningStats = async (req, res) => {
  try {
    const stats = meterLearningService.getLearningStats();
    return successResponse(res, stats, 'Lấy thống kê mô hình học máy thành công.');
  } catch (err) {
    console.error('[Get Learning Stats Error]:', err);
    return errorResponse(res, 'Không thể lấy thống kê học máy.', 'SERVER_ERROR', 500);
  }
};

export const triggerRetrain = async (req, res) => {
  try {
    const result = await meterLearningService.rebuildFromHistoricalReadings();
    return successResponse(res, result, 'Huấn luyện lại và lập chỉ mục dữ liệu mẫu thành công.');
  } catch (err) {
    console.error('[Trigger Retrain Error]:', err);
    return errorResponse(res, 'Không thể huấn luyện lại mô hình.', 'SERVER_ERROR', 500);
  }
};

export const getAiConfig = async (req, res) => {
  try {
    const config = aiVisionFallbackService.getAiVisionConfig();
    return successResponse(res, config, 'Lấy cấu hình AI Vision thành công.');
  } catch (err) {
    console.error('[Get AI Config Error]:', err);
    return errorResponse(res, 'Lỗi lấy cấu hình AI Vision.', 'SERVER_ERROR', 500);
  }
};

export const updateAiConfig = async (req, res) => {
  try {
    const updated = aiVisionFallbackService.updateAiVisionConfig(req.body);
    return successResponse(res, updated, 'Cập nhật cấu hình AI Vision thành công.');
  } catch (err) {
    console.error('[Update AI Config Error]:', err);
    return errorResponse(res, 'Lỗi cập nhật cấu hình AI Vision.', 'SERVER_ERROR', 500);
  }
};
