import test from 'node:test';
import assert from 'node:assert/strict';
import { isPostgresActive, query, memoryStore } from '../src/config/db.js';
import * as readingRepo from '../src/repositories/reading.repo.js';

test('Master Water Meter (Room 1) Deduction & Cascade Sync', async (t) => {
  const testMonth = 11;
  const testYear = 2029;

  t.after(async () => {
    try {
      if (isPostgresActive()) {
        await query('DELETE FROM water_readings WHERE reading_month = $1 AND reading_year = $2', [testMonth, testYear]);
      } else {
        memoryStore.water_readings = memoryStore.water_readings.filter(
          r => !(r.reading_month === testMonth && r.reading_year === testYear)
        );
      }
    } catch {
      // ignore cleanup errors
    }
  });

  const masterRoom = await readingRepo.getMasterRoom();
  const subRooms = await readingRepo.getSubRoomsForMaster();
  const room1 = masterRoom;
  const room2 = subRooms.find(r => r.room_number === '2');
  const room3 = subRooms.find(r => r.room_number === '3');

  assert.ok(room1, 'Room 1 master room must exist');
  assert.ok(room2, 'Room 2 sub-room must exist');
  assert.ok(room3, 'Room 3 sub-room must exist');

  await t.test('1. Record Room 2 (7 m3) and Room 3 (5 m3)', async () => {
    const r2 = await readingRepo.createWaterReading({
      room_id: room2.id,
      reading_month: testMonth,
      reading_year: testYear,
      previous_value: 10,
      current_value: 17,
      unit_price: 12000
    });
    assert.equal(Number(r2.consumption), 7);
    assert.equal(Number(r2.amount), 84000);

    const r3 = await readingRepo.createWaterReading({
      room_id: room3.id,
      reading_month: testMonth,
      reading_year: testYear,
      previous_value: 20,
      current_value: 25,
      unit_price: 12000
    });
    assert.equal(Number(r3.consumption), 5);
    assert.equal(Number(r3.amount), 60000);
  });

  await t.test('2. Record Room 1 Master Meter (raw diff = 20 m3) -> net should be 20 - 7 - 5 = 8 m3', async () => {
    const r1 = await readingRepo.createWaterReading({
      room_id: room1.id,
      reading_month: testMonth,
      reading_year: testYear,
      previous_value: 50,
      current_value: 70,
      unit_price: 12000
    });

    assert.equal(Number(r1.consumption), 8, 'Room 1 consumption should be 8 m3 (20 - 7 - 5)');
    assert.equal(Number(r1.amount), 96000, 'Room 1 amount should be 8 * 12000 = 96000');
  });

  await t.test('3. When Room 2 reading is updated from 7 m3 to 10 m3 -> Room 1 automatically syncs to 5 m3', async () => {
    // Room 2 updated: 10 -> 20 (diff = 10 m3)
    await readingRepo.createWaterReading({
      room_id: room2.id,
      reading_month: testMonth,
      reading_year: testYear,
      previous_value: 10,
      current_value: 20,
      unit_price: 12000
    });

    // Check Room 1
    const r1After = await readingRepo.findWaterByRoomAndPeriod(room1.id, testMonth, testYear);
    assert.equal(Number(r1After.consumption), 5, 'Room 1 consumption should be 20 - 10 - 5 = 5 m3');
    assert.equal(Number(r1After.amount), 60000, 'Room 1 amount should be 5 * 12000 = 60000');
  });

  await t.test('4. Sub-meters exceed master meter: clamp to 0 (no negative consumption)', async () => {
    // Master clock says 50 -> 60 (diff = 10), but P2 is 10 and P3 is 5 (total 15)
    const r1 = await readingRepo.createWaterReading({
      room_id: room1.id,
      reading_month: testMonth,
      reading_year: testYear,
      previous_value: 50,
      current_value: 60,
      unit_price: 12000
    });

    assert.equal(Number(r1.consumption), 0, 'Net consumption should clamp to 0 when sub-meters exceed master');
    assert.equal(Number(r1.amount), 0);
  });
});
