import fs from 'fs';
import path from 'path';
import * as readingRepo from '../repositories/reading.repo.js';
import * as roomRepo from '../repositories/room.repo.js';
import * as contractRepo from '../repositories/contract.repo.js';
import * as meterImageRepo from '../repositories/meter-image.repo.js';
import * as meterLearningService from '../services/meter-learning.service.js';
import { METERS_DIR } from '../services/storage.service.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import * as auditService from '../services/audit.service.js';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

// ============================================================================
// ELECTRICITY READINGS
// ============================================================================

export const getElectricityHistory = async (req, res) => {
  try {
    const { roomId } = req.query;
    if (!roomId) {
      return errorResponse(res, 'Vui lòng cung cấp roomId.', 'BAD_REQUEST', 400);
    }
    const months = req.query.months ? Number(req.query.months) : 120;
    const history = await readingRepo.getElectricityHistory(roomId, months);
    return successResponse(res, history, 'Lịch sử chỉ số điện.');
  } catch (err) {
    console.error('[Get Electricity History Error]:', err);
    return errorResponse(res, 'Không thể tải lịch sử điện.', 'SERVER_ERROR', 500);
  }
};

export const createElectricityReading = async (req, res) => {
  try {
    const {
      room_id,
      meter_image_id,
      reading_month,
      reading_year,
      previous_value,
      current_value,
      unit_price,
      image_url,
      ai_detected_value,
      ai_confidence,
      image_quality_score,
      is_meter_reset
    } = req.body;

    if (!room_id || !reading_month || !reading_year || previous_value === undefined || current_value === undefined) {
      return errorResponse(res, 'Vui lòng cung cấp đầy đủ thông tin chỉ số điện.', 'BAD_REQUEST', 400);
    }

    const prevNum = readingRepo.parseDecimal(previous_value);
    const currNum = readingRepo.parseDecimal(current_value);

    // Validation: Current < Previous unless explicit reset confirmed
    if (currNum < prevNum && !is_meter_reset) {
      return errorResponse(
        res,
        'Chỉ số hiện tại nhỏ hơn chỉ số trước đó. Vui lòng xác nhận nếu đồng hồ quay vòng hoặc được thay mới.',
        'SUSPICIOUS_DECREASE',
        400
      );
    }

    // Fetch room price if unit_price not provided
    let finalPrice = unit_price;
    if (!finalPrice) {
      const contract = req.body.tenant_id
        ? await contractRepo.findActiveByTenant(req.body.tenant_id)
        : await contractRepo.findActiveByRoom(room_id);
      finalPrice = contract && contract.electricity_price ? Number(contract.electricity_price) : 3000;
    }

    const reading = await readingRepo.createElectricityReading({
      room_id,
      meter_image_id,
      reading_month,
      reading_year,
      previous_value,
      current_value,
      unit_price: finalPrice,
      image_url,
      ai_detected_value,
      ai_confidence,
      image_quality_score,
      verification_status: 'pending',
      is_meter_reset
    });

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'CREATE_ELECTRICITY_READING',
      entityType: 'electricity_reading',
      entityId: reading.id,
      newData: reading,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, reading, 'Tạo bản ghi chỉ số điện thành công.', 201);
  } catch (err) {
    console.error('[Create Electricity Reading Error]:', err);
    return errorResponse(res, 'Không thể tạo bản ghi chỉ số điện.', 'SERVER_ERROR', 500);
  }
};

