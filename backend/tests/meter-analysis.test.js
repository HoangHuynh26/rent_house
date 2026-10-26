import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { analyzeMeterImage } from '../src/services/ai-client.service.js';
import * as readingRepo from '../src/repositories/reading.repo.js';

test('AI Meter Analysis: Electricity red digit is excluded, only white digits used for calculation', async () => {
  const dummyFilePath = path.resolve(process.cwd(), 'server.js');
  const result = await analyzeMeterImage(dummyFilePath, 'electricity', 1250);

  // Assertions
  assert.ok(result.value !== undefined, 'Result must contain value');
  assert.strictEqual(Number.isInteger(result.value), true, 'Electricity reading must be strictly an integer (white digits only)');
  assert.ok(result.white_digits, 'Result must include white_digits');
  assert.ok(result.red_digit, 'Result must specify the red digit');
  assert.strictEqual(result.value, Number(result.white_digits), 'Value must match white digits exactly');
  assert.ok(result.latency_ms < 3000, `Latency (${result.latency_ms}ms) must be under 3000ms for fast results`);
  assert.ok(result.rule_applied.includes('ô trắng'), 'Rule explanation must mention white boxes');
});

test('AI Meter Analysis: Water meter reading returns whole units', async () => {
  const dummyFilePath = path.resolve(process.cwd(), 'server.js');
  const result = await analyzeMeterImage(dummyFilePath, 'water', 64);

  assert.ok(result.value >= 64, 'Water reading should be >= previous value');
  assert.strictEqual(result.latency_ms < 500, true, 'Analysis must be fast');
});

test('Reading Repo: Attach image to electricity reading later', async () => {
  const dummyId = 'test-elec-id-' + Date.now();
  // Create reading without image
  const reading = await readingRepo.createElectricityReading({
    room_id: 'test-room-id',
    reading_month: 8,
    reading_year: 2026,
    previous_value: 1250,
    current_value: 1380,
    unit_price: 3500,
    image_url: null,
    meter_image_id: null
  });

  assert.strictEqual(reading.image_url, null, 'Initial reading has no image');

  // Attach image later
  const attached = await readingRepo.attachElectricityReadingImage(reading.id, {
    meter_image_id: 'test-meter-img-id-1234',
    image_url: '/api/meter-images/test-meter-img-id-1234/image',
    image_quality_score: 0.95,
    ai_confidence: 0.98
  });

  assert.ok(attached, 'Reading must be returned updated');
  assert.strictEqual(attached.image_url, '/api/meter-images/test-meter-img-id-1234/image');
  assert.strictEqual(attached.meter_image_id, 'test-meter-img-id-1234');
});

test('Reading Repo: Delete electricity and water readings', async () => {
  const elec = await readingRepo.createElectricityReading({
    room_id: 'test-del-room-id',
    reading_month: 11,
    reading_year: 2026,
    previous_value: 100,
    current_value: 150,
    unit_price: 3000
  });
  assert.ok(elec.id);

  const deletedElec = await readingRepo.deleteElectricityReading(elec.id);
  assert.strictEqual(deletedElec.id, elec.id);

  const water = await readingRepo.createWaterReading({
    room_id: 'test-del-room-id',
    reading_month: 11,
    reading_year: 2026,
    previous_value: 20,
    current_value: 25,
    unit_price: 12000
  });
  assert.ok(water.id);

  const deletedWater = await readingRepo.deleteWaterReading(water.id);
  assert.strictEqual(deletedWater.id, water.id);
});

test('AI Meter Analysis: EMIC CV140 Photo reads 99985 (white boxes) and excludes 3 (red box)', async () => {
  const imagePath = path.resolve(process.cwd(), 'uploads/meters/1789311199949_i206jsd.jpg');
  if (fs.existsSync(imagePath)) {
    const result = await analyzeMeterImage(imagePath, 'electricity', 99700);

    assert.strictEqual(result.value, 99985, 'Official billing calculation must strictly equal 99985 (white boxes only)');
    assert.strictEqual(result.white_digits, '99985', 'White boxes sequence must be 99985');
    assert.strictEqual(result.red_digit, '3', 'Red box tenth digit must be 3');
    assert.strictEqual(result.full_display, '99985.3', 'Full physical dial reading must be 99985.3');
    assert.strictEqual(result.meter_model, 'EMIC CV140 (1 Pha 2 Dây)', 'Model must identify as EMIC CV140');
    assert.strictEqual(result.serial_number, '10 256616', 'Serial number must match meter face plate');
    assert.ok(result.confidence >= 0.95, 'Confidence must be >= 0.95');
    assert.ok(result.latency_ms < 500, `Latency (${result.latency_ms}ms) must be under 500ms`);
  }
});

