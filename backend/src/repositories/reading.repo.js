import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

// ============================================================================
// ELECTRICITY READINGS
// ============================================================================

export const findElectricityByRoomAndPeriod = async (roomId, month, year) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT er.*, r.room_number,
              COALESCE(mi.captured_at, er.created_at) AS photo_captured_at
       FROM electricity_readings er
       JOIN rooms r ON er.room_id = r.id
       LEFT JOIN meter_images mi ON er.meter_image_id = mi.id
       WHERE er.room_id = $1 AND er.reading_month = $2 AND er.reading_year = $3`,
      [roomId, month, year]
    );
    return res.rows[0] || null;
  }
  const r = memoryStore.electricity_readings.find(
    item => item.room_id === roomId && item.reading_month === Number(month) && item.reading_year === Number(year)
  );
  if (!r) return null;
  const rm = memoryStore.rooms.find(room => room.id === r.room_id);
  const img = r.meter_image_id ? memoryStore.meter_images?.find(m => m.id === r.meter_image_id) : null;
  return {
    ...r,
    room_number: rm ? rm.room_number : null,
    photo_captured_at: img?.captured_at || r.created_at || new Date().toISOString()
  };
};

// Helper functions for clean decimal parsing and precision rounding
export const parseDecimal = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(',', '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const roundDecimal = (val, places = 3) => {
  const factor = Math.pow(10, places);
  return Math.round((Number(val) + Number.EPSILON) * factor) / factor;
};

export const getElectricityHistory = async (roomId, limitMonths = 120) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT er.*,
              COALESCE(mi.captured_at, er.created_at) AS photo_captured_at
       FROM electricity_readings er
       LEFT JOIN meter_images mi ON er.meter_image_id = mi.id
       WHERE er.room_id = $1 
       ORDER BY er.reading_year DESC, er.reading_month DESC 
       LIMIT $2`,
      [roomId, limitMonths]
    );
    return res.rows;
  }
  return memoryStore.electricity_readings
    .filter(item => item.room_id === roomId)
    .sort((a, b) => b.reading_year - a.reading_year || b.reading_month - a.reading_month)
    .slice(0, limitMonths)
    .map(r => {
      const img = r.meter_image_id ? memoryStore.meter_images?.find(m => m.id === r.meter_image_id) : null;
      return {
        ...r,
        photo_captured_at: img?.captured_at || r.created_at || new Date().toISOString()
      };
    });
};

