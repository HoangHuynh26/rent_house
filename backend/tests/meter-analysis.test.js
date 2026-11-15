import test from 'node:test';
import assert from 'node:assert';
import * as readingRepo from '../src/repositories/reading.repo.js';

test('Reading Repo: Create manual electricity reading and attach image later', async () => {
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

  assert.strictEqual(Number(reading.current_value), 1380);
  assert.strictEqual(Number(reading.consumption), 130);
  assert.strictEqual(reading.image_url, null, 'Initial reading has no image');

  // Admin attaches meter photo later
  const attached = await readingRepo.attachElectricityReadingImage(reading.id, {
    meter_image_id: 'test-meter-img-id-1234',
    image_url: '/api/meter-images/test-meter-img-id-1234/image'
  });

  assert.ok(attached, 'Reading must be returned updated');
  assert.strictEqual(attached.image_url, '/api/meter-images/test-meter-img-id-1234/image');
  assert.strictEqual(attached.meter_image_id, 'test-meter-img-id-1234');
  assert.strictEqual(Number(attached.current_value), 1380);
});

test('Reading Repo: Create manual water reading and attach image later', async () => {
  const waterReading = await readingRepo.createWaterReading({
    room_id: 'test-room-water-id',
    reading_month: 8,
    reading_year: 2026,
    previous_value: 64,
    current_value: 71,
    unit_price: 12000,
    image_url: null,
    meter_image_id: null
  });

  assert.strictEqual(Number(waterReading.current_value), 71);
  assert.strictEqual(Number(waterReading.consumption), 7);
  assert.strictEqual(waterReading.image_url, null, 'Initial water reading has no image');

  const attached = await readingRepo.attachWaterReadingImage(waterReading.id, {
    meter_image_id: 'test-water-img-id-5678',
    image_url: '/api/meter-images/test-water-img-id-5678/image'
  });

  assert.ok(attached, 'Water reading must be returned updated');
  assert.strictEqual(attached.image_url, '/api/meter-images/test-water-img-id-5678/image');
  assert.strictEqual(attached.meter_image_id, 'test-water-img-id-5678');
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