export const verifyElectricityReading = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_value, previous_value, is_meter_reset, unit_price } = req.body;

    const verified = await readingRepo.verifyElectricityReading(id, {
      verified_by: req.admin?.id,
      current_value,
      previous_value,
      unit_price,
      is_meter_reset: !!is_meter_reset
    });

    if (!verified) {
      return errorResponse(res, 'Không tìm thấy bản ghi chỉ số điện.', 'NOT_FOUND', 404);
    }

    // Save to AI training dataset if meter_image_id exists
    if (verified.meter_image_id) {
      try {
        const isCorrect = verified.ai_detected_value && Number(verified.ai_detected_value) === Number(verified.current_value);
        if (isPostgresActive()) {
          const imgExists = await query('SELECT id FROM meter_images WHERE id = $1', [verified.meter_image_id]);
          if (imgExists.rows.length > 0) {
            await query(
              `INSERT INTO ai_training_samples (id, image_id, expected_value, verified_value, prediction_value, is_correct, dataset_version, created_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'v1.0', CURRENT_TIMESTAMP)`,
              [verified.meter_image_id, verified.current_value, verified.current_value, verified.ai_detected_value, isCorrect]
            );
          }
        } else {
          memoryStore.ai_training_samples.push({
            id: Date.now().toString(),
            image_id: verified.meter_image_id,
            expected_value: verified.current_value,
            verified_value: verified.current_value,
            prediction_value: verified.ai_detected_value,
            is_correct: isCorrect,
            dataset_version: 'v1.0',
            created_at: new Date()
          });
        }

        // Dynamically feed sample into active Self-Learning Knowledge Base
        const imgRecord = await meterImageRepo.getImageDataById(verified.meter_image_id);
        if (imgRecord) {
          let imgBuf = null;
          if (imgRecord.image_data) {
            imgBuf = Buffer.isBuffer(imgRecord.image_data) ? imgRecord.image_data : Buffer.from(imgRecord.image_data);
          } else if (imgRecord.image_base64) {
            const rawB64 = imgRecord.image_base64.includes(',') ? imgRecord.image_base64.split(',')[1] : imgRecord.image_base64;
            imgBuf = Buffer.from(rawB64, 'base64');
          } else if (imgRecord.storage_key) {
            const p = path.join(METERS_DIR, imgRecord.storage_key);
            if (fs.existsSync(p)) imgBuf = fs.readFileSync(p);
          }
          if (imgBuf) {
            await meterLearningService.recordLearningSample(imgBuf, {
              white_digits: String(verified.current_value),
              red_digit: '0',
              value: Number(verified.current_value),
              full_display: `${verified.current_value}.0`,
              reading_type: 'electricity',
              meter_model: 'Đồng hồ xác minh thực tế'
            }, null, 'admin_verification');
          }
        }
      } catch (aiErr) {
        console.warn('[AI Training Sample Save Warning]:', aiErr.message);
      }
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'VERIFY_ELECTRICITY_READING',
      entityType: 'electricity_reading',
      entityId: id,
      newData: verified,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, verified, 'Phê duyệt chỉ số điện thành công.');
  } catch (err) {
    console.error('[Verify Electricity Reading Error]:', err);
    return errorResponse(res, 'Không thể phê duyệt chỉ số điện.', 'SERVER_ERROR', 500);
  }
};

// ============================================================================
// WATER READINGS
// ============================================================================

export const getMasterWaterBreakdown = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return errorResponse(res, 'Vui lòng cung cấp month và year.', 'BAD_REQUEST', 400);
    }
    const masterRoom = await readingRepo.getMasterRoom();
    const subRooms = await readingRepo.getSubRoomsForMaster();

    let subTotal = 0;
    const subDetails = [];
    for (const sub of subRooms) {
      const reading = await readingRepo.findWaterByRoomAndPeriod(sub.id, Number(month), Number(year));
      const cons = reading ? Number(reading.consumption || 0) : 0;
      subTotal = readingRepo.roundDecimal(subTotal + cons, 3);
      subDetails.push({
        room_id: sub.id,
        room_number: sub.room_number,
        consumption: cons,
        has_reading: Boolean(reading)
      });
    }

    return successResponse(res, {
      is_master: true,
      master_room_id: masterRoom ? masterRoom.id : null,
      master_room_number: masterRoom ? masterRoom.room_number : '1',
      sub_rooms: subDetails,
      total_sub_consumption: subTotal
    }, 'Thông tin trừ nước đồng hồ tổng.');
  } catch (err) {
    console.error('[Get Master Water Breakdown Error]:', err);
    return errorResponse(res, 'Không thể tải chi tiết đồng hồ tổng.', 'SERVER_ERROR', 500);
  }
};

export const getWaterHistory = async (req, res) => {
  try {
    const { roomId } = req.query;
    if (!roomId) {
      return errorResponse(res, 'Vui lòng cung cấp roomId.', 'BAD_REQUEST', 400);
    }
    const months = req.query.months ? Number(req.query.months) : 120;
    const history = await readingRepo.getWaterHistory(roomId, months);
    return successResponse(res, history, 'Lịch sử chỉ số nước.');
  } catch (err) {
    console.error('[Get Water History Error]:', err);
    return errorResponse(res, 'Không thể tải lịch sử nước.', 'SERVER_ERROR', 500);
  }
};