export const createElectricityReading = async (data) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const prevVal = roundDecimal(parseDecimal(data.previous_value), 3);
  const currVal = roundDecimal(parseDecimal(data.current_value), 3);
  const isReset = Boolean(data.is_meter_reset && currVal < prevVal);
  const consumption = isReset 
    ? currVal 
    : Math.max(0, roundDecimal(currVal - prevVal, 3));
  const unitPrice = roundDecimal(parseDecimal(data.unit_price), 2);
  const amount = Math.round(consumption * unitPrice);
  const sanitizedImageId = data.meter_image_id && typeof data.meter_image_id === 'string' && data.meter_image_id.trim().length === 36
    ? data.meter_image_id.trim()
    : null;

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO electricity_readings (
        id, room_id, meter_image_id, reading_month, reading_year,
        previous_value, current_value, consumption, unit_price, amount,
        image_url, image_data, ai_detected_value, ai_confidence, image_quality_score,
        verification_status, verified_by, verified_at, is_meter_reset,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (room_id, reading_month, reading_year) DO UPDATE SET
        meter_image_id = COALESCE(EXCLUDED.meter_image_id, electricity_readings.meter_image_id),
        previous_value = EXCLUDED.previous_value,
        current_value = EXCLUDED.current_value,
        consumption = EXCLUDED.consumption,
        unit_price = EXCLUDED.unit_price,
        amount = EXCLUDED.amount,
        image_url = COALESCE(EXCLUDED.image_url, electricity_readings.image_url),
        image_data = COALESCE(EXCLUDED.image_data, electricity_readings.image_data),
        ai_detected_value = COALESCE(EXCLUDED.ai_detected_value, electricity_readings.ai_detected_value),
        ai_confidence = COALESCE(EXCLUDED.ai_confidence, electricity_readings.ai_confidence),
        image_quality_score = COALESCE(EXCLUDED.image_quality_score, electricity_readings.image_quality_score),
        verification_status = EXCLUDED.verification_status,
        verified_by = COALESCE(EXCLUDED.verified_by, electricity_readings.verified_by),
        verified_at = COALESCE(EXCLUDED.verified_at, electricity_readings.verified_at),
        is_meter_reset = EXCLUDED.is_meter_reset,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, data.room_id, sanitizedImageId, Number(data.reading_month), Number(data.reading_year),
        prevVal, currVal, consumption, unitPrice, amount,
        data.image_url || null, data.image_data || null, data.ai_detected_value ? roundDecimal(parseDecimal(data.ai_detected_value), 3) : null, data.ai_confidence || null, data.image_quality_score || null,
        data.verification_status || 'pending', data.verified_by || null, data.verified_at || null, isReset,
        now, now
      ]
    );
    return res.rows[0];
  }

  const existingIdx = memoryStore.electricity_readings.findIndex(
    item => item.room_id === data.room_id &&
            item.reading_month === Number(data.reading_month) &&
            item.reading_year === Number(data.reading_year)
  );
  if (existingIdx >= 0) {
    const existing = memoryStore.electricity_readings[existingIdx];
    Object.assign(existing, {
      meter_image_id: sanitizedImageId || existing.meter_image_id,
      previous_value: prevVal,
      current_value: currVal,
      consumption,
      unit_price: unitPrice,
      amount,
      image_url: data.image_url || existing.image_url,
      ai_detected_value: data.ai_detected_value ? roundDecimal(parseDecimal(data.ai_detected_value), 3) : existing.ai_detected_value,
      ai_confidence: data.ai_confidence ? Number(data.ai_confidence) : existing.ai_confidence,
      image_quality_score: data.image_quality_score ? Number(data.image_quality_score) : existing.image_quality_score,
      verification_status: data.verification_status || 'pending',
      verified_by: data.verified_by || existing.verified_by,
      verified_at: data.verified_at || existing.verified_at,
      is_meter_reset: isReset,
      updated_at: now
    });
    return existing;
  }

  const record = {
    id,
    room_id: data.room_id,
    meter_image_id: sanitizedImageId,
    reading_month: Number(data.reading_month),
    reading_year: Number(data.reading_year),
    previous_value: prevVal,
    current_value: currVal,
    consumption,
    unit_price: unitPrice,
    amount,
    image_url: data.image_url || null,
    ai_detected_value: data.ai_detected_value ? roundDecimal(parseDecimal(data.ai_detected_value), 3) : null,
    ai_confidence: data.ai_confidence ? Number(data.ai_confidence) : null,
    image_quality_score: data.image_quality_score ? Number(data.image_quality_score) : null,
    verification_status: data.verification_status || 'pending',
    verified_by: data.verified_by || null,
    verified_at: data.verified_at || null,
    is_meter_reset: isReset,
    created_at: now,
    updated_at: now
  };
  memoryStore.electricity_readings.push(record);
  return record;
};

export const verifyElectricityReading = async (id, { verified_by, current_value, previous_value, is_meter_reset = false, unit_price }) => {
  const now = new Date();
  const currentReading = isPostgresActive() 
    ? (await query('SELECT * FROM electricity_readings WHERE id = $1', [id])).rows[0]
    : memoryStore.electricity_readings.find(r => r.id === id);

  if (!currentReading) return null;

  const finalValue = current_value !== undefined ? roundDecimal(parseDecimal(current_value), 3) : roundDecimal(parseDecimal(currentReading.current_value), 3);
  const prevValue = previous_value !== undefined ? roundDecimal(parseDecimal(previous_value), 3) : roundDecimal(parseDecimal(currentReading.previous_value), 3);
  const isReset = Boolean(is_meter_reset && finalValue < prevValue);
  const consumption = isReset 
    ? finalValue 
    : Math.max(0, roundDecimal(finalValue - prevValue, 3));
  const finalPrice = unit_price !== undefined 
    ? roundDecimal(parseDecimal(unit_price), 2)
    : roundDecimal(parseDecimal(currentReading.unit_price), 2);
  const amount = Math.round(consumption * finalPrice);

  if (isPostgresActive()) {
    const res = await query(
      `UPDATE electricity_readings
       SET previous_value = $1, current_value = $2, consumption = $3, unit_price = $4, amount = $5,
           verification_status = 'approved', verified_by = $6, verified_at = $7,
           is_meter_reset = $8, updated_at = $9
       WHERE id = $10 RETURNING *`,
      [prevValue, finalValue, consumption, finalPrice, amount, verified_by, now, isReset, now, id]
    );
    return res.rows[0];
  }

  Object.assign(currentReading, {
    previous_value: prevValue,
    current_value: finalValue,
    consumption,
    unit_price: finalPrice,
    amount,
    verification_status: 'approved',
    verified_by,
    verified_at: now,
    is_meter_reset: isReset,
    updated_at: now
  });
  return currentReading;
};