test('AI Meter Analysis: DT-50 3-Phase Photo reads 12547 (white boxes 0012547) and excludes 9 (red box)', async () => {
  const imagePath = path.resolve(process.cwd(), 'uploads/meters/1789312882068_oor2mmr.jpg');
  if (fs.existsSync(imagePath)) {
    const result = await analyzeMeterImage(imagePath, 'electricity', 12400);

    assert.strictEqual(result.value, 12547, 'Official billing calculation must strictly equal 12547 (white boxes only)');
    assert.strictEqual(result.white_digits, '0012547', 'White boxes sequence must be 0012547');
    assert.strictEqual(result.red_digit, '9', 'Red box tenth digit must be 9');
    assert.strictEqual(result.full_display, '0012547.9', 'Full physical dial reading must be 0012547.9');
    assert.strictEqual(result.meter_model, 'Công Tơ Điện Xoay Chiều 3 Pha Trực Tiếp (DT-50)', 'Model must identify as DT-50');
    assert.strictEqual(result.serial_number, 'SX18', 'Serial number must match meter face plate');
    assert.ok(result.confidence >= 0.95, 'Confidence must be >= 0.95');
    assert.ok(result.latency_ms < 500, `Latency (${result.latency_ms}ms) must be under 500ms`);
  }
});

test('AI Meter Analysis: Environmental Context & Variable Length Digit Adaptation', async () => {
  const imagePath = path.resolve(process.cwd(), 'uploads/meters/1789312882068_oor2mmr.jpg');
  if (fs.existsSync(imagePath)) {
    const result = await analyzeMeterImage(imagePath, 'electricity', 12400);

    // Variable length format verification
    assert.strictEqual(result.total_digits, 8, 'Must detect exactly 8 total digits for 3-phase meter');
    assert.strictEqual(result.white_digits_count, 7, 'Must detect 7 white-box integer digits');
    assert.strictEqual(result.red_digits_count, 1, 'Must detect 1 red-box decimal digit');
    assert.ok(result.format_description.includes('8 chữ số'), 'Format description must mention 8 digits');
    assert.strictEqual(Array.isArray(result.digit_breakdown), true, 'Digit breakdown must be an array');
    assert.strictEqual(result.digit_breakdown.length, 8, 'Digit breakdown must have 8 entries');

    // Environmental audit verification
    assert.ok(result.environment, 'Result must include environment object');
    assert.ok(result.environment.lighting, 'Environment must include lighting analysis');
    assert.ok(result.environment.reflection_and_glare, 'Environment must include glare analysis');
    assert.ok(result.environment.installation_context, 'Environment must include installation context');
    assert.strictEqual(result.environment.installation_context.is_industrial_cabinet, true, 'Must identify industrial electrical cabinet');
    assert.ok(result.environment.installation_context.cabinet_type.includes('Tủ điện'), 'Cabinet type must identify electrical cabinet');
    assert.ok(result.environment.installation_context.wiring_environment.includes('3 pha'), 'Wiring must identify 3-phase system');
  }
});

test('AI Meter Analysis: Brand-New GELEX EMIC 0 kWh Meter reads strictly 0 (white boxes 00000) and excludes 0 (red box)', async () => {
  const imagePath = path.resolve(process.cwd(), 'uploads/meters/1789313843791_xyccs9c.jpg');
  if (fs.existsSync(imagePath)) {
    // Pass previousValue = 998400 to verify that AI does NOT erroneously return 998497
    const result = await analyzeMeterImage(imagePath, 'electricity', 998400);

    assert.strictEqual(result.value, 0, 'Brand new meter reading must strictly equal 0 kWh (not 998497)');
    assert.strictEqual(result.white_digits, '00000', 'White boxes sequence must be 00000');
    assert.strictEqual(result.red_digit, '0', 'Red box tenth digit must be 0');
    assert.strictEqual(result.full_display, '00000.0', 'Full physical dial display must be 00000.0');
    assert.strictEqual(result.serial_number, '19658335', 'Serial number must match 19658335');
    assert.ok(result.confidence >= 0.95, 'Confidence must be >= 0.95');
    assert.ok(result.latency_ms < 500, `Latency (${result.latency_ms}ms) must be under 500ms`);
  }
});

test('AI Meter Analysis: GELEX EMIC CV140 (Serial 12112289) reads strictly 3151 (white 03151) and excludes 0 (red box)', async () => {
  const imagePath = path.resolve(process.cwd(), 'uploads/meters/gelex_emic_cv140_3151.jpg');
  if (fs.existsSync(imagePath)) {
    const result = await analyzeMeterImage(imagePath, 'electricity', null);

    assert.strictEqual(result.value, 3151, 'Must recognize integer value 3151 kWh');
    assert.strictEqual(result.white_digits, '03151', 'White boxes sequence must be 03151');
    assert.strictEqual(result.red_digit, '0', 'Red box tenth digit must be 0');
    assert.strictEqual(result.full_display, '03151.0', 'Full physical dial display must be 03151.0');
    assert.strictEqual(result.serial_number, '12112289', 'Serial number must match 12112289');
    assert.ok(result.meter_model.includes('CV140'), 'Meter model must identify CV140');
    assert.ok(result.confidence >= 0.95, 'Confidence must be >= 0.95');
    assert.ok(result.latency_ms < 500, `Latency (${result.latency_ms}ms) must be under 500ms`);
  }
});

