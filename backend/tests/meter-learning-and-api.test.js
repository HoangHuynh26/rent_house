import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import meterLearningService, { recordLearningSample, findLearnedMatch, getLearningStats, computePerceptualHash } from '../src/services/meter-learning.service.js';
import aiVisionFallbackService from '../src/services/ai-vision-fallback.service.js';
import { analyzeMeterImage } from '../src/services/ai-client.service.js';

test('Meter Learning Service: Hash computation & learned sample recording and retrieval', async () => {
  // Create a synthetic 100x100 test meter image with unique pattern
  const testBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 120, g: 150, b: 200 }
    }
  }).png().toBuffer();

  const pHash = await computePerceptualHash(testBuffer);
  assert.ok(pHash, 'pHash should be successfully computed');
  assert.strictEqual(pHash.length, 256, 'Perceptual hash must be 256 bits');

  // Record verified sample
  const sample = await recordLearningSample(testBuffer, {
    white_digits: '04589',
    red_digit: '7',
    value: 4589,
    full_display: '04589.7',
    meter_model: 'Đồng hồ thử nghiệm tự học',
    serial_number: 'TEST-LEARN-999',
    reading_type: 'electricity'
  }, { lighting: { is_dark: true } }, 'unit_test');

  assert.ok(sample, 'Sample must be created');
  assert.strictEqual(sample.value, 4589);
  assert.strictEqual(sample.whiteDigits, '04589');

  // Retrieve matching sample by pHash
  const match = findLearnedMatch(pHash, 10);
  assert.ok(match, 'Must find matching learned sample');
  assert.strictEqual(match.value, 4589);
  assert.strictEqual(match.whiteDigits, '04589');
  assert.strictEqual(match.redDigit, '7');
  assert.strictEqual(match.serialNumber, 'TEST-LEARN-999');
});

test('Meter Learning Service: Statistics & Environment resilience audit', () => {
  const stats = getLearningStats();
  assert.ok(stats.total_learned_samples >= 1, 'Should have at least 1 learned sample');
  assert.ok(stats.model_accuracy_score >= 0.95, 'Accuracy score should be high');
  assert.strictEqual(typeof stats.environment_resilience_rate, 'number');
  assert.ok(Array.isArray(stats.recent_learned), 'Recent learned list must be an array');
});

test('AI Vision Fallback Service: Runtime configuration management', () => {
  const initialConfig = aiVisionFallbackService.getAiVisionConfig();
  assert.strictEqual(typeof initialConfig.enabled, 'boolean');

  // Update configuration
  const updated = aiVisionFallbackService.updateAiVisionConfig({
    enabled: true,
    provider: 'gemini',
    geminiModel: 'gemini-2.0-flash',
    confidenceThreshold: 0.80
  });

  assert.strictEqual(updated.enabled, true);
  assert.strictEqual(updated.provider, 'gemini');
  assert.strictEqual(updated.geminiModel, 'gemini-2.0-flash');
  assert.strictEqual(updated.confidenceThreshold, 0.80);
});

test('AI Meter Analysis: End-to-End Recognition uses Learned Memory if available', async () => {
  // Use a registered sample or an existing test meter image
  const samplePath = path.resolve(process.cwd(), 'uploads/meters/1789313843791_xyccs9c.jpg');
  if (fs.existsSync(samplePath)) {
    const buf = fs.readFileSync(samplePath);
    // Explicitly record learning sample with known model and value 0
    await recordLearningSample(buf, {
      white_digits: '00000',
      red_digit: '0',
      value: 0,
      full_display: '00000.0',
      meter_model: 'EMIC CV140 (Tự học hoàn tất)',
      serial_number: '19658335',
      reading_type: 'electricity'
    }, { lighting: { is_dark: false } }, 'explicit_test_learn');

    const result = await analyzeMeterImage(samplePath, 'electricity', 998400);
    assert.strictEqual(result.value, 0, 'Learned reading must strictly equal 0');
    assert.strictEqual(result.white_digits, '00000');
    assert.strictEqual(result.red_digit, '0');
    assert.ok(result.confidence >= 0.95, 'Confidence must be >= 0.95');
    assert.ok(result.latency_ms < 500, 'Latency must be under 500ms');
  }
});

test('AI Meter Analysis: EMIC CV140 (Serial 18062757) 6-digit reads 0 (white 00000) and excludes 2 (red box)', async () => {
  const samplePath = path.resolve(process.cwd(), 'uploads/meters/1789314865404_ql2kcy2.jpg');
  if (fs.existsSync(samplePath)) {
    const result = await analyzeMeterImage(samplePath, 'electricity', 0);
    assert.strictEqual(result.value, 0, 'Billable integer value must be 0');
    assert.strictEqual(result.white_digits, '00000', 'White digits must be 00000');
    assert.strictEqual(result.red_digit, '2', 'Red digit must be 2');
    assert.strictEqual(result.full_display, '00000.2', 'Full display must be 00000.2');
    assert.strictEqual(result.total_digits, 6, 'Total physical digits must be 6');
    assert.strictEqual(result.serial_number, '18062757');
    assert.ok(result.confidence >= 0.95, 'Confidence must be >= 0.95');
    assert.ok(result.latency_ms < 500, 'Latency must be under 500ms');
  }
});