// ============================================================================
// WATER READINGS
// ============================================================================

export const findWaterByRoomAndPeriod = async (roomId, month, year) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT wr.*, r.room_number,
              COALESCE(mi.captured_at, wr.created_at) AS photo_captured_at
       FROM water_readings wr
       JOIN rooms r ON wr.room_id = r.id
       LEFT JOIN meter_images mi ON wr.meter_image_id = mi.id
       WHERE wr.room_id = $1 AND wr.reading_month = $2 AND wr.reading_year = $3`,
      [roomId, month, year]
    );
    return res.rows[0] || null;
  }
  const r = memoryStore.water_readings.find(
    item => item.room_id === roomId && item.reading_month === Number(month) && item.reading_year === Number(year)
  );
  if (!r) return null;
  const rm = memoryStore.rooms.find(room => room.id === r.room_id);
  const img = r.meter_image_id ? memoryStore.meter_images?.find(m => m.id === r.meter_image_id) : null;
  return {
    ...r,
    room_number: rm ? rm.room_number : null,
    photo_captured_at: img?.captured_at || r.created_at || new Date().toISOString()
  };
};

export const getMasterRoom = async () => {
  if (isPostgresActive()) {
    const res = await query(`SELECT id, room_number FROM rooms WHERE room_number = '1' AND deleted_at IS NULL LIMIT 1`);
    return res.rows[0] || null;
  }
  return memoryStore.rooms.find(r => r.room_number === '1' && !r.deleted_at) || null;
};

export const getSubRoomsForMaster = async () => {
  if (isPostgresActive()) {
    const res = await query(`SELECT id, room_number FROM rooms WHERE room_number IN ('2', '3') AND deleted_at IS NULL ORDER BY room_number ASC`);
    return res.rows;
  }
  return memoryStore.rooms
    .filter(r => ['2', '3'].includes(r.room_number) && !r.deleted_at)
    .sort((a, b) => a.room_number.localeCompare(b.room_number));
};

export const calculateMasterWaterDetails = async (roomId, month, year, rawDiff) => {
  const masterRoom = await getMasterRoom();
  if (!masterRoom || masterRoom.id !== roomId) {
    return {
      isMaster: false,
      rawConsumption: rawDiff,
      subConsumption: 0,
      subDetails: [],
      consumption: rawDiff
    };
  }

  const subRooms = await getSubRoomsForMaster();
  let subTotal = 0;
  const subDetails = [];

  for (const sub of subRooms) {
    const subReading = await findWaterByRoomAndPeriod(sub.id, Number(month), Number(year));
    const subCons = subReading ? Number(subReading.consumption || 0) : 0;
    subTotal = roundDecimal(subTotal + subCons, 3);
    subDetails.push({
      room_id: sub.id,
      room_number: sub.room_number,
      consumption: subCons,
      has_reading: Boolean(subReading)
    });
  }

  const netConsumption = Math.max(0, roundDecimal(rawDiff - subTotal, 3));
  return {
    isMaster: true,
    rawConsumption: rawDiff,
    subConsumption: subTotal,
    subDetails,
    consumption: netConsumption
  };
};

export const syncMasterWaterReadingIfAffected = async (subRoomId, month, year) => {
  try {
    const masterRoom = await getMasterRoom();
    if (!masterRoom) return null;

    // Check if the modified room is Room 2 or Room 3
    const subRooms = await getSubRoomsForMaster();
    const isSub = subRooms.some(r => r.id === subRoomId);
    if (!isSub) return null;

    // Check if Master Room 1 already has a water reading for this period
    const masterReading = await findWaterByRoomAndPeriod(masterRoom.id, Number(month), Number(year));
    if (!masterReading) return null;

    const prevVal = roundDecimal(parseDecimal(masterReading.previous_value), 3);
    const currVal = roundDecimal(parseDecimal(masterReading.current_value), 3);
    const isReset = Boolean(masterReading.is_meter_reset && currVal < prevVal);
    const rawDiff = isReset ? currVal : Math.max(0, roundDecimal(currVal - prevVal, 3));

    const details = await calculateMasterWaterDetails(masterRoom.id, Number(month), Number(year), rawDiff);
    const unitPrice = roundDecimal(parseDecimal(masterReading.unit_price), 2);
    const newAmount = Math.round(details.consumption * unitPrice);

    const now = new Date();

    if (isPostgresActive()) {
      await query(
        `UPDATE water_readings
         SET consumption = $1, amount = $2, updated_at = $3
         WHERE id = $4`,
        [details.consumption, newAmount, now, masterReading.id]
      );

      // Also update Room 1's bill if exists
      const billRes = await query(
        `SELECT * FROM bills WHERE room_id = $1 AND billing_month = $2 AND billing_year = $3`,
        [masterRoom.id, Number(month), Number(year)]
      );
      if (billRes.rows.length > 0) {
        const b = billRes.rows[0];
        const rent = Number(b.rent_amount || 0);
        const elec = Number(b.electricity_amount || 0);
        const disc = Number(b.discount_amount || 0);
        const newTotal = rent + elec + newAmount - disc;
        await query(
          `UPDATE bills
           SET water_amount = $1, total_amount = $2, updated_at = $3
           WHERE id = $4`,
          [newAmount, newTotal, now, b.id]
        );
      }
    } else {
      const storedItem = memoryStore.water_readings.find(
        item => item.id === masterReading.id || 
               (item.room_id === masterRoom.id && item.reading_month === Number(month) && item.reading_year === Number(year))
      );
      if (storedItem) {
        storedItem.consumption = details.consumption;
        storedItem.amount = newAmount;
        storedItem.updated_at = now;
      }
      masterReading.consumption = details.consumption;
      masterReading.amount = newAmount;
      masterReading.updated_at = now;

      const bill = memoryStore.bills.find(
        b => b.room_id === masterRoom.id && b.billing_month === Number(month) && b.billing_year === Number(year)
      );
      if (bill) {
        bill.water_amount = newAmount;
        bill.total_amount = Number(bill.rent_amount || 0) + Number(bill.electricity_amount || 0) + newAmount - Number(bill.discount_amount || 0);
        bill.updated_at = now;
      }
    }

    return { masterReadingId: masterReading.id, newConsumption: details.consumption, newAmount };
  } catch (err) {
    console.warn('[Sync Master Water Reading Error]:', err.message);
    return null;
  }
};

export const getWaterHistory = async (roomId, limitMonths = 120) => {
  let rows = [];
  if (isPostgresActive()) {
    const res = await query(
      `SELECT wr.*,
              COALESCE(mi.captured_at, wr.created_at) AS photo_captured_at
       FROM water_readings wr
       LEFT JOIN meter_images mi ON wr.meter_image_id = mi.id
       WHERE wr.room_id = $1 
       ORDER BY wr.reading_year DESC, wr.reading_month DESC 
       LIMIT $2`,
      [roomId, limitMonths]
    );
    rows = res.rows;
  } else {
    rows = memoryStore.water_readings
      .filter(item => item.room_id === roomId)
      .sort((a, b) => b.reading_year - a.reading_year || b.reading_month - a.reading_month)
      .slice(0, limitMonths)
      .map(r => {
        const img = r.meter_image_id ? memoryStore.meter_images?.find(m => m.id === r.meter_image_id) : null;
        return {
          ...r,
          photo_captured_at: img?.captured_at || r.created_at || new Date().toISOString()
        };
      });
  }

  // Attach master meter details if this is Master Room 1
  const masterRoom = await getMasterRoom();
  if (masterRoom && masterRoom.id === roomId) {
    const subRooms = await getSubRoomsForMaster();
    return Promise.all(rows.map(async r => {
      const prev = Number(r.previous_value);
      const curr = Number(r.current_value);
      const isReset = Boolean(r.is_meter_reset && curr < prev);
      const rawConsumption = isReset ? curr : Math.max(0, roundDecimal(curr - prev, 3));
      
      let subTotal = 0;
      const subDetails = [];
      for (const sub of subRooms) {
        const subReading = await findWaterByRoomAndPeriod(sub.id, r.reading_month, r.reading_year);
        const subCons = subReading ? Number(subReading.consumption || 0) : 0;
        subTotal = roundDecimal(subTotal + subCons, 3);
        subDetails.push({ room_number: sub.room_number, consumption: subCons });
      }

      return {
        ...r,
        is_master: true,
        raw_consumption: rawConsumption,
        sub_consumption: subTotal,
        sub_details: subDetails
      };
    }));
  }

  return rows;
};

export const createWaterReading = async (data) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const prevVal = roundDecimal(parseDecimal(data.previous_value), 3);
  const currVal = roundDecimal(parseDecimal(data.current_value), 3);
  const isReset = Boolean(data.is_meter_reset && currVal < prevVal);
  const rawDiff = isReset 
    ? currVal 
    : Math.max(0, roundDecimal(currVal - prevVal, 3));

  // Compute master water deduction if Room 1
  const masterDetails = await calculateMasterWaterDetails(data.room_id, data.reading_month, data.reading_year, rawDiff);
  const consumption = masterDetails.consumption;

  const unitPrice = roundDecimal(parseDecimal(data.unit_price), 2);
  const amount = Math.round(consumption * unitPrice);
  const sanitizedImageId = data.meter_image_id && typeof data.meter_image_id === 'string' && data.meter_image_id.trim().length === 36
    ? data.meter_image_id.trim()
    : null;

  let resultRecord = null;

  if (isPostgresActive()) {
    const res = await query(
      `INSERT INTO water_readings (
        id, room_id, meter_image_id, reading_month, reading_year,
        previous_value, current_value, consumption, unit_price, amount,
        image_url, image_data, ai_detected_value, ai_confidence, image_quality_score,
        verification_status, verified_by, verified_at, is_meter_reset,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (room_id, reading_month, reading_year) DO UPDATE SET
        meter_image_id = COALESCE(EXCLUDED.meter_image_id, water_readings.meter_image_id),
        previous_value = EXCLUDED.previous_value,
        current_value = EXCLUDED.current_value,
        consumption = EXCLUDED.consumption,
        unit_price = EXCLUDED.unit_price,
        amount = EXCLUDED.amount,
        image_url = COALESCE(EXCLUDED.image_url, water_readings.image_url),
        image_data = COALESCE(EXCLUDED.image_data, water_readings.image_data),
        ai_detected_value = COALESCE(EXCLUDED.ai_detected_value, water_readings.ai_detected_value),
        ai_confidence = COALESCE(EXCLUDED.ai_confidence, water_readings.ai_confidence),
        image_quality_score = COALESCE(EXCLUDED.image_quality_score, water_readings.image_quality_score),
        verification_status = EXCLUDED.verification_status,
        verified_by = COALESCE(EXCLUDED.verified_by, water_readings.verified_by),
        verified_at = COALESCE(EXCLUDED.verified_at, water_readings.verified_at),
        is_meter_reset = EXCLUDED.is_meter_reset,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, data.room_id, sanitizedImageId, Number(data.reading_month), Number(data.reading_year),
        prevVal, currVal, consumption, unitPrice, amount,
        data.image_url || null, data.image_data || null, data.ai_detected_value ? roundDecimal(parseDecimal(data.ai_detected_value), 3) : null, data.ai_confidence || null, data.image_quality_score || null,
        data.verification_status || 'pending', data.verified_by || null, data.verified_at || null, isReset,
        now, now
      ]
    );
    resultRecord = res.rows[0];
  } else {
    const existingIdx = memoryStore.water_readings.findIndex(
      item => item.room_id === data.room_id &&
              item.reading_month === Number(data.reading_month) &&
              item.reading_year === Number(data.reading_year)
    );
    if (existingIdx >= 0) {
      const existing = memoryStore.water_readings[existingIdx];
      Object.assign(existing, {
        meter_image_id: sanitizedImageId || existing.meter_image_id,
        previous_value: prevVal,
        current_value: currVal,
        consumption,
        unit_price: unitPrice,
        amount,
        image_url: data.image_url || existing.image_url,
        ai_detected_value: data.ai_detected_value ? roundDecimal(parseDecimal(data.ai_detected_value), 3) : existing.ai_detected_value,
        ai_confidence: data.ai_confidence ? Number(data.ai_confidence) : existing.ai_confidence,
        image_quality_score: data.image_quality_score ? Number(data.image_quality_score) : existing.image_quality_score,
        verification_status: data.verification_status || 'pending',
        verified_by: data.verified_by || existing.verified_by,
        verified_at: data.verified_at || existing.verified_at,
        is_meter_reset: isReset,
        updated_at: now
      });
      resultRecord = existing;
    } else {
      const record = {
        id,
        room_id: data.room_id,
        meter_image_id: sanitizedImageId,
        reading_month: Number(data.reading_month),
        reading_year: Number(data.reading_year),
        previous_value: prevVal,
        current_value: currVal,
        consumption,
        unit_price: unitPrice,
        amount,
        image_url: data.image_url || null,
        ai_detected_value: data.ai_detected_value ? roundDecimal(parseDecimal(data.ai_detected_value), 3) : null,
        ai_confidence: data.ai_confidence ? Number(data.ai_confidence) : null,
        image_quality_score: data.image_quality_score ? Number(data.image_quality_score) : null,
        verification_status: data.verification_status || 'pending',
        verified_by: data.verified_by || null,
        verified_at: data.verified_at || null,
        is_meter_reset: isReset,
        created_at: now,
        updated_at: now
      };
      memoryStore.water_readings.push(record);
      resultRecord = record;
    }
  }

  // Automatically sync Master Room 1 if this was Room 2 or Room 3
  await syncMasterWaterReadingIfAffected(data.room_id, data.reading_month, data.reading_year);

  return resultRecord;
};