export const createWaterReading = async (req, res) => {
  try {
    const {
      room_id,
      meter_image_id,
      reading_month,
      reading_year,
      previous_value,
      current_value,
      unit_price,
      image_url,
      ai_detected_value,
      ai_confidence,
      image_quality_score,
      is_meter_reset
    } = req.body;

    if (!room_id || !reading_month || !reading_year || previous_value === undefined || current_value === undefined) {
      return errorResponse(res, 'Vui lòng cung cấp đầy đủ thông tin chỉ số nước.', 'BAD_REQUEST', 400);
    }

    const prevNum = readingRepo.parseDecimal(previous_value);
    const currNum = readingRepo.parseDecimal(current_value);

    if (currNum < prevNum && !is_meter_reset) {
      return errorResponse(
        res,
        'Chỉ số nước hiện tại nhỏ hơn chỉ số trước đó. Vui lòng xác nhận nếu đồng hồ quay vòng hoặc được thay mới.',
        'SUSPICIOUS_DECREASE',
        400
      );
    }

    let finalPrice = unit_price;
    if (!finalPrice) {
      const contract = req.body.tenant_id
        ? await contractRepo.findActiveByTenant(req.body.tenant_id)
        : await contractRepo.findActiveByRoom(room_id);
      finalPrice = contract && contract.water_price ? Number(contract.water_price) : 12000;
    }

    const reading = await readingRepo.createWaterReading({
      room_id,
      meter_image_id,
      reading_month,
      reading_year,
      previous_value,
      current_value,
      unit_price: finalPrice,
      image_url,
      ai_detected_value,
      ai_confidence,
      image_quality_score,
      verification_status: 'pending',
      is_meter_reset
    });

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'CREATE_WATER_READING',
      entityType: 'water_reading',
      entityId: reading.id,
      newData: reading,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, reading, 'Tạo bản ghi chỉ số nước thành công.', 201);
  } catch (err) {
    console.error('[Create Water Reading Error]:', err);
    return errorResponse(res, 'Không thể tạo bản ghi chỉ số nước.', 'SERVER_ERROR', 500);
  }
};

export const verifyWaterReading = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_value, previous_value, is_meter_reset, unit_price } = req.body;

    const verified = await readingRepo.verifyWaterReading(id, {
      verified_by: req.admin?.id,
      current_value,
      previous_value,
      unit_price,
      is_meter_reset: !!is_meter_reset
    });

    if (!verified) {
      return errorResponse(res, 'Không tìm thấy bản ghi chỉ số nước.', 'NOT_FOUND', 404);
    }

    if (verified.meter_image_id) {
      try {
        const isCorrect = verified.ai_detected_value && Number(verified.ai_detected_value) === Number(verified.current_value);
        if (isPostgresActive()) {
          const imgExists = await query('SELECT id FROM meter_images WHERE id = $1', [verified.meter_image_id]);
          if (imgExists.rows.length > 0) {
            await query(
              `INSERT INTO ai_training_samples (id, image_id, expected_value, verified_value, prediction_value, is_correct, dataset_version, created_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'v1.0', CURRENT_TIMESTAMP)`,
              [verified.meter_image_id, verified.current_value, verified.current_value, verified.ai_detected_value, isCorrect]
            );
          }
        } else {
          memoryStore.ai_training_samples.push({
            id: Date.now().toString(),
            image_id: verified.meter_image_id,
            expected_value: verified.current_value,
            verified_value: verified.current_value,
            prediction_value: verified.ai_detected_value,
            is_correct: isCorrect,
            dataset_version: 'v1.0',
            created_at: new Date()
          });
        }

        // Dynamically feed sample into active Self-Learning Knowledge Base
        const imgRecord = await meterImageRepo.getImageDataById(verified.meter_image_id);
        if (imgRecord) {
          let imgBuf = null;
          if (imgRecord.image_data) {
            imgBuf = Buffer.isBuffer(imgRecord.image_data) ? imgRecord.image_data : Buffer.from(imgRecord.image_data);
          } else if (imgRecord.image_base64) {
            const rawB64 = imgRecord.image_base64.includes(',') ? imgRecord.image_base64.split(',')[1] : imgRecord.image_base64;
            imgBuf = Buffer.from(rawB64, 'base64');
          } else if (imgRecord.storage_key) {
            const p = path.join(METERS_DIR, imgRecord.storage_key);
            if (fs.existsSync(p)) imgBuf = fs.readFileSync(p);
          }
          if (imgBuf) {
            await meterLearningService.recordLearningSample(imgBuf, {
              white_digits: String(verified.current_value),
              red_digit: '0',
              value: Number(verified.current_value),
              full_display: String(verified.current_value),
              reading_type: 'water',
              meter_model: 'Đồng hồ nước thực tế'
            }, null, 'admin_verification');
          }
        }
      } catch (aiErr) {
        console.warn('[AI Training Sample Save Warning]:', aiErr.message);
      }
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'VERIFY_WATER_READING',
      entityType: 'water_reading',
      entityId: id,
      newData: verified,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, verified, 'Phê duyệt chỉ số nước thành công.');
  } catch (err) {
    console.error('[Verify Water Reading Error]:', err);
    return errorResponse(res, 'Không thể phê duyệt chỉ số nước.', 'SERVER_ERROR', 500);
  }
};

