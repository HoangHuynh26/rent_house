import test from 'node:test';
import assert from 'node:assert';
import * as readingRepo from '../src/repositories/reading.repo.js';

test('Decimal Helper: parseDecimal parses dots and commas correctly', () => {
  assert.strictEqual(readingRepo.parseDecimal('1250.5'), 1250.5);
  assert.strictEqual(readingRepo.parseDecimal('1250,5'), 1250.5);
  assert.strictEqual(readingRepo.parseDecimal('0,75'), 0.75);
  assert.strictEqual(readingRepo.parseDecimal(12.34), 12.34);
  assert.strictEqual(readingRepo.parseDecimal(''), 0);
  assert.strictEqual(readingRepo.parseDecimal(null), 0);
});

test('Decimal Subtraction & Precision: No floating point inaccuracy in consumption', () => {
  const prev = readingRepo.parseDecimal('1250.2');
  const curr = readingRepo.parseDecimal('1250.7');
  // 1250.7 - 1250.2 in naive JS is 0.5000000000000004
  const consumption = readingRepo.roundDecimal(curr - prev, 3);
  assert.strictEqual(consumption, 0.5);

  const price = 3500;
  const amount = Math.round(consumption * price);
  assert.strictEqual(amount, 1750);
});

test('Past Month & Year Reading Creation: Supports historical years (e.g. 2023, 2024)', async () => {
  const pastRecord = await readingRepo.createElectricityReading({
    room_id: 'd0000000-0000-0000-0000-000000000101',
    reading_month: 5,
    reading_year: 2023,
    previous_value: '500.25',
    current_value: '545.75',
    unit_price: 3500,
    is_meter_reset: false
  });

  assert.ok(pastRecord);
  assert.strictEqual(Number(pastRecord.reading_year), 2023);
  assert.strictEqual(Number(pastRecord.reading_month), 5);
  assert.strictEqual(Number(pastRecord.previous_value), 500.25);
  assert.strictEqual(Number(pastRecord.current_value), 545.75);
  assert.strictEqual(Number(pastRecord.consumption), 45.5);
  assert.strictEqual(Number(pastRecord.amount), 45.5 * 3500); // 159250
});

test('Water Decimal Meter Reading: Precise liter / cubic meter subtraction', async () => {
  const waterRecord = await readingRepo.createWaterReading({
    room_id: 'd0000000-0000-0000-0000-000000000101',
    reading_month: 6,
    reading_year: 2024,
    previous_value: '64.125',
    current_value: '70.625',
    unit_price: 20000,
    is_meter_reset: false
  });

  assert.ok(waterRecord);
  assert.strictEqual(Number(waterRecord.reading_year), 2024);
  assert.strictEqual(Number(waterRecord.previous_value), 64.125);
  assert.strictEqual(Number(waterRecord.current_value), 70.625);
  assert.strictEqual(Number(waterRecord.consumption), 6.5);
  assert.strictEqual(Number(waterRecord.amount), 130000);
});

test('Verification with edited previous_value: Updates consumption and amount correctly', async () => {
  const waterRecord = await readingRepo.createWaterReading({
    room_id: 'd0000000-0000-0000-0000-000000000102',
    reading_month: 1,
    reading_year: 2024,
    previous_value: '10.0',
    current_value: '20.0',
    unit_price: 20000,
    is_meter_reset: false
  });

  const verified = await readingRepo.verifyWaterReading(waterRecord.id, {
    verified_by: 'a0000000-0000-0000-0000-000000000001',
    current_value: '25.5',
    previous_value: '12.5',
    is_meter_reset: false
  });

  assert.ok(verified);
  assert.strictEqual(Number(verified.previous_value), 12.5);
  assert.strictEqual(Number(verified.current_value), 25.5);
  assert.strictEqual(Number(verified.consumption), 13);
  assert.strictEqual(Number(verified.amount), 260000);
});

test('Meter Reset Safeguard: When curr >= prev (e.g. 2 -> 9527), consumption is ALWAYS curr - prev even if is_meter_reset was sent true', async () => {
  const reading = await readingRepo.createElectricityReading({
    room_id: 'd0000000-0000-0000-0000-000000000102',
    reading_month: 2,
    reading_year: 2024,
    previous_value: '2',
    current_value: '9527',
    unit_price: 3500,
    is_meter_reset: true // Flag mistakenly sent or checked
  });

  assert.ok(reading);
  assert.strictEqual(Number(reading.previous_value), 2);
  assert.strictEqual(Number(reading.current_value), 9527);
  // Must subtract: 9527 - 2 = 9525, NOT 9527!
  assert.strictEqual(Number(reading.consumption), 9525);
  assert.strictEqual(Number(reading.amount), 9525 * 3500);
  assert.strictEqual(reading.is_meter_reset, false);
});

test('Meter Rollover: When curr < prev and is_meter_reset is true, consumption is curr', async () => {
  const reading = await readingRepo.createElectricityReading({
    room_id: 'd0000000-0000-0000-0000-000000000102',
    reading_month: 3,
    reading_year: 2024,
    previous_value: '9998',
    current_value: '5',
    unit_price: 3500,
    is_meter_reset: true // True rollover from 9998 to 5
  });

  assert.ok(reading);
  assert.strictEqual(Number(reading.previous_value), 9998);
  assert.strictEqual(Number(reading.current_value), 5);
  assert.strictEqual(Number(reading.consumption), 5);
  assert.strictEqual(Number(reading.amount), 5 * 3500);
  assert.strictEqual(reading.is_meter_reset, true);
});