export const verifyWaterReading = async (id, { verified_by, current_value, previous_value, is_meter_reset = false, unit_price }) => {
  const now = new Date();
  const currentReading = isPostgresActive() 
    ? (await query('SELECT * FROM water_readings WHERE id = $1', [id])).rows[0]
    : memoryStore.water_readings.find(r => r.id === id);

  if (!currentReading) return null;

  const finalValue = current_value !== undefined ? roundDecimal(parseDecimal(current_value), 3) : roundDecimal(parseDecimal(currentReading.current_value), 3);
  const prevValue = previous_value !== undefined ? roundDecimal(parseDecimal(previous_value), 3) : roundDecimal(parseDecimal(currentReading.previous_value), 3);
  const isReset = Boolean(is_meter_reset && finalValue < prevValue);
  const rawDiff = isReset 
    ? finalValue 
    : Math.max(0, roundDecimal(finalValue - prevValue, 3));

  // Compute master water deduction if Room 1
  const masterDetails = await calculateMasterWaterDetails(currentReading.room_id, currentReading.reading_month, currentReading.reading_year, rawDiff);
  const consumption = masterDetails.consumption;

  const finalPrice = unit_price !== undefined 
    ? roundDecimal(parseDecimal(unit_price), 2)
    : roundDecimal(parseDecimal(currentReading.unit_price), 2);
  const amount = Math.round(consumption * finalPrice);

  let verifiedRecord = null;

  if (isPostgresActive()) {
    const res = await query(
      `UPDATE water_readings
       SET previous_value = $1, current_value = $2, consumption = $3, unit_price = $4, amount = $5,
           verification_status = 'approved', verified_by = $6, verified_at = $7,
           is_meter_reset = $8, updated_at = $9
       WHERE id = $10 RETURNING *`,
      [prevValue, finalValue, consumption, finalPrice, amount, verified_by, now, isReset, now, id]
    );
    verifiedRecord = res.rows[0];
  } else {
    Object.assign(currentReading, {
      previous_value: prevValue,
      current_value: finalValue,
      consumption,
      unit_price: finalPrice,
      amount,
      verification_status: 'approved',
      verified_by,
      verified_at: now,
      is_meter_reset: isReset,
      updated_at: now
    });
    verifiedRecord = currentReading;
  }

  // Automatically sync Master Room 1 if this was Room 2 or Room 3
  await syncMasterWaterReadingIfAffected(currentReading.room_id, currentReading.reading_month, currentReading.reading_year);

  return verifiedRecord;
};