export const attachElectricityImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { meter_image_id, image_url, ai_detected_value, ai_confidence, image_quality_score } = req.body;

    if (!meter_image_id && !image_url) {
      return errorResponse(res, 'Vui lòng cung cấp meter_image_id hoặc image_url.', 'BAD_REQUEST', 400);
    }

    const updated = await readingRepo.attachElectricityReadingImage(id, {
      meter_image_id,
      image_url,
      ai_detected_value,
      ai_confidence,
      image_quality_score
    });

    if (!updated) {
      return errorResponse(res, 'Không tìm thấy bản ghi chỉ số điện.', 'NOT_FOUND', 404);
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'ATTACH_IMAGE_ELECTRICITY_READING',
      entityType: 'electricity_reading',
      entityId: id,
      newData: updated,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, updated, 'Đã bổ sung ảnh vào bản ghi chỉ số điện thành công.');
  } catch (err) {
    console.error('[Attach Electricity Image Error]:', err);
    return errorResponse(res, 'Không thể bổ sung ảnh vào bản ghi chỉ số điện.', 'SERVER_ERROR', 500);
  }
};

export const attachWaterImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { meter_image_id, image_url, ai_detected_value, ai_confidence, image_quality_score } = req.body;

    if (!meter_image_id && !image_url) {
      return errorResponse(res, 'Vui lòng cung cấp meter_image_id hoặc image_url.', 'BAD_REQUEST', 400);
    }

    const updated = await readingRepo.attachWaterReadingImage(id, {
      meter_image_id,
      image_url,
      ai_detected_value,
      ai_confidence,
      image_quality_score
    });

    if (!updated) {
      return errorResponse(res, 'Không tìm thấy bản ghi chỉ số nước.', 'NOT_FOUND', 404);
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'ATTACH_IMAGE_WATER_READING',
      entityType: 'water_reading',
      entityId: id,
      newData: updated,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, updated, 'Đã bổ sung ảnh vào bản ghi chỉ số nước thành công.');
  } catch (err) {
    console.error('[Attach Water Image Error]:', err);
    return errorResponse(res, 'Không thể bổ sung ảnh vào bản ghi chỉ số nước.', 'SERVER_ERROR', 500);
  }
};

export const deleteElectricityReading = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await readingRepo.deleteElectricityReading(id);
    if (!deleted) {
      return errorResponse(res, 'Không tìm thấy bản ghi chỉ số điện.', 'NOT_FOUND', 404);
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'DELETE_ELECTRICITY_READING',
      entityType: 'electricity_reading',
      entityId: id,
      oldData: deleted,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, deleted, 'Xóa chỉ số điện thành công.');
  } catch (err) {
    console.error('[Delete Electricity Reading Error]:', err);
    return errorResponse(res, 'Không thể xóa chỉ số điện.', 'SERVER_ERROR', 500);
  }
};

export const deleteWaterReading = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await readingRepo.deleteWaterReading(id);
    if (!deleted) {
      return errorResponse(res, 'Không tìm thấy bản ghi chỉ số nước.', 'NOT_FOUND', 404);
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'DELETE_WATER_READING',
      entityType: 'water_reading',
      entityId: id,
      oldData: deleted,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, deleted, 'Xóa chỉ số nước thành công.');
  } catch (err) {
    console.error('[Delete Water Reading Error]:', err);
    return errorResponse(res, 'Không thể xóa chỉ số nước.', 'SERVER_ERROR', 500);
  }
};