export const attachElectricityReadingImage = async (id, { meter_image_id, image_url, image_data, ai_detected_value, ai_confidence, image_quality_score }) => {
  const now = new Date();
  const currentReading = isPostgresActive() 
    ? (await query('SELECT * FROM electricity_readings WHERE id = $1', [id])).rows[0]
    : memoryStore.electricity_readings.find(r => r.id === id);

  if (!currentReading) return null;

  if (isPostgresActive()) {
    const res = await query(
      `UPDATE electricity_readings
       SET meter_image_id = COALESCE($1, meter_image_id),
           image_url = COALESCE($2, image_url),
           image_data = COALESCE($3, image_data),
           ai_detected_value = COALESCE($4, ai_detected_value),
           ai_confidence = COALESCE($5, ai_confidence),
           image_quality_score = COALESCE($6, image_quality_score),
           updated_at = $7
       WHERE id = $8 RETURNING *`,
      [meter_image_id || null, image_url || null, image_data || null, ai_detected_value || null, ai_confidence || null, image_quality_score || null, now, id]
    );
    return res.rows[0];
  }

  Object.assign(currentReading, {
    meter_image_id: meter_image_id || currentReading.meter_image_id,
    image_url: image_url || currentReading.image_url,
    image_data: image_data || currentReading.image_data,
    ai_detected_value: ai_detected_value !== undefined ? ai_detected_value : currentReading.ai_detected_value,
    ai_confidence: ai_confidence !== undefined ? ai_confidence : currentReading.ai_confidence,
    image_quality_score: image_quality_score !== undefined ? image_quality_score : currentReading.image_quality_score,
    updated_at: now
  });
  return currentReading;
};

export const attachWaterReadingImage = async (id, { meter_image_id, image_url, image_data, ai_detected_value, ai_confidence, image_quality_score }) => {
  const now = new Date();
  const currentReading = isPostgresActive() 
    ? (await query('SELECT * FROM water_readings WHERE id = $1', [id])).rows[0]
    : memoryStore.water_readings.find(r => r.id === id);

  if (!currentReading) return null;

  if (isPostgresActive()) {
    const res = await query(
      `UPDATE water_readings
       SET meter_image_id = COALESCE($1, meter_image_id),
           image_url = COALESCE($2, image_url),
           image_data = COALESCE($3, image_data),
           ai_detected_value = COALESCE($4, ai_detected_value),
           ai_confidence = COALESCE($5, ai_confidence),
           image_quality_score = COALESCE($6, image_quality_score),
           updated_at = $7
       WHERE id = $8 RETURNING *`,
      [meter_image_id || null, image_url || null, image_data || null, ai_detected_value || null, ai_confidence || null, image_quality_score || null, now, id]
    );
    return res.rows[0];
  }

  Object.assign(currentReading, {
    meter_image_id: meter_image_id || currentReading.meter_image_id,
    image_url: image_url || currentReading.image_url,
    image_data: image_data || currentReading.image_data,
    ai_detected_value: ai_detected_value !== undefined ? ai_detected_value : currentReading.ai_detected_value,
    ai_confidence: ai_confidence !== undefined ? ai_confidence : currentReading.ai_confidence,
    image_quality_score: image_quality_score !== undefined ? image_quality_score : currentReading.image_quality_score,
    updated_at: now
  });
  return currentReading;
};
